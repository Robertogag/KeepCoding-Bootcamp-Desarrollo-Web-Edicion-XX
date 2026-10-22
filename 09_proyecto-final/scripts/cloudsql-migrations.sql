BEGIN;

-- Run only against the new, empty Cloud SQL development database.
DO $cloudsql_guard$
BEGIN
    IF current_database() IS DISTINCT FROM 'oee_dev'
       OR host(inet_server_addr()) IS DISTINCT FROM '34.66.187.120' THEN
        RAISE EXCEPTION 'Unexpected database or server; migration refused';
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
          AND table_type = 'BASE TABLE'
    ) THEN
        RAISE EXCEPTION 'Database is not empty; use Alembic online upgrades';
    END IF;
END
$cloudsql_guard$;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 0001_initial

CREATE TABLE users (
    id SERIAL NOT NULL, 
    username VARCHAR(30) NOT NULL, 
    email VARCHAR(254) NOT NULL, 
    full_name VARCHAR(80) NOT NULL, 
    password_hash VARCHAR(255) NOT NULL, 
    language VARCHAR(2) DEFAULT 'es' NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_users PRIMARY KEY (id), 
    CONSTRAINT ck_users_language CHECK (language IN ('es', 'en')), 
    CONSTRAINT uq_users_username UNIQUE (username), 
    CONSTRAINT uq_users_email UNIQUE (email)
);

CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email));

CREATE TABLE plants (
    id SERIAL NOT NULL, 
    slug VARCHAR(120) NOT NULL, 
    name VARCHAR(80) NOT NULL, 
    timezone VARCHAR(64) NOT NULL, 
    is_public BOOLEAN DEFAULT false NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_plants PRIMARY KEY (id), 
    CONSTRAINT uq_plants_slug UNIQUE (slug)
);

CREATE INDEX ix_plants_is_public ON plants (is_public);

CREATE TABLE plant_members (
    plant_id INTEGER NOT NULL, 
    user_id INTEGER NOT NULL, 
    role VARCHAR(10) NOT NULL, 
    CONSTRAINT pk_plant_members PRIMARY KEY (plant_id, user_id), 
    CONSTRAINT ck_plant_members_role CHECK (role IN ('owner', 'supervisor', 'viewer')), 
    CONSTRAINT fk_plant_members_plant_id_plants FOREIGN KEY(plant_id) REFERENCES plants (id) ON DELETE CASCADE, 
    CONSTRAINT fk_plant_members_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_plant_members_user_id ON plant_members (user_id);

CREATE TABLE machines (
    id SERIAL NOT NULL, 
    plant_id INTEGER NOT NULL, 
    slug VARCHAR(120) NOT NULL, 
    name VARCHAR(80) NOT NULL, 
    brand VARCHAR(80) DEFAULT '' NOT NULL, 
    model VARCHAR(80) DEFAULT '' NOT NULL, 
    host VARCHAR(253) NOT NULL, 
    port INTEGER DEFAULT '502' NOT NULL, 
    unit_id INTEGER DEFAULT '1' NOT NULL, 
    ideal_cycle_s FLOAT NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    photo_key VARCHAR(64), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_machines PRIMARY KEY (id), 
    CONSTRAINT uq_machines_plant_slug UNIQUE (plant_id, slug), 
    CONSTRAINT ck_machines_port CHECK (port BETWEEN 1 AND 65535), 
    CONSTRAINT ck_machines_unit_id CHECK (unit_id BETWEEN 1 AND 247), 
    CONSTRAINT ck_machines_ideal_cycle CHECK (ideal_cycle_s BETWEEN 0.1 AND 3600), 
    CONSTRAINT fk_machines_plant_id_plants FOREIGN KEY(plant_id) REFERENCES plants (id) ON DELETE CASCADE
);

CREATE INDEX ix_machines_plant_id ON machines (plant_id);

CREATE INDEX ix_machines_is_active ON machines (is_active);

CREATE TABLE shifts (
    id SERIAL NOT NULL, 
    plant_id INTEGER NOT NULL, 
    name VARCHAR(80) NOT NULL, 
    start_time TIME WITHOUT TIME ZONE NOT NULL, 
    end_time TIME WITHOUT TIME ZONE NOT NULL, 
    days_of_week INTEGER[] NOT NULL, 
    CONSTRAINT pk_shifts PRIMARY KEY (id), 
    CONSTRAINT ck_shifts_nonempty_interval CHECK (start_time <> end_time), 
    CONSTRAINT ck_shifts_days_of_week CHECK (cardinality(days_of_week) BETWEEN 1 AND 7 AND days_of_week <@ ARRAY[1,2,3,4,5,6,7]), 
    CONSTRAINT fk_shifts_plant_id_plants FOREIGN KEY(plant_id) REFERENCES plants (id) ON DELETE CASCADE
);

CREATE INDEX ix_shifts_plant_id ON shifts (plant_id);

CREATE TABLE downtime_reasons (
    code VARCHAR(32) NOT NULL, 
    label_es VARCHAR(120) NOT NULL, 
    label_en VARCHAR(120) NOT NULL, 
    category VARCHAR(20) NOT NULL, 
    CONSTRAINT pk_downtime_reasons PRIMARY KEY (code), 
    CONSTRAINT ck_downtime_reasons_category CHECK (category IN ('mecanica','electrica','material','calidad','organizacional','otro'))
);

CREATE TABLE machine_events (
    id SERIAL NOT NULL, 
    machine_id INTEGER NOT NULL, 
    state VARCHAR(7) NOT NULL, 
    reason_code VARCHAR(32), 
    comment TEXT, 
    classified_by INTEGER, 
    started_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    ended_at TIMESTAMP WITH TIME ZONE, 
    CONSTRAINT pk_machine_events PRIMARY KEY (id), 
    CONSTRAINT ck_machine_events_state CHECK (state IN ('RUNNING','IDLE','DOWN','OFFLINE')), 
    CONSTRAINT ck_machine_events_interval CHECK (ended_at IS NULL OR ended_at >= started_at), 
    CONSTRAINT fk_machine_events_machine_id_machines FOREIGN KEY(machine_id) REFERENCES machines (id) ON DELETE CASCADE, 
    CONSTRAINT fk_machine_events_classified_by_users FOREIGN KEY(classified_by) REFERENCES users (id) ON DELETE SET NULL
);

CREATE INDEX ix_machine_events_machine_started ON machine_events (machine_id, started_at);

CREATE UNIQUE INDEX uq_machine_events_open ON machine_events (machine_id) WHERE ended_at IS NULL;

CREATE TABLE production_minutes (
    machine_id INTEGER NOT NULL, 
    bucket_start TIMESTAMP WITH TIME ZONE NOT NULL, 
    good BIGINT DEFAULT '0' NOT NULL, 
    reject BIGINT DEFAULT '0' NOT NULL, 
    run_s FLOAT DEFAULT '0' NOT NULL, 
    idle_s FLOAT DEFAULT '0' NOT NULL, 
    down_s FLOAT DEFAULT '0' NOT NULL, 
    offline_s FLOAT DEFAULT '0' NOT NULL, 
    CONSTRAINT pk_production_minutes PRIMARY KEY (machine_id, bucket_start), 
    CONSTRAINT ck_production_minutes_counts CHECK (good >= 0 AND reject >= 0), 
    CONSTRAINT ck_production_minutes_durations CHECK (run_s >= 0 AND idle_s >= 0 AND down_s >= 0 AND offline_s >= 0), 
    CONSTRAINT fk_production_minutes_machine_id_machines FOREIGN KEY(machine_id) REFERENCES machines (id) ON DELETE CASCADE
);

CREATE TABLE production_samples (
    machine_id INTEGER NOT NULL, 
    sampled_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    good BIGINT DEFAULT '0' NOT NULL, 
    reject BIGINT DEFAULT '0' NOT NULL, 
    CONSTRAINT pk_production_samples PRIMARY KEY (machine_id, sampled_at), 
    CONSTRAINT ck_production_samples_counts CHECK (good >= 0 AND reject >= 0), 
    CONSTRAINT fk_production_samples_machine_id_machines FOREIGN KEY(machine_id) REFERENCES machines (id) ON DELETE CASCADE
);

CREATE TABLE alert_rules (
    id SERIAL NOT NULL, 
    plant_id INTEGER NOT NULL, 
    machine_id INTEGER, 
    type VARCHAR(20) NOT NULL, 
    threshold FLOAT, 
    duration_s INTEGER DEFAULT '180' NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    CONSTRAINT pk_alert_rules PRIMARY KEY (id), 
    CONSTRAINT ck_alert_rules_type CHECK (type IN ('MACHINE_DOWN','MACHINE_OFFLINE','OEE_BELOW')), 
    CONSTRAINT ck_alert_rules_threshold CHECK ((type = 'OEE_BELOW' AND threshold IS NOT NULL AND threshold BETWEEN 0 AND 1) OR (type <> 'OEE_BELOW' AND threshold IS NULL)), 
    CONSTRAINT ck_alert_rules_duration CHECK (duration_s BETWEEN 30 AND 86400), 
    CONSTRAINT fk_alert_rules_plant_id_plants FOREIGN KEY(plant_id) REFERENCES plants (id) ON DELETE CASCADE, 
    CONSTRAINT fk_alert_rules_machine_id_machines FOREIGN KEY(machine_id) REFERENCES machines (id) ON DELETE CASCADE
);

CREATE INDEX ix_alert_rules_plant_id ON alert_rules (plant_id);

CREATE INDEX ix_alert_rules_machine_id ON alert_rules (machine_id);

CREATE TABLE notifications (
    id SERIAL NOT NULL, 
    user_id INTEGER NOT NULL, 
    type VARCHAR(20) NOT NULL, 
    payload JSONB NOT NULL, 
    dedupe_key VARCHAR(255), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    read_at TIMESTAMP WITH TIME ZONE, 
    emailed_at TIMESTAMP WITH TIME ZONE, 
    CONSTRAINT pk_notifications PRIMARY KEY (id), 
    CONSTRAINT ck_notifications_type CHECK (type IN ('MACHINE_DOWN','MACHINE_OFFLINE','OEE_BELOW')), 
    CONSTRAINT uq_notifications_user_dedupe UNIQUE (user_id, dedupe_key), 
    CONSTRAINT fk_notifications_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_notifications_user_created ON notifications (user_id, created_at);

CREATE TABLE watchlist (
    user_id INTEGER NOT NULL, 
    machine_id INTEGER NOT NULL, 
    CONSTRAINT pk_watchlist PRIMARY KEY (user_id, machine_id), 
    CONSTRAINT fk_watchlist_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
    CONSTRAINT fk_watchlist_machine_id_machines FOREIGN KEY(machine_id) REFERENCES machines (id) ON DELETE CASCADE
);

CREATE INDEX ix_watchlist_machine_id ON watchlist (machine_id);

CREATE TABLE password_reset_tokens (
    token_hash VARCHAR(64) NOT NULL, 
    user_id INTEGER NOT NULL, 
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    used_at TIMESTAMP WITH TIME ZONE, 
    CONSTRAINT pk_password_reset_tokens PRIMARY KEY (token_hash), 
    CONSTRAINT fk_password_reset_tokens_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_password_reset_tokens_user_id ON password_reset_tokens (user_id);

CREATE INDEX ix_password_reset_tokens_expires_at ON password_reset_tokens (expires_at);

CREATE TABLE refresh_tokens (
    token_hash VARCHAR(64) NOT NULL, 
    user_id INTEGER NOT NULL, 
    family_id VARCHAR(64) NOT NULL, 
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    revoked_at TIMESTAMP WITH TIME ZONE, 
    CONSTRAINT pk_refresh_tokens PRIMARY KEY (token_hash), 
    CONSTRAINT fk_refresh_tokens_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX ix_refresh_tokens_user_id ON refresh_tokens (user_id);

CREATE INDEX ix_refresh_tokens_expires_at ON refresh_tokens (expires_at);

CREATE INDEX ix_refresh_tokens_family_id ON refresh_tokens (family_id);

INSERT INTO alembic_version (version_num) VALUES ('0001_initial') RETURNING alembic_version.version_num;

-- Running upgrade 0001_initial -> 0002_notification_delivery

ALTER TABLE notifications ADD COLUMN delivered_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX ix_notifications_pending ON notifications (created_at) WHERE delivered_at IS NULL;

UPDATE alembic_version SET version_num='0002_notification_delivery' WHERE alembic_version.version_num = '0001_initial';

-- Running upgrade 0002_notification_delivery -> 0003_machine_checkpoints

CREATE TABLE machine_checkpoints (
    machine_id INTEGER NOT NULL, 
    accounted_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    snapshot JSONB NOT NULL, 
    progress JSONB NOT NULL, 
    CONSTRAINT pk_machine_checkpoints PRIMARY KEY (machine_id), 
    CONSTRAINT fk_machine_checkpoints_machine_id_machines FOREIGN KEY(machine_id) REFERENCES machines (id) ON DELETE CASCADE
);

UPDATE alembic_version SET version_num='0003_machine_checkpoints' WHERE alembic_version.version_num = '0002_notification_delivery';

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

-- Running upgrade 0004_injection_context -> 0005_machine_board_positions

CREATE TABLE machine_board_positions (
    machine_id INTEGER NOT NULL, 
    x FLOAT NOT NULL, 
    y FLOAT NOT NULL, 
    width FLOAT NOT NULL, 
    height FLOAT NOT NULL, 
    rotation INTEGER DEFAULT '0' NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    CONSTRAINT pk_machine_board_positions PRIMARY KEY (machine_id), 
    CONSTRAINT ck_machine_board_positions_origin CHECK (x >= 0 AND x <= 1 AND y >= 0 AND y <= 1), 
    CONSTRAINT ck_machine_board_positions_size CHECK (width > 0 AND width <= 1 AND height > 0 AND height <= 1), 
    CONSTRAINT ck_machine_board_positions_bounds CHECK (x + width <= 1 AND y + height <= 1), 
    CONSTRAINT ck_machine_board_positions_rotation CHECK (rotation IN (0, 90, 180, 270)), 
    CONSTRAINT fk_machine_board_positions_machine_id_machines FOREIGN KEY(machine_id) REFERENCES machines (id) ON DELETE CASCADE
);

UPDATE alembic_version SET version_num='0005_machine_board_positions' WHERE alembic_version.version_num = '0004_injection_context';

COMMIT;

