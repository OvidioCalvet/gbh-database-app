<div align="center">
    <br>
    <header>
        <h3>
            <b>gbh.app</b>
        </h3>
    </header>
    <br>
    <br>
</div>

# Gainesville Business History

The application is split into three Docker Compose services:

- **frontend** — React/Vite build served by Nginx; Nginx forwards `/api` requests to FastAPI.
- **backend** — FastAPI, `asyncpg`, cookie-based researcher sessions, and versioned SQL migrations.
- **db** — PostgreSQL with a persistent Compose volume and a separate, least-privilege API role.

## Local Compose setup

```bash
cp .env.example .env
# Keep the example database password local; use new secrets for any shared deployment.
docker compose -f compose.yaml -f compose.dev.yaml up --build -d
```

Open <http://localhost:8080>. The development-only researcher login is:

- Username: `admin`
- Password: `password`

These credentials are enabled only by `compose.dev.yaml`; do not use that override in production. The production Compose configuration does not create a default account.

## Researcher accounts

Create an account from the backend container; the command prompts for the password and stores an Argon2id hash:

```bash
docker compose -f compose.yaml -f compose.dev.yaml exec backend \
  python -m app.cli create-user researcher-name
```

Add `--admin` only when the account needs administrator privileges. To reset a password:

```bash
docker compose -f compose.yaml -f compose.dev.yaml exec backend \
  python -m app.cli set-password researcher-name
```

## Import users from the old Dash app

The importer reads the legacy SQLite file read-only, preserves usernames, admin flags, and password hashes, and never prints credentials. Legacy Werkzeug PBKDF2 hashes are upgraded to Argon2id after a successful login.

```bash
docker compose -f compose.yaml -f compose.dev.yaml run --rm \
  -v "/path/to/GBHDashApp/users.db:/run/legacy-users.db:ro" \
  backend python -m app.cli import-legacy-users /run/legacy-users.db
```

The dev `admin` account is reserved for the `admin` / `password` test login; an imported legacy `admin` account is linked to that local account, while other legacy accounts retain their existing hashes. In production, run the base Compose file without `compose.dev.yaml`; the importer then brings across all accounts. Reset any known default legacy password before public deployment:

```bash
docker compose -f compose.yaml run --rm backend \
  python -m app.cli set-password admin
```

For a fresh production database without migrated accounts, create the first admin through the same CLI; it prompts for a new password and does not use the development default:

```bash
docker compose -f compose.yaml run --rm backend \
  python -m app.cli create-user admin --admin
```

## Import business records

The importer replaces the `businesses` table from the CSV export. It cleans each value to match the column type: years become integers, coordinates become numbers, flags become booleans, invalid placeholders become `NULL`, and exact duplicate rows are removed. The original CSV is never modified.

```bash
docker compose -f compose.yaml -f compose.dev.yaml run --rm \
  -v "$PWD/Data_Cleaning_New - Data1.csv:/run/businesses.csv:ro" \
  backend python -m app.cli import-businesses /run/businesses.csv
```

Re-running the command replaces the table rather than appending duplicates. The public database page reads from `GET /api/v1/businesses` and shows 25 records per page.

## Production deployment notes

Copy `.env.example` to `.env`, set unique PostgreSQL admin and app passwords and the real HTTPS frontend origin in `ALLOWED_ORIGINS`, and use `APP_ENV=production` with `SESSION_COOKIE_SECURE=true`. Deploy with:

```bash
docker compose -f compose.yaml up --build -d
```

The frontend container serves HTTP internally; terminate HTTPS at the existing AWS reverse proxy or load balancer and forward to the configured `APP_PORT`. Do not expose PostgreSQL publicly. The named `postgres_data` volume persists database files, but production backups must be stored separately from the EC2 instance and periodically restore-tested.

## Checks

```bash
docker compose -f compose.yaml -f compose.dev.yaml exec backend pytest -q
```

For frontend-only checks, run `npm run lint` and `npm run build` from `frontend/`.
