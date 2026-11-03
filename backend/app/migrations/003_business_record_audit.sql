ALTER TABLE businesses ALTER COLUMN source_row DROP NOT NULL;

-- Audit columns store auth_users.user_id values. They intentionally avoid a
-- foreign key because existing deployments may own auth_users under a
-- different role than the runtime role that applies migrations.
ALTER TABLE businesses
    ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN created_by BIGINT,
    ADD COLUMN updated_by BIGINT;
