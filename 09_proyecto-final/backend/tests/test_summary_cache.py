from datetime import UTC, date, datetime
from types import SimpleNamespace

from app.services.oee import closed_day, summary_cache_key


def test_closed_day_uses_plant_zone():
    plant = SimpleNamespace(id=1, timezone="America/Mexico_City")
    # 05:30 UTC del 22 de octubre son las 23:30 del 21 en la planta: el 21 sigue abierto.
    now = datetime(2026, 10, 22, 5, 30, tzinfo=UTC)
    assert closed_day(plant, date(2026, 10, 20), now) is True
    assert closed_day(plant, date(2026, 10, 21), now) is False
    assert closed_day(plant, None, now) is False
    assert summary_cache_key(plant, date(2026, 10, 20)) == "plant:1:summary:2026-10-20"
