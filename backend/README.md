# CampusPlay Backend (Complete API Starter)

Node.js + Express + Prisma + SQLite backend covering authentication, profiles, tournaments, teams/rosters, registrations, fixtures/live scores, results/standings, notifications, and organizer analytics.

## Requirements
- Node.js 18+ (20+ recommended)
- npm

## Setup (Windows PowerShell)
```powershell
cd backend
Copy-Item .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run dev
```
API: `http://localhost:5000/api`; health: `http://localhost:5000/api/health`.
Frontend `.env`: `VITE_API_BASE_URL=http://localhost:5000/api` (or `VITE_API_URL` if your client uses that name).

## Demo accounts
- Organizer: `sports@campus.edu` / `password123`
- Students: `student1@campus.edu` through `student12@campus.edu` / `password123`

## API groups
- Auth: `/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me`
- Users: `/users/profile`, `/users/change-password`, organizer `/users`
- Tournaments: CRUD `/tournaments`, `/tournaments/:id/teams|fixtures|participants`
- Teams: CRUD `/teams`, players, captain
- Registrations: `/registrations`, `/registrations/my`, status approval
- Matches: `/matches`, score patch, scheduling and venue conflict checks
- Results: `/results`, `/results/:matchId`, `/results/leaderboard/:tournamentId`
- Notifications: inbox, unread count, mark read/all
- Analytics: dashboard, participation, performance

All protected requests use `Authorization: Bearer <token>`. Organizer-only routes require role `organizer` or `admin`.

## Notes / limitations
- SQLite is the default for quick local development. For production, configure an appropriate database provider and migrate the Prisma schema.
- Password reset endpoints intentionally return 501 until an email provider/token delivery flow is configured.
- The API is a complete domain backend starter, but frontend integration still requires checking your exact `src/services/*.ts` request shapes and adapting field names as needed. Run and test all flows before describing the deployment as production-ready.
