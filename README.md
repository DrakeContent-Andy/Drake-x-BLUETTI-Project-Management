# Drake Content × BLUETTI — Project Management Portal

A multi-user web app (Express + Postgres) with the original portal UI, role-based
access, and automated Slack posts. Replaces the old single-file localStorage version.

## What it does

- **Shared data** — projects, tasks, monthly goals, and assignees live in Postgres,
  so everyone who opens the URL sees the same live data (auto-refreshes every 30s).
- **Three roles** (passwords set via env vars):
  - `admin` — full access including dollar values, monthly summaries, and the Slack/automation panel.
  - `team` — everything except dollar values/billing.
  - `client` — read-only monthly delivery summary (only projects flagged "show on client dashboard").
  - Role scoping is enforced **server-side** — values are never sent to non-admins.
- **Slack automation** (admin-configurable):
  - Weekly post of tasks due this week, grouped by assignee, with status + project.
  - Weekly overdue reminder, grouped by assignee.
  - Monthly summary of completed projects, deliverables, and total value.
  - Channel, day, and time configurable from the in-app **Slack & Automation** panel.

## Project layout

```
server/
  index.js          Express entry — API + serves /public
  env.js            Loads .env locally (no-op on hosts that inject env vars)
  db.js             Postgres pool + schema init
  seed.js           Default data; auto-seeds on first boot, or `npm run seed`
  auth.js           Login + signed role tokens
  routes/           state, projects, tasks, goals, settings
  slack/            client (Web API), messages (post builders), tick (cron + admin endpoints)
public/index.html   The portal UI (localStorage swapped for API calls)
```

## Tech / cost

Everything below has a **free tier with no credit card required**:

| Piece      | Service       | Notes |
|------------|---------------|-------|
| Database   | **Neon**      | Serverless Postgres, free, no expiry. |
| App host   | **Render**    | Free web service (sleeps when idle; the cron pinger keeps it warm). |
| Scheduler  | **cron-job.org** | Pings `/api/cron/tick` every 15 min to drive Slack posts. |

---

## Setup

### 1. Database — Neon

1. Sign up at https://neon.tech (free, no card).
2. Create a project. Copy the **connection string** (it looks like
   `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require`).
3. Keep it for `DATABASE_URL` below.

### 2. Slack app (bot token)

1. Go to https://api.slack.com/apps → **Create New App** → *From scratch*.
2. **OAuth & Permissions** → Bot Token Scopes, add:
   `chat:write`, `channels:read`, `groups:read`.
3. **Install to Workspace**, then copy the **Bot User OAuth Token** (`xoxb-…`) → `SLACK_BOT_TOKEN`.
4. In Slack, invite the bot to each channel it should post in: `/invite @YourBotName`.

### 3. Deploy — Render

1. Push this folder to a GitHub repo.
2. Render → **New → Blueprint**, connect the repo (it reads `render.yaml`).
3. Set these environment variables in the Render dashboard:
   - `DATABASE_URL` — from Neon.
   - `AUTH_SECRET` — long random string: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `CRON_SECRET` — another long random string (same command).
   - `SLACK_BOT_TOKEN` — `xoxb-…` from step 2.
   - `ADMIN_PASSWORD`, `TEAM_PASSWORD`, `CLIENT_PASSWORD` — the three login passwords you chose (set them here only; they are never stored in the code).
4. Deploy. On first boot it creates the tables and seeds the current data automatically.
5. Visit the Render URL — you should see the login screen.

### 4. Scheduler — cron-job.org

This drives the scheduled Slack posts (and keeps the free Render service awake).

1. Sign up at https://cron-job.org (free).
2. Create a cron job:
   - **URL:** `https://YOUR-RENDER-URL.onrender.com/api/cron/tick?secret=YOUR_CRON_SECRET`
   - **Method:** POST
   - **Schedule:** every 15 minutes.
3. Save. The server checks the admin-configured day/time on each tick and posts when
   due — with built-in dedupe so it never double-posts.

### 5. Configure Slack posts in the app

Log in as admin → **Slack & Automation**:
- Toggle **Enable scheduled posts**.
- Pick the channel, day, and time for the weekly summary, overdue reminder, and monthly summary.
- Use **Send test** to confirm the bot can post, and **Post now** to fire a message immediately.

---

## Running locally

Requires Node 18+.

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL (Neon works fine for local too)
npm start                 # http://localhost:3000
```

`npm run seed` re-runs the seed (only inserts if the projects table is empty).

## Notes

- The Slack **bot token** lives only in `SLACK_BOT_TOKEN` (env), never in the database
  and never sent to the browser. Channels/timing are stored in the DB.
- To change passwords, update the env vars and redeploy.
- Data edits use granular REST endpoints, so concurrent editors don't clobber each other.
