"""Injection master data and frozen production context, scoped to a plant."""

from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    false,
    func,
    text,
    true,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base
from app.models.types import UTCDateTime, utcnow


def scoped_reference(local, target, *, ondelete="NO ACTION"):
    return ForeignKeyConstraint(
        [local, "plant_id"],
        [f"{target}.id", f"{target}.plant_id"],
        ondelete=ondelete,
        deferrable=True,
        initially="IMMEDIATE",
    )


def catalog_keys():
    return UniqueConstraint("plant_id", "code"), UniqueConstraint("id", "plant_id")


class PlantCatalog:
    id: Mapped[int] = mapped_column(primary_key=True)
    plant_id: Mapped[int] = mapped_column(ForeignKey("plants.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(120))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime(), default=utcnow, server_default=func.now()
    )


class ProductionLine(PlantCatalog, Base):
    __tablename__ = "production_lines"
    __table_args__ = catalog_keys()


class Product(PlantCatalog, Base):
    __tablename__ = "products"
    __table_args__ = (*catalog_keys(), CheckConstraint("part_weight_g > 0", name="weight"))
    part_weight_g: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    description: Mapped[str] = mapped_column(Text, default="", server_default="")


class Mold(PlantCatalog, Base):
    __tablename__ = "molds"
    __table_args__ = (*catalog_keys(), CheckConstraint("nominal_cavities > 0", name="cavities"))
    nominal_cavities: Mapped[int] = mapped_column()


class Resin(PlantCatalog, Base):
    __tablename__ = "resins"
    __table_args__ = catalog_keys()
    polymer: Mapped[str] = mapped_column(String(40))
    grade: Mapped[str] = mapped_column(String(80))
    manufacturer: Mapped[str] = mapped_column(String(120), default="", server_default="")


class ResinLot(Base):
    __tablename__ = "resin_lots"
    __table_args__ = (
        UniqueConstraint("id", "plant_id"),
        UniqueConstraint("resin_id", "lot_code"),
        scoped_reference("resin_id", "resins"),
        CheckConstraint("received_kg > 0", name="quantity"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    plant_id: Mapped[int] = mapped_column(ForeignKey("plants.id", ondelete="CASCADE"), index=True)
    resin_id: Mapped[int] = mapped_column()
    lot_code: Mapped[str] = mapped_column(String(80))
    received_kg: Mapped[Decimal] = mapped_column(Numeric(14, 4))
    received_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class InjectionRecipe(PlantCatalog, Base):
    __tablename__ = "injection_recipes"
    __table_args__ = (
        *catalog_keys(),
        scoped_reference("product_id", "products"),
        scoped_reference("mold_id", "molds"),
        scoped_reference("resin_id", "resins"),
        CheckConstraint("ideal_cycle_s > 0 AND ideal_cycle_s <= 3600", name="cycle"),
        CheckConstraint("active_cavities > 0", name="cavities"),
    )
    product_id: Mapped[int] = mapped_column()
    mold_id: Mapped[int] = mapped_column()
    resin_id: Mapped[int] = mapped_column()
    ideal_cycle_s: Mapped[Decimal] = mapped_column(Numeric(10, 4))
    active_cavities: Mapped[int] = mapped_column()


class ProductionOrder(Base):
    __tablename__ = "production_orders"
    __table_args__ = (
        UniqueConstraint("id", "plant_id"),
        UniqueConstraint("plant_id", "code"),
        scoped_reference("recipe_id", "injection_recipes"),
        CheckConstraint("target_pieces > 0", name="target"),
        CheckConstraint("status IN ('planned','running','completed','cancelled')", name="status"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    plant_id: Mapped[int] = mapped_column(ForeignKey("plants.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(String(64))
    recipe_id: Mapped[int] = mapped_column()
    target_pieces: Mapped[int] = mapped_column()
    status: Mapped[str] = mapped_column(String(10), default="planned", server_default="planned")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)


class ProductionRun(Base):
    __tablename__ = "production_runs"
    __table_args__ = (
        UniqueConstraint("id", "plant_id"),
        scoped_reference("order_id", "production_orders"),
        scoped_reference("machine_id", "machines", ondelete="CASCADE"),
        scoped_reference("mold_id", "molds"),
        CheckConstraint(
            "active_cavities > 0 AND active_cavities <= nominal_cavities", name="cavities"
        ),
        CheckConstraint("ideal_cycle_s > 0 AND part_weight_g > 0", name="standards"),
        CheckConstraint("ended_at IS NULL OR ended_at > started_at", name="interval"),
        Index(
            "uq_production_runs_open_machine",
            "machine_id",
            unique=True,
            postgresql_where=text("ended_at IS NULL"),
            sqlite_where=text("ended_at IS NULL"),
        ),
        Index(
            "uq_production_runs_open_mold",
            "mold_id",
            unique=True,
            postgresql_where=text("ended_at IS NULL"),
            sqlite_where=text("ended_at IS NULL"),
        ),
        Index("ix_production_runs_machine_started", "machine_id", "started_at"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    plant_id: Mapped[int] = mapped_column(ForeignKey("plants.id", ondelete="CASCADE"), index=True)
    order_id: Mapped[int] = mapped_column()
    machine_id: Mapped[int] = mapped_column()
    mold_id: Mapped[int] = mapped_column()
    context: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON, "sqlite"))
    nominal_cavities: Mapped[int] = mapped_column()
    active_cavities: Mapped[int] = mapped_column()
    ideal_cycle_s: Mapped[Decimal] = mapped_column(Numeric(10, 4))
    part_weight_g: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    started_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    ended_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    started_at: Mapped[datetime] = mapped_column(UTCDateTime())
    ended_at: Mapped[datetime | None] = mapped_column(UTCDateTime())


class RunMaterial(Base):
    __tablename__ = "run_materials"
    __table_args__ = (
        scoped_reference("run_id", "production_runs", ondelete="CASCADE"),
        scoped_reference("resin_lot_id", "resin_lots"),
        CheckConstraint("consumed_kg > 0", name="quantity"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    plant_id: Mapped[int] = mapped_column(ForeignKey("plants.id", ondelete="CASCADE"))
    run_id: Mapped[int] = mapped_column(index=True)
    resin_lot_id: Mapped[int] = mapped_column()
    consumed_kg: Mapped[Decimal] = mapped_column(Numeric(14, 4))
    recorded_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    recorded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class Employee(PlantCatalog, Base):
    __tablename__ = "employees"
    __table_args__ = (
        *catalog_keys(),
        UniqueConstraint("plant_id", "user_id", name="uq_employees_plant_user"),
    )
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class RunEmployee(Base):
    __tablename__ = "run_employees"
    __table_args__ = (
        scoped_reference("run_id", "production_runs", ondelete="CASCADE"),
        scoped_reference("employee_id", "employees"),
        CheckConstraint("role IN ('operator','technician','quality','supervisor')", name="role"),
        CheckConstraint("ended_at IS NULL OR ended_at > started_at", name="interval"),
        Index(
            "uq_run_employees_open",
            "run_id",
            "employee_id",
            unique=True,
            postgresql_where=text("ended_at IS NULL"),
            sqlite_where=text("ended_at IS NULL"),
        ),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    plant_id: Mapped[int] = mapped_column(ForeignKey("plants.id", ondelete="CASCADE"))
    run_id: Mapped[int] = mapped_column(index=True)
    employee_id: Mapped[int] = mapped_column()
    role: Mapped[str] = mapped_column(String(10))
    started_at: Mapped[datetime] = mapped_column(UTCDateTime())
    ended_at: Mapped[datetime | None] = mapped_column(UTCDateTime())


class LineDowntime(Base):
    __tablename__ = "line_downtimes"
    __table_args__ = (
        scoped_reference("line_id", "production_lines"),
        CheckConstraint("ended_at IS NULL OR ended_at > started_at", name="interval"),
        Index(
            "uq_line_downtimes_open",
            "line_id",
            unique=True,
            postgresql_where=text("ended_at IS NULL"),
            sqlite_where=text("ended_at IS NULL"),
        ),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    plant_id: Mapped[int] = mapped_column(ForeignKey("plants.id", ondelete="CASCADE"))
    line_id: Mapped[int] = mapped_column(index=True)
    reason_code: Mapped[str] = mapped_column(
        ForeignKey("downtime_reasons.code", ondelete="RESTRICT")
    )
    planned: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    comment: Mapped[str] = mapped_column(Text, default="", server_default="")
    started_at: Mapped[datetime] = mapped_column(UTCDateTime())
    ended_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    ended_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class LineDowntimeMachine(Base):
    __tablename__ = "line_downtime_machines"
    __table_args__ = (
        Index("ix_line_downtime_machines_machine_downtime", "machine_id", "downtime_id"),
    )
    downtime_id: Mapped[int] = mapped_column(
        ForeignKey("line_downtimes.id", ondelete="CASCADE"), primary_key=True
    )
    machine_id: Mapped[int] = mapped_column(
        ForeignKey("machines.id", ondelete="CASCADE"), primary_key=True
    )


class MachineVariable(Base):
    __tablename__ = "machine_variables"
    __table_args__ = (
        UniqueConstraint("machine_id", "code"),
        CheckConstraint("address BETWEEN 9 AND 65534", name="address"),
        CheckConstraint("data_type IN ('uint16','int16','uint32','int32','float32')", name="type"),
        CheckConstraint(
            "word_order IN ('big','little') AND byte_order IN ('big','little')", name="order"
        ),
        CheckConstraint("scale <> 0", name="scale"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    machine_id: Mapped[int] = mapped_column(
        ForeignKey("machines.id", ondelete="CASCADE"), index=True
    )
    code: Mapped[str] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(120))
    unit: Mapped[str] = mapped_column(String(24))
    map_version: Mapped[str] = mapped_column(
        String(64), default="custom-v1", server_default="custom-v1"
    )
    address: Mapped[int] = mapped_column()
    data_type: Mapped[str] = mapped_column(String(8))
    word_order: Mapped[str] = mapped_column(String(6), default="big", server_default="big")
    byte_order: Mapped[str] = mapped_column(String(6), default="big", server_default="big")
    scale: Mapped[float] = mapped_column(default=1.0, server_default="1")
    offset: Mapped[float] = mapped_column(default=0.0, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())


class MachineTelemetry(Base):
    __tablename__ = "machine_telemetry"
    __table_args__ = (Index("ix_machine_telemetry_run_time", "run_id", "sampled_at"),)
    machine_id: Mapped[int] = mapped_column(
        ForeignKey("machines.id", ondelete="CASCADE"), primary_key=True
    )
    sampled_at: Mapped[datetime] = mapped_column(UTCDateTime(), primary_key=True)
    run_id: Mapped[int | None] = mapped_column(ForeignKey("production_runs.id", ondelete="CASCADE"))
    source: Mapped[str] = mapped_column(String(24), default="modbus", server_default="modbus")
    values: Mapped[dict[str, Any]] = mapped_column(JSONB().with_variant(JSON, "sqlite"))
