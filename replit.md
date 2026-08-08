# Composer Studio

Turns one story brief into a rights-checked, sourced, multi-platform content package — with an AI editorial gate that decides whether the brief earns a slot. Ships as an Express API plus a built-in operator console served at the app root.

## Run & Operate

- `node artifacts/api-server/dist/index.mjs` — run the built server (API under `/api`, console at `/`). This is what `.replit` deploys.
- `pnpm --filter @workspace/api-server run dev` — build + run for local dev.
- `pnpm --filter @workspace/api-server run build` — esbuild bundle to `artifacts/api-server/dist`.
- `pnpm run typecheck` — full typecheck across all packages.
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only).
- **Demo mode:** set `COMPOSER_MOCK=1` — the whole app runs on realistic fixtures with zero external keys. Unset it (or `0`) for real mode.

### Environment / Secrets

| Var | Purpose |
| --- | --- |
| `COMPOSER_MOCK` | `1` = demo mode (no keys needed). Remove for real mode. |
| `DATABASE_URL` | Supabase Postgres (Transaction pooler, port 6543). Enables durable storage + real accounts. |
| `COMPOSER_API_KEY` | Shared/admin bearer key. With a DB, mint per-workspace keys instead. |
| `ANTHROPIC_API_KEY` | Real Editorial Director gate (Claude). Falls back to a heuristic when unset. |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Photo library + rights. |
| `SERPER_API_KEY` or `BRAVE_API_KEY` | Live market/competitor search. |
| `BEEHIIV_API_KEY` + `BEEHIIV_PUBLICATION_ID` | Publish drafts to beehiiv. |
| `CMS_WEBHOOK_URL` | Push packages to a CMS. |

Integration keys (Cloudinary / search / beehiiv / Anthropic) can also be sent **per request** by each workspace, so they don't have to be set globally.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5; bundled with esbuild (ESM)
- DB: PostgreSQL (Supabase) + Drizzle ORM
- LLM: `@anthropic-ai/sdk` (claude-opus-5) for the editorial gate
- Deploy: `.replit` autoscale, runs the bundled server directly

## Where things live

- **Engine:** `artifacts/api-server/src/engine/` — `compose.ts`, `newsletter.ts`, `assets.ts`, `store.ts` (dual-mode: Postgres when `DATABASE_URL` set, else in-memory), `llm.ts` (Claude gate), `apikeys.ts` (multi-tenant keys), `billing.ts` (shell).
- **Adapters (the seam):** `engine/adapters/{mock,real}/` + `index.ts` (hybrid factory), `keys.ts` (per-request `WorkspaceKeys`).
- **HTTP:** `src/routes/rest.ts` (REST shim, auth + rate limit), `src/routes/mcp.ts` (MCP), `src/ui.ts` (operator console, served at `/` by `src/app.ts`).
- **DB schema (source of truth):** `lib/db/src/schema/composer.ts`.

## Architecture decisions

- **Adapter seam degrades honestly.** Every capability is a pluggable adapter; real adapters activate when configured (per-request keys override env) and fall back to mocks otherwise — the pipeline never breaks, it names the gap.
- **Storage is dual-mode.** `store.ts` uses Postgres when `DATABASE_URL` is set (real mode), else an in-memory/file store. `@workspace/db` is imported lazily so it never throws when no DB is configured.
- **Multi-tenant by API key.** Bearer tokens resolve to an org via a SHA-256 hash in `composer_api_keys`; with a DB provisioned, unknown keys are rejected.
- **The editorial gate is the differentiator.** `llm.ts` calls Claude for the five-gate evaluation and falls back to a heuristic on any failure (no key, refusal, bad output).
- **The console rides on the API server** (`ui.ts` served at `/`), so there's one thing to deploy and no CORS.

## Gotchas

- **Use pnpm 10 locally.** `node_modules` is linked from store v10 — run `corepack pnpm@10 …`. Corepack's default (pnpm 11) tries to purge and fails without a TTY.
- **Real mode + `DATABASE_URL` rejects unknown keys** — mint one (see `engine/apikeys.ts` `createApiKey`) before calling the API.
- `COMPOSER_MOCK=1` is set in `.replit` for a safe first deploy; remove it in Secrets to go real.

## Product

- **Compose package** — brief → editorial verdict + gates, matched assets with rights, sourced market context, deliverables.
- **Newsletter batch** — paste a full edition → per-story asset packages + one hero pick.
- **Asset search** and **rights check** across configured libraries.
- **Send** — beehiiv draft, CMS webhook, or download bundle.
- **Billing** — plans + subscriptions scaffold (Stripe not yet wired).

## Deploy (Replit)

`.replit` builds `@workspace/api-server` and runs `node artifacts/api-server/dist/index.mjs` on autoscale (`PORT=8080`). The console is at the deployment root; the API is under `/api`. First deploy runs in demo mode (`COMPOSER_MOCK=1`); switch to real mode via Secrets.
