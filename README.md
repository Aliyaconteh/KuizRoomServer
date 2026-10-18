# KuizRoom Backend

Node.js, Express, Socket.IO, and Supabase backend for a real-time multiplayer quiz system.

## Requirements Covered

- Password signup/login with bcrypt-hashed passwords and mandatory email verification; Google sign-in is validated through Supabase Auth.
- Guest room joining with nickname validation.
- Quiz and question CRUD endpoints.
- Unique quiz room creation with room codes.
- Server-authoritative quiz flow with synchronized question timers.
- Answer validation, duplicate-submission prevention, scoring, and live leaderboard updates.
- Optimistic synchronization support with score reconciliation events.
- Network delay simulation using room delay settings.
- Synchronization metrics logging for latency, score mismatch, and reconciliation analysis.
- Session results and final leaderboard persistence.

## Setup

Create `Server/.env` using this shape:

```env
PORT=5000
JWT_SECRET=replace-with-a-long-random-secret
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
GEMINI_API_KEY=your-gemini-api-key
GMAIL_USER=your-address@gmail.com
GMAIL_APP_PASSWORD=your-16-character-app-password
EMAIL_FROM=KuizRoom <your-address@gmail.com>
CLIENT_URL=http://localhost:5173
```

AI quiz generation and tutor chat use Google's Interactions API with the `gemini-3.8-flash` model. Set `GEMINI_API_KEY` in the server environment; never expose it in the client.

For Gmail delivery, enable 2-Step Verification on the sending Google account and create a Google App Password. Use that App Password as `GMAIL_APP_PASSWORD` (not the normal Gmail password). Set `CLIENT_URL` to the deployed frontend origin in production. Never commit real credentials.

Run the SQL in `src/database/schema.sql` in Supabase before starting the API. The schema adds verification fields to the existing `users` table; existing users are treated as verified, while new password-based accounts must use the emailed link before signing in.

Set a unique `JWT_SECRET` in every environment; use at least 32 random characters in production. For production, also set `NODE_ENV=production` and the exact public frontend origin in `CLIENT_URL` (for example, `https://kuizroom.example`). Add any additional frontend origins to `CLIENT_ORIGINS` as a comma-separated list. The frontend build must use `VITE_API_BASE_URL` set to the public backend origin; do not include a trailing slash. Keep all server credentials in the hosting provider's secret/environment settings, never in the frontend or source control.

## Security Notes

- Database access uses Supabase's query builder with values passed as filter/insert/update parameters. Do not build SQL strings from request data. The old database compatibility helpers intentionally reject raw SQL.
- The API rejects JSON and URL-encoded bodies larger than 100 KB and applies a general request limit; authentication and AI endpoints have additional limits. These in-memory limits protect a single server process only. Use a shared rate-limit store when running multiple instances.
- Socket.IO limits each inbound message to 64 KB and disconnects clients that send more than 100 events in 10 seconds. Guest joining remains available; room-start and quiz-end events require the authenticated room host.
- Guest player sessions are represented by server-signed, room-scoped tokens; answer submissions are bound to the registered player record rather than the username/player ID supplied in each answer.
- Room codes use cryptographically secure random generation and accept only six uppercase letters or digits.
- Quiz answer keys are withheld from the review endpoint until the room is finished, and public synchronization exports omit player, user, and database room identifiers.
- The public development seed endpoint has been removed. Seed test data through a controlled development-only script or directly in a non-production database.
- In production, configure the hosting proxy and Express `trust proxy` setting to match the exact number of trusted proxy hops before relying on IP-based rate limits. Do not blindly trust forwarded IP headers.
- Set `TRUST_PROXY_HOPS` to that trusted hop count (default `0`). The server rejects values outside `0` through `10`.

## Run

```bash
cd Server
npm install
npm run dev
```

The API health check is available at:

```txt
GET /health
```

## Main REST Routes

- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/verify-email`
- `POST /auth/resend-verification`
- `GET /api/quizzes`
- `POST /api/quizzes`
- `POST /api/quizzes/question`
- `POST /api/rooms/create`
- `POST /api/rooms/join`
- `GET /api/rooms/:roomCode`
- `GET /api/leaderboard/:roomCode`
- `GET /api/leaderboard/:roomCode/final`
- `GET /api/sync/:roomCode/logs`
- `GET /api/sync/:roomCode/summary`

## Main Socket.IO Events

Client to server:

- `create-room`
- `join-room`
- `start-quiz`
- `submit-answer`
- `next-question`
- `optimistic-answer`
- `confirm-answer`
- `sync-reconcile`

Server to client:

- `room-created`
- `player-joined`
- `question-started`
- `timer-update`
- `leaderboard-update`
- `server-confirmation`
- `sync-reconciliation`
- `quiz-ended`
