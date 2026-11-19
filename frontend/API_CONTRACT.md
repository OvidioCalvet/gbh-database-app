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
- The `/data-entry` screen is gated in the UI, and the create/update endpoints independently require an authenticated researcher.

# Business records API contract

The list, detail, and industry routes are public. Creating and updating records requires a valid researcher session, a trusted `Origin` header, and is limited to one record per request.

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

## `GET /api/v1/businesses/{id}`

Returns one record with every editable field plus audit metadata:

```json
{
  "id": 1,
  "version": 1,
  "bizId": "BIZ_D8B8C78BAE90",
  "businessName": "Johnson Brothers",
  "sourceYear": 1903,
  "foundingYear": null,
  "firstAppearance": 1903,
  "appearanceDecade": "1900s",
  "endYear": null,
  "ifClosed": true,
  "broadIndustry": "Food Industry and Trade",
  "specificIndustry": "Groceries",
  "race": "Black",
  "gender": "Male",
  "ownerName": null,
  "ownershipType": null,
  "ownershipDemographic": null,
  "address": "608 SW 4th Ave, Gainesville, Florida",
  "postal": null,
  "pointX": null,
  "pointY": null,
  "oldAddress": null,
  "phoneNumber": null,
  "website": null,
  "socialMedia": null,
  "facebookUrl": null,
  "instagramUrl": null,
  "youtubeUrl": null,
  "xUrl": null,
  "linkedinUrl": null,
  "sourceId": null,
  "newspaper": null,
  "cityDirectories": null,
  "googleModernBusiness": null,
  "linkOhInterview": null,
  "linkGbhStory": null,
  "notes": null,
  "createdAt": "2026-11-03T13:18:00.344251Z",
  "updatedAt": "2026-11-03T13:18:00.344251Z",
  "createdBy": "admin",
  "updatedBy": "admin"
}
```

Return `404` when the record does not exist.

## `POST /api/v1/businesses`

Requires the session cookie and `Origin: <allowed origin>`. Only `businessName` is required. Send camelCase fields from the detail response, excluding `id`, `createdAt`, `updatedAt`, `createdBy`, and `updatedBy`. When `bizId` is omitted or blank, the server generates one such as `BIZ_MANUAL_66E1890D4881`.

```json
{
  "businessName": "Johnson Brothers",
  "sourceYear": 1903,
  "appearanceDecade": "1900s",
  "broadIndustry": "Food Industry and Trade",
  "specificIndustry": "Groceries",
  "ifClosed": true,
  "notes": "Added by a researcher."
}
```

Returns `201` with the full record; its `version` starts at `1`. Returns `401` without a session, `403` for an untrusted or missing origin, and `422` for invalid years, postal codes, decades, coordinates, or an empty business name.

## `PATCH /api/v1/businesses/{id}`

Requires the session cookie and `Origin: <allowed origin>`. Send only the fields to change plus `expectedVersion`, the `version` value most recently read from the record; omitted fields keep their current values and explicit `null` clears an optional field. `businessName` and `bizId` cannot be cleared. Every successful save increments `version`. If the stored version no longer matches `expectedVersion`, the server returns `409 Conflict` without writing any changes and the client must reload the record before saving again. Returns the updated record, `404` for a missing record, `422` when `expectedVersion` is missing or invalid, and sets `updatedAt` / `updatedBy` from the session.

```json
{
  "notes": "Updated by a researcher.",
  "expectedVersion": 1
}
```

## Audit behavior

`createdBy` and `updatedBy` contain the username of the researcher who made the change. Imported CSV rows keep `null` audit users until a researcher edits them.

The database page requests 25 records per page and advances with `offset`. The `/data-entry` page uses these write routes for the add and find-and-update workflows.
