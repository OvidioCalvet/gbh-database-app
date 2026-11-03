# Authentication API contract

The React app expects the FastAPI service to expose these same-origin routes under `/api/v1/auth`.

## `POST /login`

Request JSON:

```json
{ "username": "researcher", "password": "example-password" }
```

On success, return `200` JSON and set the server-managed session cookie:

```json
{ "user": { "username": "researcher", "displayName": "Researcher Name" } }
```

Return `401` for invalid credentials. The UI never persists the password or session secret in browser storage.

## `GET /me`

Return the same `200` user envelope when the session is valid, or `401` when there is no valid session.

## `POST /logout`

Invalidate the session and clear its cookie; return `204` on success.

## Session and deployment expectations

- Set the session cookie as `HttpOnly`, `Secure` in production, `SameSite=Lax`, and `Path=/`.
- Serve the React app and API on the same origin in production, proxying `/api` to FastAPI.
- In local development, Vite proxies `/api` to `http://127.0.0.1:8000` by default; set `API_PROXY_TARGET` to override it.
- The Compose frontend serves the built React app through Nginx and proxies `/api` to the backend container, so production requests stay same-origin.
- Validate request origins/CSRF protections for state-changing routes. Authentication and write permissions must be enforced by FastAPI; hiding React controls is not authorization.
- The `/data-entry` screen is gated in the UI, but its future record endpoints must independently require an authenticated researcher.

# Business records API contract

These routes are public and read-only.

## `GET /api/v1/businesses`

Query parameters:

- `offset` — zero-based row offset, default `0`
- `limit` — page size from `1` to `100`, default `25`
- `q` — optional case-insensitive search across business name, owner, address, and industry
- `industry` — optional exact `broad_industry` filter

Response:

```json
{
  "items": [
    {
      "id": 1,
      "bizId": "BIZ_D8B8C78BAE90",
      "businessName": "Johnson Brothers",
      "broadIndustry": "Food Industry and Trade",
      "specificIndustry": "Groceries",
      "appearanceDecade": "1900s",
      "sourceYear": 1903,
      "race": "Black",
      "gender": "Male",
      "ownerName": null,
      "address": "608 SW 4th Ave, Gainesville, Florida"
    }
  ],
  "total": 6878,
  "offset": 0,
  "limit": 25
}
```

## `GET /api/v1/businesses/industries`

Returns the distinct broad industries and their record counts, ordered by count descending:

```json
{ "items": [{ "name": "Retail Trade", "count": 1234 }] }
```

The database page requests 25 records per page and advances with `offset`.
