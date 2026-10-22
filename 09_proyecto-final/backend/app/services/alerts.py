from datetime import UTC, datetime, timedelta

from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError

from app.models import AlertRule, MachineEvent, Notification, Plant, PlantMember, Shift, Watchlist
from app.services.oee import aware, day_window, iso, machine_totals, shift_intervals


async def evaluate_alerts(session, machine, snapshot, now=None):
    now = now or datetime.now(UTC)
    rules = list(
        await session.scalars(
            select(AlertRule).where(
                AlertRule.plant_id == machine.plant_id,
                AlertRule.is_active.is_(True),
                or_(AlertRule.machine_id.is_(None), AlertRule.machine_id == machine.id),
            )
        )
    )
    if not rules:
        return
    plant = await session.get(Plant, machine.plant_id)
    event = await session.scalar(
        select(MachineEvent).where(
            MachineEvent.machine_id == machine.id, MachineEvent.ended_at.is_(None)
        )
    )
    for rule in rules:
        payload = dict(plant_id=plant.id, machine_id=machine.id, machine_name=machine.name)
        if rule.type in ("MACHINE_DOWN", "MACHINE_OFFLINE"):
            expected = "DOWN" if rule.type == "MACHINE_DOWN" else "OFFLINE"
            if not event or snapshot["state"] != expected or event.state != expected:
                continue
            duration = (now - aware(event.started_at)).total_seconds()
            if duration <= rule.duration_s:
                continue
            key = f"rule:{rule.id}:machine:{machine.id}:event:{event.id}"
            payload.update(reason_code=event.reason_code, duration_s=int(duration))
        else:
            if now.minute % 5:
                continue
            shifts = list(await session.scalars(select(Shift).where(Shift.plant_id == plant.id)))
            intervals = shift_intervals(
                shifts,
                plant.timezone,
                now - timedelta(days=2),
                now + timedelta(days=2),
                merge=False,
            )
            active = (
                next(((left, right) for left, right in intervals if left <= now < right), None)
                if shifts
                else day_window(plant, now=now + timedelta(seconds=1))
            )
            if active is None:
                continue
            metrics = await machine_totals(session, machine, active[0], now)
            if metrics["oee"] is None or metrics["oee"] >= rule.threshold:
                continue
            key = f"rule:{rule.id}:machine:{machine.id}:shift:{iso(active[0])}"
            payload.update(oee=metrics["oee"], threshold=rule.threshold)
        query = select(PlantMember.user_id).where(PlantMember.plant_id == plant.id)
        if rule.machine_id is not None:
            query = query.join(Watchlist, Watchlist.user_id == PlantMember.user_id).where(
                Watchlist.machine_id == machine.id
            )
        for user_id in await session.scalars(query):
            if await session.scalar(
                select(Notification.id).where(
                    Notification.user_id == user_id, Notification.dedupe_key == key
                )
            ):
                continue
            try:
                async with session.begin_nested():
                    session.add(
                        Notification(
                            user_id=user_id,
                            type=rule.type,
                            payload=payload,
                            created_at=now,
                            dedupe_key=key,
                        )
                    )
                    await session.flush()
            except IntegrityError:
                continue
