# IntrovertHubs

Web app for a small team (PM + UI + Devs): Context Engine (docs RAG, GitHub, Figma) → Claude structured JSON → Deterministic Engine (readiness / dependency / status).

## Stack

- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- PostgreSQL 16 + pgvector (Docker Compose)
- Prisma + Better Auth (email/password, team invites & roles)
- Anthropic Claude API (`ANTHROPIC_API_KEY`; offline fallback when unset)
- Local / Voyage / OpenAI embeddings (`EMBEDDING_PROVIDER`)

## Quick start

```bash
cp .env.example .env
pnpm install
# Prefer Docker when Desktop is running:
pnpm db:up
# Or use local Postgres with pgvector, then set DATABASE_URL in .env
pnpm exec prisma db push   # or: pnpm db:migrate
pnpm dev
```

Open http://localhost:3000 — register → create team → ingest docs → create task → **Run context**.

Smoke without UI (requires DB + migrated schema):

```bash
pnpm smoke
```

## Scripts

| Script | Purpose |
|--------|---------|
| `pnpm db:up` | Start Postgres+pgvector |
| `pnpm db:migrate` | Prisma migrate |
| `pnpm docs:ingest` | CLI ingest for a team (see script) |
| `pnpm smoke` | End-to-end smoke without UI |
| `pnpm check:business-time` | Weekend-aware duration maths |
| `pnpm snapshot:flow` | One-off board census for the CFD (the daily job does this on a schedule) |
| `docker compose up --build` | Full stack (db + web) |

## Working time

Every flow duration — cycle time, lead time, WIP age, time in status, and the
service level built from them — counts working time only. Weekends are removed
whole; nights are not, since cutting those would need per-person hours the app
does not have. `BUSINESS_UTC_OFFSET_MINUTES` (default 420, UTC+7) decides where
a weekend starts, so a Friday evening in Bangkok is not filed as a Saturday.

## Daily flow snapshot

The Cumulative Flow Diagram on each project's Analytics page reads a daily
census of the board rather than replaying every status change. `docker compose
up` starts a `snapshot` service that POSTs to `/api/cron/snapshot` at 23:50 UTC
— the row dated D then reflects the board on day D.

Set `CRON_SECRET` in `.env` first: with it unset the endpoint returns 503 and
the service exits, since an unauthenticated endpoint that walks every project
is worse than a missing chart. Re-running it for the same day overwrites that
day's rows, so a retry cannot double-count.

Any other scheduler works the same way — host cron, a platform cron trigger, a
Kubernetes CronJob:

```bash
curl -fsS -X POST https://your-host/api/cron/snapshot -H "Authorization: Bearer $CRON_SECRET"
```

Outside a deployment, `pnpm snapshot:flow` writes today's rows directly.

## Roles

`pm` · `ui` · `dev` — PM creates invites under Settings.
