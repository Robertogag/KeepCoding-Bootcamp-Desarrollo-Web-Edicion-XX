BEGIN;

-- Run only against the reviewed Cloud SQL development database at revision 0003.
DO $cloudsql_guard$
BEGIN
    IF current_database() IS DISTINCT FROM 'oee_dev'
       OR host(inet_server_addr()) IS DISTINCT FROM '34.66.187.120' THEN
        RAISE EXCEPTION 'Unexpected database or server; migration refused';
    END IF;
    IF to_regclass('public.alembic_version') IS NULL THEN
        RAISE EXCEPTION 'Missing Alembic revision; upgrade refused';
    END IF;
    IF (SELECT count(*) FROM public.alembic_version) <> 1
       OR NOT EXISTS (
           SELECT 1 FROM public.alembic_version
           WHERE version_num = '0003_machine_checkpoints'
       ) THEN
        RAISE EXCEPTION 'Expected revision 0003_machine_checkpoints; upgrade refused';
    END IF;
END
$cloudsql_guard$;

-- Running upgrade 0003_machine_checkpoints -> 0004_injection_context

CREATE TABLE production_lines (
    id SERIAL NOT NULL, 
    plant_id INTEGER NOT NULL, 
    code VARCHAR(64) NOT NULL, 
    name VARCHAR(120) NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_production_lines PRIMARY KEY (id), 
    CONSTRAINT fk_production_lines_plant_id_plants FOREIGN KEY(plant_id) REFERENCES plants (id) ON DELETE CASCADE, 
    CONSTRAINT uq_production_lines_id UNIQUE (id, plant_id), 
    CONSTRAINT uq_production_lines_plant_id UNIQUE (plant_id, code)
);

CREATE INDEX ix_production_lines_plant_id ON production_lines (plant_id);

ALTER TABLE machines ADD COLUMN line_id INTEGER;

ALTER TABLE machines ADD CONSTRAINT uq_machines_id_plant_id UNIQUE (id, plant_id);

ALTER TABLE machines ADD CONSTRAINT fk_machines_line_id_production_lines FOREIGN KEY(line_id, plant_id) REFERENCES production_lines (id, plant_id) ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE;

CREATE INDEX ix_machines_line_id ON machines (line_id);

CREATE TABLE employees (
    user_id INTEGER, 
    id SERIAL NOT NULL, 
    plant_id INTEGER NOT NULL, 
    code VARCHAR(64) NOT NULL, 
    name VARCHAR(120) NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_employees PRIMARY KEY (id), 
    CONSTRAINT fk_employees_plant_id_plants FOREIGN KEY(plant_id) REFERENCES plants (id) ON DELETE CASCADE, 
    CONSTRAINT fk_employees_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE SET NULL, 
    CONSTRAINT uq_employees_id UNIQUE (id, plant_id), 
    CONSTRAINT uq_employees_plant_id UNIQUE (plant_id, code), 
    CONSTRAINT uq_employees_plant_user UNIQUE (plant_id, user_id)
);

CREATE INDEX ix_employees_plant_id ON employees (plant_id);

CREATE TABLE molds (
    nominal_cavities INTEGER NOT NULL, 
    id SERIAL NOT NULL, 
    plant_id INTEGER NOT NULL, 
    code VARCHAR(64) NOT NULL, 
    name VARCHAR(120) NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_molds PRIMARY KEY (id), 
    CONSTRAINT ck_molds_cavities CHECK (nominal_cavities > 0), 
    CONSTRAINT fk_molds_plant_id_plants FOREIGN KEY(plant_id) REFERENCES plants (id) ON DELETE CASCADE, 
    CONSTRAINT uq_molds_id UNIQUE (id, plant_id), 
    CONSTRAINT uq_molds_plant_id UNIQUE (plant_id, code)
);

CREATE INDEX ix_molds_plant_id ON molds (plant_id);

CREATE TABLE products (
    part_weight_g NUMERIC(12, 4) NOT NULL, 
    description TEXT DEFAULT '' NOT NULL, 
    id SERIAL NOT NULL, 
    plant_id INTEGER NOT NULL, 
    code VARCHAR(64) NOT NULL, 
    name VARCHAR(120) NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_products PRIMARY KEY (id), 
    CONSTRAINT ck_products_weight CHECK (part_weight_g > 0), 
    CONSTRAINT fk_products_plant_id_plants FOREIGN KEY(plant_id) REFERENCES plants (id) ON DELETE CASCADE, 
    CONSTRAINT uq_products_id UNIQUE (id, plant_id), 
    CONSTRAINT uq_products_plant_id UNIQUE (plant_id, code)
);

CREATE INDEX ix_products_plant_id ON products (plant_id);

CREATE TABLE resins (
    polymer VARCHAR(40) NOT NULL, 
    grade VARCHAR(80) NOT NULL, 
    manufacturer VARCHAR(120) DEFAULT '' NOT NULL, 
    id SERIAL NOT NULL, 
    plant_id INTEGER NOT NULL, 
    code VARCHAR(64) NOT NULL, 
    name VARCHAR(120) NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_resins PRIMARY KEY (id), 
    CONSTRAINT fk_resins_plant_id_plants FOREIGN KEY(plant_id) REFERENCES plants (id) ON DELETE CASCADE, 
    CONSTRAINT uq_resins_id UNIQUE (id, plant_id), 
    CONSTRAINT uq_resins_plant_id UNIQUE (plant_id, code)
);

CREATE INDEX ix_resins_plant_id ON resins (plant_id);

CREATE TABLE injection_recipes (
    product_id INTEGER NOT NULL, 
    mold_id INTEGER NOT NULL, 
    resin_id INTEGER NOT NULL, 
    ideal_cycle_s NUMERIC(10, 4) NOT NULL, 
    active_cavities INTEGER NOT NULL, 
    id SERIAL NOT NULL, 
    plant_id INTEGER NOT NULL, 
    code VARCHAR(64) NOT NULL, 
    name VARCHAR(120) NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_injection_recipes PRIMARY KEY (id), 
    CONSTRAINT ck_injection_recipes_cavities CHECK (active_cavities > 0), 
    CONSTRAINT ck_injection_recipes_cycle CHECK (ideal_cycle_s > 0 AND ideal_cycle_s <= 3600), 
    CONSTRAINT fk_injection_recipes_mold_id_molds FOREIGN KEY(mold_id, plant_id) REFERENCES molds (id, plant_id) ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE, 
    CONSTRAINT fk_injection_recipes_plant_id_plants FOREIGN KEY(plant_id) REFERENCES plants (id) ON DELETE CASCADE, 
    CONSTRAINT fk_injection_recipes_product_id_products FOREIGN KEY(product_id, plant_id) REFERENCES products (id, plant_id) ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE, 
    CONSTRAINT fk_injection_recipes_resin_id_resins FOREIGN KEY(resin_id, plant_id) REFERENCES resins (id, plant_id) ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE, 
    CONSTRAINT uq_injection_recipes_id UNIQUE (id, plant_id), 
    CONSTRAINT uq_injection_recipes_plant_id UNIQUE (plant_id, code)
);

CREATE INDEX ix_injection_recipes_plant_id ON injection_recipes (plant_id);

CREATE TABLE line_downtimes (
    id SERIAL NOT NULL, 
    plant_id INTEGER NOT NULL, 
    line_id INTEGER NOT NULL, 
    reason_code VARCHAR(32) NOT NULL, 
    planned BOOLEAN DEFAULT false NOT NULL, 
    comment TEXT DEFAULT '' NOT NULL, 
    started_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    ended_at TIMESTAMP WITH TIME ZONE, 
    created_by INTEGER, 
    ended_by INTEGER, 
    CONSTRAINT pk_line_downtimes PRIMARY KEY (id), 
    CONSTRAINT ck_line_downtimes_interval CHECK (ended_at IS NULL OR ended_at > started_at), 
    CONSTRAINT fk_line_downtimes_created_by_users FOREIGN KEY(created_by) REFERENCES users (id) ON DELETE SET NULL, 
    CONSTRAINT fk_line_downtimes_ended_by_users FOREIGN KEY(ended_by) REFERENCES users (id) ON DELETE SET NULL, 
    CONSTRAINT fk_line_downtimes_line_id_production_lines FOREIGN KEY(line_id, plant_id) REFERENCES production_lines (id, plant_id) ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE, 
    CONSTRAINT fk_line_downtimes_plant_id_plants FOREIGN KEY(plant_id) REFERENCES plants (id) ON DELETE CASCADE, 
    CONSTRAINT fk_line_downtimes_reason_code_downtime_reasons FOREIGN KEY(reason_code) REFERENCES downtime_reasons (code) ON DELETE RESTRICT
);

CREATE INDEX ix_line_downtimes_line_id ON line_downtimes (line_id);

CREATE UNIQUE INDEX uq_line_downtimes_open ON line_downtimes (line_id) WHERE ended_at IS NULL;

CREATE TABLE resin_lots (
    id SERIAL NOT NULL, 
    plant_id INTEGER NOT NULL, 
    resin_id INTEGER NOT NULL, 
    lot_code VARCHAR(80) NOT NULL, 
    received_kg NUMERIC(14, 4) NOT NULL, 
    received_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    CONSTRAINT pk_resin_lots PRIMARY KEY (id), 
    CONSTRAINT ck_resin_lots_quantity CHECK (received_kg > 0), 
    CONSTRAINT fk_resin_lots_plant_id_plants FOREIGN KEY(plant_id) REFERENCES plants (id) ON DELETE CASCADE, 
    CONSTRAINT fk_resin_lots_resin_id_resins FOREIGN KEY(resin_id, plant_id) REFERENCES resins (id, plant_id) ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE, 
    CONSTRAINT uq_resin_lots_id UNIQUE (id, plant_id), 
    CONSTRAINT uq_resin_lots_resin_id UNIQUE (resin_id, lot_code)
);

CREATE INDEX ix_resin_lots_plant_id ON resin_lots (plant_id);

CREATE TABLE machine_variables (
    id SERIAL NOT NULL, 
    machine_id INTEGER NOT NULL, 
    code VARCHAR(64) NOT NULL, 
    name VARCHAR(120) NOT NULL, 
    unit VARCHAR(24) NOT NULL, 
    map_version VARCHAR(64) DEFAULT 'custom-v1' NOT NULL, 
    address INTEGER NOT NULL, 
    data_type VARCHAR(8) NOT NULL, 
    word_order VARCHAR(6) DEFAULT 'big' NOT NULL, 
    byte_order VARCHAR(6) DEFAULT 'big' NOT NULL, 
    scale FLOAT DEFAULT '1' NOT NULL, 
    "offset" FLOAT DEFAULT '0' NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    CONSTRAINT pk_machine_variables PRIMARY KEY (id), 
    CONSTRAINT ck_machine_variables_type CHECK (data_type IN ('uint16','int16','uint32','int32','float32')), 
    CONSTRAINT ck_machine_variables_order CHECK (word_order IN ('big','little') AND byte_order IN ('big','little')), 
    CONSTRAINT ck_machine_variables_address CHECK (address BETWEEN 9 AND 65534), 
    CONSTRAINT ck_machine_variables_scale CHECK (scale <> 0), 
    CONSTRAINT fk_machine_variables_machine_id_machines FOREIGN KEY(machine_id) REFERENCES machines (id) ON DELETE CASCADE, 
    CONSTRAINT uq_machine_variables_machine_id UNIQUE (machine_id, code)
);

CREATE INDEX ix_machine_variables_machine_id ON machine_variables (machine_id);

CREATE TABLE production_orders (
    id SERIAL NOT NULL, 
    plant_id INTEGER NOT NULL, 
    code VARCHAR(64) NOT NULL, 
    recipe_id INTEGER NOT NULL, 
    target_pieces INTEGER NOT NULL, 
    status VARCHAR(10) DEFAULT 'planned' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    CONSTRAINT pk_production_orders PRIMARY KEY (id), 
    CONSTRAINT ck_production_orders_status CHECK (status IN ('planned','running','completed','cancelled')), 
    CONSTRAINT ck_production_orders_target CHECK (target_pieces > 0), 
    CONSTRAINT fk_production_orders_plant_id_plants FOREIGN KEY(plant_id) REFERENCES plants (id) ON DELETE CASCADE, 
    CONSTRAINT fk_production_orders_recipe_id_injection_recipes FOREIGN KEY(recipe_id, plant_id) REFERENCES injection_recipes (id, plant_id) ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE, 
    CONSTRAINT uq_production_orders_id UNIQUE (id, plant_id), 
    CONSTRAINT uq_production_orders_plant_id UNIQUE (plant_id, code)
);

CREATE INDEX ix_production_orders_plant_id ON production_orders (plant_id);

CREATE TABLE production_runs (
    id SERIAL NOT NULL, 
    plant_id INTEGER NOT NULL, 
    order_id INTEGER NOT NULL, 
    machine_id INTEGER NOT NULL, 
    mold_id INTEGER NOT NULL, 
    context JSONB NOT NULL, 
    nominal_cavities INTEGER NOT NULL, 
    active_cavities INTEGER NOT NULL, 
    ideal_cycle_s NUMERIC(10, 4) NOT NULL, 
    part_weight_g NUMERIC(12, 4) NOT NULL, 
    started_by INTEGER, 
    ended_by INTEGER, 
    started_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    ended_at TIMESTAMP WITH TIME ZONE, 
    CONSTRAINT pk_production_runs PRIMARY KEY (id), 
    CONSTRAINT ck_production_runs_cavities CHECK (active_cavities > 0 AND active_cavities <= nominal_cavities), 
    CONSTRAINT ck_production_runs_interval CHECK (ended_at IS NULL OR ended_at > started_at), 
    CONSTRAINT ck_production_runs_standards CHECK (ideal_cycle_s > 0 AND part_weight_g > 0), 
    CONSTRAINT fk_production_runs_ended_by_users FOREIGN KEY(ended_by) REFERENCES users (id) ON DELETE SET NULL, 
    CONSTRAINT fk_production_runs_machine_id_machines FOREIGN KEY(machine_id, plant_id) REFERENCES machines (id, plant_id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE, 
    CONSTRAINT fk_production_runs_mold_id_molds FOREIGN KEY(mold_id, plant_id) REFERENCES molds (id, plant_id) ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE, 
    CONSTRAINT fk_production_runs_order_id_production_orders FOREIGN KEY(order_id, plant_id) REFERENCES production_orders (id, plant_id) ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE, 
    CONSTRAINT fk_production_runs_plant_id_plants FOREIGN KEY(plant_id) REFERENCES plants (id) ON DELETE CASCADE, 
    CONSTRAINT fk_production_runs_started_by_users FOREIGN KEY(started_by) REFERENCES users (id) ON DELETE SET NULL, 
    CONSTRAINT uq_production_runs_id UNIQUE (id, plant_id)
);

CREATE INDEX ix_production_runs_machine_started ON production_runs (machine_id, started_at);

CREATE INDEX ix_production_runs_plant_id ON production_runs (plant_id);

CREATE UNIQUE INDEX uq_production_runs_open_machine ON production_runs (machine_id) WHERE ended_at IS NULL;

CREATE UNIQUE INDEX uq_production_runs_open_mold ON production_runs (mold_id) WHERE ended_at IS NULL;

CREATE TABLE machine_telemetry (
    machine_id INTEGER NOT NULL, 
    sampled_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    run_id INTEGER, 
    source VARCHAR(24) DEFAULT 'modbus' NOT NULL, 
    values JSONB NOT NULL, 
    CONSTRAINT pk_machine_telemetry PRIMARY KEY (machine_id, sampled_at), 
    CONSTRAINT fk_machine_telemetry_machine_id_machines FOREIGN KEY(machine_id) REFERENCES machines (id) ON DELETE CASCADE, 
    CONSTRAINT fk_machine_telemetry_run_id_production_runs FOREIGN KEY(run_id) REFERENCES production_runs (id) ON DELETE CASCADE
);

CREATE INDEX ix_machine_telemetry_run_time ON machine_telemetry (run_id, sampled_at);

CREATE TABLE run_employees (
    id SERIAL NOT NULL, 
    plant_id INTEGER NOT NULL, 
    run_id INTEGER NOT NULL, 
    employee_id INTEGER NOT NULL, 
    role VARCHAR(10) NOT NULL, 
    started_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    ended_at TIMESTAMP WITH TIME ZONE, 
    CONSTRAINT pk_run_employees PRIMARY KEY (id), 
    CONSTRAINT ck_run_employees_role CHECK (role IN ('operator','technician','quality','supervisor')), 
    CONSTRAINT ck_run_employees_interval CHECK (ended_at IS NULL OR ended_at > started_at), 
    CONSTRAINT fk_run_employees_employee_id_employees FOREIGN KEY(employee_id, plant_id) REFERENCES employees (id, plant_id) ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE, 
    CONSTRAINT fk_run_employees_plant_id_plants FOREIGN KEY(plant_id) REFERENCES plants (id) ON DELETE CASCADE, 
    CONSTRAINT fk_run_employees_run_id_production_runs FOREIGN KEY(run_id, plant_id) REFERENCES production_runs (id, plant_id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX ix_run_employees_run_id ON run_employees (run_id);

CREATE UNIQUE INDEX uq_run_employees_open ON run_employees (run_id, employee_id) WHERE ended_at IS NULL;

CREATE TABLE run_materials (
    id SERIAL NOT NULL, 
    plant_id INTEGER NOT NULL, 
    run_id INTEGER NOT NULL, 
    resin_lot_id INTEGER NOT NULL, 
    consumed_kg NUMERIC(14, 4) NOT NULL, 
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    recorded_by INTEGER, 
    CONSTRAINT pk_run_materials PRIMARY KEY (id), 
    CONSTRAINT ck_run_materials_quantity CHECK (consumed_kg > 0), 
    CONSTRAINT fk_run_materials_plant_id_plants FOREIGN KEY(plant_id) REFERENCES plants (id) ON DELETE CASCADE, 
    CONSTRAINT fk_run_materials_recorded_by_users FOREIGN KEY(recorded_by) REFERENCES users (id) ON DELETE SET NULL, 
    CONSTRAINT fk_run_materials_resin_lot_id_resin_lots FOREIGN KEY(resin_lot_id, plant_id) REFERENCES resin_lots (id, plant_id) ON DELETE NO ACTION DEFERRABLE INITIALLY IMMEDIATE, 
    CONSTRAINT fk_run_materials_run_id_production_runs FOREIGN KEY(run_id, plant_id) REFERENCES production_runs (id, plant_id) ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE
);

CREATE INDEX ix_run_materials_run_id ON run_materials (run_id);

CREATE TABLE line_downtime_machines (
    downtime_id INTEGER NOT NULL, 
    machine_id INTEGER NOT NULL, 
    CONSTRAINT pk_line_downtime_machines PRIMARY KEY (downtime_id, machine_id), 
    CONSTRAINT fk_line_downtime_machines_downtime_id_line_downtimes FOREIGN KEY(downtime_id) REFERENCES line_downtimes (id) ON DELETE CASCADE, 
    CONSTRAINT fk_line_downtime_machines_machine_id_machines FOREIGN KEY(machine_id) REFERENCES machines (id) ON DELETE CASCADE
);

CREATE INDEX ix_line_downtime_machines_machine_downtime ON line_downtime_machines (machine_id, downtime_id);

UPDATE alembic_version SET version_num='0004_injection_context' WHERE alembic_version.version_num = '0003_machine_checkpoints';

COMMIT;

