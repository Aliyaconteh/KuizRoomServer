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

Create `Backend/.env` using this shape:

```env
PORT=5000
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
GMAIL_USER=your-address@gmail.com
GMAIL_APP_PASSWORD=your-16-character-app-password
EMAIL_FROM=KuizRoom <your-address@gmail.com>
CLIENT_URL=http://localhost:5173
```

For Gmail delivery, enable 2-Step Verification on the sending Google account and create a Google App Password. Use that App Password as `GMAIL_APP_PASSWORD` (not the normal Gmail password). Set `CLIENT_URL` to the deployed frontend origin in production. Never commit real credentials.

Run the SQL in `src/database/schema.sql` in Supabase before starting the API. The schema adds verification fields to the existing `users` table; existing users are treated as verified, while new password-based accounts must use the emailed link before signing in.

For production, set `NODE_ENV=production`, a long random `JWT_SECRET`, and the exact public frontend origin in `CLIENT_URL` (for example, `https://kuizroom.example`). Add any additional frontend origins to `CLIENT_ORIGINS` as a comma-separated list. The frontend build must use `VITE_API_BASE_URL` set to the public backend origin; do not include a trailing slash. Keep all server credentials in the hosting provider's secret/environment settings, never in the frontend or source control.

## Run

```bash
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
