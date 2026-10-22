"""Plant-scoped injection catalogs, production context and line stoppages."""

from datetime import UTC, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Query
from fastapi.encoders import jsonable_encoder
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from app.api.deps import CurrentUser, Session, require_machine, require_plant
from app.errors import ApiError
from app.models import (
    DowntimeReason,
    Employee,
    InjectionRecipe,
    LineDowntime,
    LineDowntimeMachine,
    Machine,
    MachineTelemetry,
    MachineVariable,
    Mold,
    PlantMember,
    Product,
    ProductionLine,
    ProductionOrder,
    ProductionRun,
    Resin,
    ResinLot,
    RunEmployee,
    RunMaterial,
)
from app.schemas.common import envelope, paginate
from app.schemas.injection import (
    CatalogCreate,
    CatalogOut,
    ConflictError,
    DowntimeFilters,
    DowntimeStart,
    EmployeeAssignment,
    EmployeeAssignmentOut,
    EmployeeCreate,
    EmployeeOut,
    LineDowntimeOut,
    LotFilters,
    MachineLine,
    MachineLineOut,
    MaterialCreate,
    MaterialOut,
    MoldCreate,
    MoldOut,
    OrderCreate,
    OrderFilters,
    OrderOut,
    OrderPatch,
    Page,
    ProductCreate,
    ProductionContextOut,
    ProductOut,
    RecipeCreate,
    RecipeOut,
    ResinCreate,
    ResinLotCreate,
    ResinLotOut,
    ResinOut,
    RunFilters,
    RunOut,
    RunStart,
    TelemetryOut,
    TraceabilityOut,
    VariableCreate,
    VariableOut,
)

router = APIRouter(tags=["injection"], responses={409: {"model": ConflictError}})
WRITE = {"owner", "supervisor"}


def row_data(row):
    return jsonable_encoder(
        {column.name: getattr(row, column.name) for column in row.__table__.columns}
    )


async def commit(session):
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise ApiError(409, "RESOURCE_CONFLICT") from None


async def scoped(session, model, identifier, plant_id, field="id", *, lock=False):
    query = select(model).where(model.id == identifier, model.plant_id == plant_id)
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    row = await session.scalar(query)
    if row is None:
        if field == "id":
            raise ApiError(404, "NOT_FOUND")
        raise ApiError(422, "VALIDATION_ERROR", field)
    return row


async def validate_catalog(session, model, data, plant_id):
    if model is InjectionRecipe:
        product = await scoped(session, Product, data.product_id, plant_id, "product_id")
        mold = await scoped(session, Mold, data.mold_id, plant_id, "mold_id")
        resin = await scoped(session, Resin, data.resin_id, plant_id, "resin_id")
        if not all(item.is_active for item in (product, mold, resin)):
            raise ApiError(422, "VALIDATION_ERROR", "is_active")
        if data.active_cavities > mold.nominal_cavities:
            raise ApiError(422, "VALIDATION_ERROR", "active_cavities")
    elif model is Employee and data.user_id is not None:
        if await session.get(PlantMember, (plant_id, data.user_id)) is None:
            raise ApiError(422, "VALIDATION_ERROR", "user_id")


def catalog_routes(path, model, schema, output):
    async def list_rows(
        plant_id: int,
        user: CurrentUser,
        session: Session,
        page: int = Query(1, ge=1),
        page_size: int = Query(20, ge=1, le=100),
    ) -> dict[str, Any]:
        await require_plant(session, user, plant_id)
        rows, total = await paginate(
            select(model).where(model.plant_id == plant_id).order_by(model.code),
            session,
            page,
            page_size,
        )
        return envelope([row_data(row) for row in rows], total, page, page_size)

    async def create(plant_id: int, data, user: CurrentUser, session: Session) -> dict[str, Any]:
        await require_plant(session, user, plant_id, WRITE)
        await validate_catalog(session, model, data, plant_id)
        row = model(plant_id=plant_id, **data.model_dump())
        session.add(row)
        await commit(session)
        return row_data(row)

    async def replace(
        plant_id: int, item_id: int, data, user: CurrentUser, session: Session
    ) -> dict[str, Any]:
        await require_plant(session, user, plant_id, WRITE)
        row = await scoped(session, model, item_id, plant_id, lock=True)
        await validate_catalog(session, model, data, plant_id)
        for key, value in data.model_dump().items():
            setattr(row, key, value)
        await commit(session)
        return row_data(row)

    create.__annotations__["data"] = schema
    replace.__annotations__["data"] = schema
    router.add_api_route(
        f"/plants/{{plant_id}}/{path}",
        list_rows,
        methods=["GET"],
        name=f"list_{path}",
        response_model=Page[output],
    )
    router.add_api_route(
        f"/plants/{{plant_id}}/{path}",
        create,
        methods=["POST"],
        status_code=201,
        name=f"create_{path}",
        response_model=output,
    )
    router.add_api_route(
        f"/plants/{{plant_id}}/{path}/{{item_id}}",
        replace,
        methods=["PUT"],
        name=f"update_{path}",
        response_model=output,
    )


for path, model, schema, output in (
    ("production-lines", ProductionLine, CatalogCreate, CatalogOut),
    ("products", Product, ProductCreate, ProductOut),
    ("molds", Mold, MoldCreate, MoldOut),
    ("resins", Resin, ResinCreate, ResinOut),
    ("employees", Employee, EmployeeCreate, EmployeeOut),
    ("injection-recipes", InjectionRecipe, RecipeCreate, RecipeOut),
):
    catalog_routes(path, model, schema, output)


@router.put("/machines/{machine_id}/line", response_model=MachineLineOut)
async def assign_line(
    machine_id: int, data: MachineLine, user: CurrentUser, session: Session
) -> dict[str, Any]:
    machine = await require_machine(session, user, machine_id, WRITE)
    original_line_id = machine.line_id
    # Opening a stop and moving a machine serialize on lines, then machines.
    for line_id in sorted(
        {value for value in (original_line_id, data.line_id) if value is not None}
    ):
        line = await scoped(
            session, ProductionLine, line_id, machine.plant_id, "line_id", lock=True
        )
        if line_id == data.line_id and not line.is_active:
            raise ApiError(422, "VALIDATION_ERROR", "line_id")
    machine = await scoped(session, Machine, machine_id, machine.plant_id, lock=True)
    if machine.line_id != original_line_id:
        raise ApiError(409, "RESOURCE_CONFLICT")
    if machine.line_id != data.line_id:
        affected = await session.scalar(
            select(LineDowntime.id)
            .join(LineDowntimeMachine)
            .where(LineDowntimeMachine.machine_id == machine.id, LineDowntime.ended_at.is_(None))
        )
        destination = (
            await session.scalar(
                select(LineDowntime.id).where(
                    LineDowntime.line_id == data.line_id, LineDowntime.ended_at.is_(None)
                )
            )
            if data.line_id is not None
            else None
        )
        if affected is not None or destination is not None:
            raise ApiError(409, "RESOURCE_CONFLICT")
    machine.line_id = data.line_id
    await commit(session)
    return {"machine_id": machine_id, "line_id": machine.line_id}


@router.post("/plants/{plant_id}/resin-lots", status_code=201, response_model=ResinLotOut)
async def create_lot(
    plant_id: int, data: ResinLotCreate, user: CurrentUser, session: Session
) -> dict[str, Any]:
    await require_plant(session, user, plant_id, WRITE)
    await scoped(session, Resin, data.resin_id, plant_id, "resin_id")
    lot = ResinLot(plant_id=plant_id, **data.model_dump())
    session.add(lot)
    await commit(session)
    return row_data(lot)


@router.post("/plants/{plant_id}/production-orders", status_code=201, response_model=OrderOut)
async def create_order(
    plant_id: int, data: OrderCreate, user: CurrentUser, session: Session
) -> dict[str, Any]:
    await require_plant(session, user, plant_id, WRITE)
    recipe = await scoped(session, InjectionRecipe, data.recipe_id, plant_id, "recipe_id")
    if not recipe.is_active:
        raise ApiError(422, "VALIDATION_ERROR", "recipe_id")
    row = ProductionOrder(plant_id=plant_id, **data.model_dump())
    session.add(row)
    await commit(session)
    return row_data(row)


async def downtime_data(session, row):
    machines = await session.scalars(
        select(LineDowntimeMachine.machine_id)
        .where(LineDowntimeMachine.downtime_id == row.id)
        .order_by(LineDowntimeMachine.machine_id)
    )
    return {**row_data(row), "affected_machine_ids": list(machines)}


def filter_operations(query, model, filters):
    """Apply filters in SQL before counting and paging, including frozen assignments."""
    if model is ResinLot:
        if filters.resin_id is not None:
            query = query.where(model.resin_id == filters.resin_id)
        timestamp = model.received_at
    elif model is ProductionOrder:
        if filters.status is not None:
            query = query.where(model.status == filters.status)
        timestamp = model.created_at
    else:
        if filters.line_id is not None:
            line = (
                model.context["line_id"].as_integer() if model is ProductionRun else model.line_id
            )
            query = query.where(line == filters.line_id)
        if filters.machine_id is not None:
            if model is ProductionRun:
                query = query.where(model.machine_id == filters.machine_id)
            else:
                # EXISTS cannot duplicate a stop captured for several machines.
                query = query.where(
                    select(LineDowntimeMachine.downtime_id)
                    .where(
                        LineDowntimeMachine.downtime_id == model.id,
                        LineDowntimeMachine.machine_id == filters.machine_id,
                    )
                    .exists()
                )
        if model is ProductionRun and filters.order_id is not None:
            query = query.where(model.order_id == filters.order_id)
        if filters.open is not None:
            query = query.where(
                model.ended_at.is_(None) if filters.open else model.ended_at.is_not(None)
            )
        if filters.start is not None:
            query = query.where(or_(model.ended_at.is_(None), model.ended_at > filters.start))
        if filters.end is not None:
            query = query.where(model.started_at < filters.end)
        return query
    if filters.start is not None:
        query = query.where(timestamp >= filters.start)
    if filters.end is not None:
        query = query.where(timestamp < filters.end)
    return query


def operation_routes(path, model, output, filter_schema):
    async def list_rows(
        plant_id: int,
        user: CurrentUser,
        session: Session,
        filters,
    ):
        await require_plant(session, user, plant_id)
        query = filter_operations(select(model).where(model.plant_id == plant_id), model, filters)
        rows, total = await paginate(
            query.order_by(model.id.desc()),
            session,
            filters.page,
            filters.page_size,
        )
        items = [
            await downtime_data(session, row) if model is LineDowntime else row_data(row)
            for row in rows
        ]
        return envelope(items, total, filters.page, filters.page_size)

    list_rows.__annotations__["filters"] = Annotated[filter_schema, Query()]
    router.add_api_route(
        f"/plants/{{plant_id}}/injection/{path}",
        list_rows,
        methods=["GET"],
        name=f"list_{path}",
        response_model=Page[output],
    )


for path, model, output, filters in (
    ("resin-lots", ResinLot, ResinLotOut, LotFilters),
    ("production-orders", ProductionOrder, OrderOut, OrderFilters),
    ("production-runs", ProductionRun, RunOut, RunFilters),
    ("line-downtimes", LineDowntime, LineDowntimeOut, DowntimeFilters),
):
    operation_routes(path, model, output, filters)


@router.patch("/production-orders/{order_id}", response_model=OrderOut)
async def change_order_status(order_id: int, data: OrderPatch, user: CurrentUser, session: Session):
    order = await session.get(ProductionOrder, order_id)
    if order is None:
        raise ApiError(404, "NOT_FOUND")
    await require_plant(session, user, order.plant_id, WRITE)
    order = await scoped(session, ProductionOrder, order_id, order.plant_id, lock=True)
    active = await session.scalar(
        select(ProductionRun.id).where(
            ProductionRun.order_id == order_id, ProductionRun.ended_at.is_(None)
        )
    )
    if active is not None:
        raise ApiError(409, "RESOURCE_CONFLICT")
    # Closed orders may be explicitly reopened, but must pass through planned.
    if order.status in {"completed", "cancelled"} and data.status not in {order.status, "planned"}:
        raise ApiError(409, "RESOURCE_CONFLICT")
    order.status = data.status
    await commit(session)
    return row_data(order)


@router.post("/machines/{machine_id}/production-runs", status_code=201, response_model=RunOut)
async def start_run(
    machine_id: int, data: RunStart, user: CurrentUser, session: Session
) -> dict[str, Any]:
    machine = await require_machine(session, user, machine_id, WRITE)
    machine = await scoped(session, Machine, machine_id, machine.plant_id, lock=True)
    if not machine.is_active:
        raise ApiError(422, "VALIDATION_ERROR", "machine_id")
    order = await scoped(
        session, ProductionOrder, data.order_id, machine.plant_id, "order_id", lock=True
    )
    if order.status in {"completed", "cancelled"}:
        raise ApiError(409, "RESOURCE_CONFLICT")
    recipe = await scoped(session, InjectionRecipe, order.recipe_id, machine.plant_id, lock=True)
    mold = await scoped(session, Mold, recipe.mold_id, machine.plant_id, lock=True)
    product = await scoped(session, Product, recipe.product_id, machine.plant_id)
    resin = await scoped(session, Resin, recipe.resin_id, machine.plant_id)
    cavities = data.active_cavities if data.active_cavities is not None else recipe.active_cavities
    if cavities > mold.nominal_cavities:
        raise ApiError(422, "VALIDATION_ERROR", "active_cavities")
    if not all(row.is_active for row in (recipe, mold, product, resin)):
        raise ApiError(422, "VALIDATION_ERROR", "is_active")
    line = (
        await session.get(ProductionLine, machine.line_id) if machine.line_id is not None else None
    )
    context = {
        "recipe_id": recipe.id,
        "recipe_code": recipe.code,
        "product_id": product.id,
        "product_code": product.code,
        "product_name": product.name,
        "mold_code": mold.code,
        "mold_name": mold.name,
        "resin_id": resin.id,
        "resin_code": resin.code,
        "resin_name": resin.name,
        "polymer": resin.polymer,
        "grade": resin.grade,
        "counter_unit": "pieces",
        "cycle_unit": "seconds_per_shot",
        "line_id": machine.line_id,
        "line_code": line.code if line is not None else None,
        "line_name": line.name if line is not None else None,
    }
    row = ProductionRun(
        plant_id=machine.plant_id,
        order_id=order.id,
        machine_id=machine.id,
        mold_id=mold.id,
        context=context,
        nominal_cavities=mold.nominal_cavities,
        active_cavities=cavities,
        ideal_cycle_s=recipe.ideal_cycle_s,
        part_weight_g=product.part_weight_g,
        started_by=user.id,
        started_at=datetime.now(UTC),
    )
    order.status = "running"
    session.add(row)
    await commit(session)
    return row_data(row)


async def authorized_run(session, user, run_id, *, lock=False):
    run = await session.get(ProductionRun, run_id)
    if run is None:
        raise ApiError(404, "NOT_FOUND")
    await require_plant(session, user, run.plant_id, WRITE)
    if lock:
        await scoped(session, Machine, run.machine_id, run.plant_id, lock=True)
        await scoped(session, ProductionOrder, run.order_id, run.plant_id, lock=True)
        run = await scoped(session, ProductionRun, run_id, run.plant_id, lock=True)
    return run


@router.post("/production-runs/{run_id}/end", response_model=RunOut)
async def end_run(run_id: int, user: CurrentUser, session: Session) -> dict[str, Any]:
    run = await authorized_run(session, user, run_id, lock=True)
    if run.ended_at is None:
        run.ended_at, run.ended_by = datetime.now(UTC), user.id
        assignments = await session.scalars(
            select(RunEmployee).where(RunEmployee.run_id == run.id, RunEmployee.ended_at.is_(None))
        )
        for assignment in assignments:
            assignment.ended_at = run.ended_at
        order = await session.get(ProductionOrder, run.order_id)
        active = await session.scalar(
            select(ProductionRun.id).where(
                ProductionRun.order_id == run.order_id,
                ProductionRun.id != run.id,
                ProductionRun.ended_at.is_(None),
            )
        )
        if order.status == "running" and active is None:
            order.status = "planned"
        await commit(session)
    return row_data(run)


@router.post("/production-runs/{run_id}/materials", status_code=201, response_model=MaterialOut)
async def record_material(
    run_id: int, data: MaterialCreate, user: CurrentUser, session: Session
) -> dict[str, Any]:
    run = await authorized_run(session, user, run_id, lock=True)
    lot = await scoped(
        session, ResinLot, data.resin_lot_id, run.plant_id, "resin_lot_id", lock=True
    )
    if run.ended_at is not None or lot.resin_id != run.context["resin_id"]:
        raise ApiError(422, "VALIDATION_ERROR", "resin_lot_id")
    used = await session.scalar(
        select(func.coalesce(func.sum(RunMaterial.consumed_kg), 0)).where(
            RunMaterial.resin_lot_id == lot.id
        )
    )
    if used + data.consumed_kg > lot.received_kg:
        raise ApiError(409, "RESOURCE_CONFLICT")
    row = RunMaterial(
        plant_id=run.plant_id, run_id=run.id, recorded_by=user.id, **data.model_dump()
    )
    session.add(row)
    await commit(session)
    return row_data(row)


@router.post(
    "/production-runs/{run_id}/employees", status_code=201, response_model=EmployeeAssignmentOut
)
async def assign_employee(
    run_id: int, data: EmployeeAssignment, user: CurrentUser, session: Session
) -> dict[str, Any]:
    run = await authorized_run(session, user, run_id, lock=True)
    employee = await scoped(session, Employee, data.employee_id, run.plant_id, "employee_id")
    if run.ended_at is not None or not employee.is_active:
        raise ApiError(409, "RESOURCE_CONFLICT")
    row = RunEmployee(
        plant_id=run.plant_id, run_id=run.id, started_at=datetime.now(UTC), **data.model_dump()
    )
    session.add(row)
    await commit(session)
    return row_data(row)


@router.post(
    "/production-runs/{run_id}/employees/{assignment_id}/end", response_model=EmployeeAssignmentOut
)
async def end_employee(run_id: int, assignment_id: int, user: CurrentUser, session: Session):
    run = await authorized_run(session, user, run_id, lock=True)
    assignment = await session.scalar(
        select(RunEmployee)
        .where(RunEmployee.id == assignment_id, RunEmployee.run_id == run.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if assignment is None:
        raise ApiError(404, "NOT_FOUND")
    if assignment.ended_at is None:
        assignment.ended_at = run.ended_at or datetime.now(UTC)
        await commit(session)
    return row_data(assignment)


@router.post(
    "/production-lines/{line_id}/downtimes", status_code=201, response_model=LineDowntimeOut
)
async def start_downtime(
    line_id: int, data: DowntimeStart, user: CurrentUser, session: Session
) -> dict[str, Any]:
    line = await session.get(ProductionLine, line_id)
    if line is None:
        raise ApiError(404, "NOT_FOUND")
    await require_plant(session, user, line.plant_id, WRITE)
    line = await scoped(session, ProductionLine, line_id, line.plant_id, lock=True)
    if not line.is_active:
        raise ApiError(422, "VALIDATION_ERROR", "line_id")
    if await session.get(DowntimeReason, data.reason_code) is None:
        raise ApiError(422, "VALIDATION_ERROR", "reason_code")
    if (
        await session.scalar(
            select(LineDowntime.id).where(
                LineDowntime.line_id == line.id, LineDowntime.ended_at.is_(None)
            )
        )
        is not None
    ):
        raise ApiError(409, "RESOURCE_CONFLICT")
    machines = list(
        await session.scalars(
            select(Machine)
            .where(Machine.line_id == line.id, Machine.is_active.is_(True))
            .order_by(Machine.id)
            .with_for_update()
            .execution_options(populate_existing=True)
        )
    )
    if not machines:
        raise ApiError(422, "VALIDATION_ERROR", "line_id")
    row = LineDowntime(
        plant_id=line.plant_id,
        line_id=line.id,
        created_by=user.id,
        started_at=datetime.now(UTC),
        **data.model_dump(),
    )
    session.add(row)
    try:
        await session.flush()
    except IntegrityError:
        await session.rollback()
        raise ApiError(409, "RESOURCE_CONFLICT") from None
    session.add_all(
        [LineDowntimeMachine(downtime_id=row.id, machine_id=machine.id) for machine in machines]
    )
    await commit(session)
    return await downtime_data(session, row)


@router.post("/line-downtimes/{downtime_id}/end", response_model=LineDowntimeOut)
async def end_downtime(downtime_id: int, user: CurrentUser, session: Session) -> dict[str, Any]:
    row = await session.get(LineDowntime, downtime_id)
    if row is None:
        raise ApiError(404, "NOT_FOUND")
    await require_plant(session, user, row.plant_id, WRITE)
    await scoped(session, ProductionLine, row.line_id, row.plant_id, lock=True)
    row = await scoped(session, LineDowntime, row.id, row.plant_id, lock=True)
    if row.ended_at is None:
        row.ended_at, row.ended_by = datetime.now(UTC), user.id
        await commit(session)
    return await downtime_data(session, row)


@router.get("/production-runs/{run_id}/traceability", response_model=TraceabilityOut)
async def traceability(run_id: int, user: CurrentUser, session: Session) -> dict[str, Any]:
    run = await session.get(ProductionRun, run_id)
    if run is None:
        raise ApiError(404, "NOT_FOUND")
    await require_plant(session, user, run.plant_id)
    materials = (
        await session.scalars(select(RunMaterial).where(RunMaterial.run_id == run.id))
    ).all()
    people = (await session.scalars(select(RunEmployee).where(RunEmployee.run_id == run.id))).all()
    return {
        "run": row_data(run),
        "materials": [row_data(row) for row in materials],
        "employees": [row_data(row) for row in people],
        "ideal_seconds_per_piece": float(run.ideal_cycle_s) / run.active_cavities,
    }


@router.get("/machines/{machine_id}/production-context", response_model=ProductionContextOut)
async def production_context(machine_id: int, user: CurrentUser, session: Session):
    await require_machine(session, user, machine_id)
    run = await session.scalar(
        select(ProductionRun).where(
            ProductionRun.machine_id == machine_id, ProductionRun.ended_at.is_(None)
        )
    )
    return {
        "run": row_data(run) if run is not None else None,
        "ideal_seconds_per_piece": float(run.ideal_cycle_s) / run.active_cavities
        if run is not None
        else None,
    }


@router.put("/machines/{machine_id}/variables/{code}", response_model=VariableOut)
async def configure_variable(
    machine_id: int, code: str, data: VariableCreate, user: CurrentUser, session: Session
) -> dict[str, Any]:
    await require_machine(session, user, machine_id, WRITE)
    if code != data.code:
        raise ApiError(422, "VALIDATION_ERROR", "code")
    row = await session.scalar(
        select(MachineVariable).where(
            MachineVariable.machine_id == machine_id, MachineVariable.code == code
        )
    )
    if row is None:
        row = MachineVariable(machine_id=machine_id, **data.model_dump())
        session.add(row)
    else:
        for key, value in data.model_dump().items():
            setattr(row, key, value)
    await commit(session)
    return row_data(row)


@router.get("/machines/{machine_id}/variables", response_model=Page[VariableOut])
async def list_variables(
    machine_id: int,
    user: CurrentUser,
    session: Session,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    await require_machine(session, user, machine_id)
    rows, total = await paginate(
        select(MachineVariable)
        .where(MachineVariable.machine_id == machine_id)
        .order_by(MachineVariable.code),
        session,
        page,
        page_size,
    )
    return envelope([row_data(row) for row in rows], total, page, page_size)


@router.get(
    "/machines/{machine_id}/telemetry",
    response_model=Page[TelemetryOut],
    response_model_exclude_unset=True,
)
async def telemetry(
    machine_id: int,
    user: CurrentUser,
    session: Session,
    start: datetime = Query(alias="from"),
    end: datetime = Query(alias="to"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
) -> dict[str, Any]:
    await require_machine(session, user, machine_id)
    if start.tzinfo is None or end.tzinfo is None or end <= start:
        raise ApiError(422, "VALIDATION_ERROR", "to")
    query = (
        select(MachineTelemetry)
        .where(
            MachineTelemetry.machine_id == machine_id,
            MachineTelemetry.sampled_at >= start,
            MachineTelemetry.sampled_at < end,
        )
        .order_by(MachineTelemetry.sampled_at.desc())
    )
    rows, total = await paginate(query, session, page, page_size)
    return envelope([row_data(row) for row in rows], total, page, page_size)
