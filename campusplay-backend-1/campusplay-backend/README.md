# CampusPlay backend

A standalone REST API for the CampusPlay React frontend. Includes password-hashed accounts, JWT authentication, student/organizer roles, persistent SQLite storage, revision-checked app snapshots, profile management, organizer account administration, audit logs, request validation, rate limiting, Helmet security headers, and configurable CORS.

## Requirements

- Node.js 20+
- npm

## Quick start

```bash
cp .env.example .env
```

Edit `.env` and set a unique `JWT_SECRET` (at least 32 characters) and a strong bootstrap organizer password. Then:

```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

API: `http://localhost:4000`  
Health check: `GET http://localhost:4000/api/health`

The optional bootstrap organizer is created only if `BOOTSTRAP_ORGANIZER_EMAIL` and `BOOTSTRAP_ORGANIZER_PASSWORD` are configured and that email does not already exist. Remove these values after first provisioning if desired. Public registration always creates a student; it cannot self-assign organizer privileges.

## API

All protected endpoints use `Authorization: Bearer <token>`.

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| GET | `/api/health` | Public | Health check |
| POST | `/api/auth/register` | Public | Create student account |
| POST | `/api/auth/login` | Public | Login |
| GET | `/api/auth/me` | Authenticated | Current account |
| GET | `/api/data` | Authenticated | Read current CampusPlay snapshot |
| PUT | `/api/data` | Organizer | Save snapshot with optional revision check |
| PATCH | `/api/auth/profile` | Authenticated | Update own profile |
| GET | `/api/admin/users` | Organizer | List accounts |
| PATCH | `/api/admin/users/:id/role` | Organizer | Change account role |
| GET | `/api/admin/audit-logs?limit=50` | Organizer | Read audit history |

### Registration example

```json
{
  "name": "Aarav Sharma",
  "email": "aarav@example.com",
  "password": "a-long-password",
  "collegeId": "CP240101",
  "department": "Computer Science",
  "year": "2nd Year",
  "section": "A"
}
```

### Login response

```json
{
  "user": { "id": "...", "name": "Aarav Sharma", "email": "aarav@example.com", "role": "student" },
  "token": "..."
}
```

### Snapshot persistence

`GET /api/data` returns `{ "data": null, "revision": 0 }` until the first save. An organizer can persist the existing frontend's `AppData` object:

```json
{
  "expectedRevision": 0,
  "data": {
    "version": 1,
    "users": [],
    "tournaments": [],
    "teams": [],
    "matches": [],
    "registrations": [],
    "notifications": [],
    "session": null,
    "theme": "light"
  }
}
```

The server returns a new revision. Send that revision as `expectedRevision` on the next save; a stale revision returns HTTP 409 rather than silently overwriting another organizer's changes. The snapshot intentionally preserves the frontend's existing data shape for an incremental migration.

## Connect the frontend

Add `VITE_API_URL=http://localhost:4000/api` to the frontend `.env`. Create an API client that stores the returned token and sends it as a Bearer token. Replace `signInDemo` with `/auth/login`, `addUser` with `/auth/register`, and replace localStorage persistence with `/data` requests. Keep the UI theme preference locally if desired. Do not send passwords or JWTs inside the app snapshot.

Example client:

```ts
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export async function api<T>(path: string, token?: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? 'Request failed');
  return body as T;
}
```

## Production notes

- Use HTTPS and a strong secret manager-provided `JWT_SECRET`.
- Set `CORS_ORIGIN` to the exact deployed frontend origin(s).
- Back up the SQLite database file. For a multi-instance deployment, migrate the Prisma datasource to PostgreSQL and use a shared database.
- Use a reverse proxy and persistent disk, or managed database storage.
- Configure monitoring, backups, and a password reset/email verification provider before public launch.
- This backend stores the app's domain state as a versioned JSON snapshot to preserve compatibility with the supplied frontend. It is not yet a normalized relational schema for each tournament, team, fixture, and registration. The current frontend also needs the API-client integration described above; the backend is not automatically wired into its React context.
