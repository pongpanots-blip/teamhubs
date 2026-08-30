# TeamHub

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
| `docker compose up --build` | Full stack (db + web) |

## Roles

`pm` · `ui` · `dev` — PM creates invites under Settings.
