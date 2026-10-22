BEGIN;

-- Run only against the reviewed Cloud SQL development database at revision 0004.
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
           WHERE version_num = '0004_injection_context'
       ) THEN
        RAISE EXCEPTION 'Expected revision 0004_injection_context; upgrade refused';
    END IF;
END
$cloudsql_guard$;

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

