#!/bin/sh
set -eu

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=ON_ERROR_STOP=1 \
  --set=app_role="$DB_USER" \
  --set=app_password="$DB_PASSWORD" \
  --set=app_database="$POSTGRES_DB" <<'SQL'
SELECT format(
    'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
    :'app_role',
    :'app_password'
)
WHERE NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = :'app_role'
)
\gexec

GRANT CONNECT ON DATABASE :"app_database" TO :"app_role";
GRANT USAGE, CREATE ON SCHEMA public TO :"app_role";
SQL
