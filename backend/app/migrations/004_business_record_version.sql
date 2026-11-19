-- Optimistic concurrency token for researcher edits. Clients read `version`
-- with the record and must send it back as `expectedVersion` when saving; a
-- successful PATCH increments it. Existing rows start at 1 via the default.
ALTER TABLE businesses
    ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
