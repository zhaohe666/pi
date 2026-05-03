# ImgKits Clone

An AI image & video editor clone of [imgkits.com](https://www.imgkits.com/) with a fully-featured admin panel.

- **Backend**: Node.js + Express + Swagger / OpenAPI 3.0
- **Database**: SQLite (better-sqlite3) with WAL journal, foreign keys, indexed schema
- **Public site**: Vanilla HTML/CSS/JS in imgkits style (gradient hero, tool grid, pricing, modal editor)
- **Admin panel**: Single-page app with login, dashboard, jobs, users, tools, API keys, settings, audit logs

## Quick start

```bash
npm install
npm start          # production mode (NODE_ENV=production)
# or
npm run dev        # development with request logging
```

Then open:

| What | URL |
| --- | --- |
| Public site | <http://localhost:3000> |
| **Admin panel** | <http://localhost:3000/admin> |
| Swagger UI | <http://localhost:3000/api/docs> |
| OpenAPI JSON | <http://localhost:3000/api/openapi.json> |
| Health check | <http://localhost:3000/api/health> |

### Default credentials

The seed script creates these accounts on first run:

| Email | Password | Role |
| --- | --- | --- |
| `admin@imgkits.local` | `admin123` | admin |
| `alice@example.com` | `demo` | user (pro) |
| `bob@example.com` | `demo` | user (free) |
| `carol@example.com` | `demo` | user (suspended) |

## Database

SQLite file lives at `data/imgkits.db` (configurable via `DB_PATH` env var). Schema and seed run automatically on boot. Tables:

- `users` — accounts with role, status, plan, credits
- `sessions` — bearer tokens with expiry
- `tools` — registry of AI tools (slug, name, credits, enabled)
- `jobs` — every processing job with status & result url
- `api_keys` — hashed API keys per user
- `settings` — key-value system settings
- `audit_logs` — every admin action, capped at 1000 rows

Reset and re-seed:
```bash
npm run db:reset
```

## Admin panel features

| Page | What it does |
| --- | --- |
| Dashboard | KPIs, 7-day trend bar chart, status & tool breakdowns, MRR |
| Jobs | Filter by status / tool / id, retry, delete |
| Users | Search, create, edit credits/role/plan, suspend/activate, delete |
| Tools | Toggle enabled/disabled, edit credits per call |
| API Keys | Generate (plain key shown once), revoke |
| Settings | Site name, maintenance mode, signups, free credits, upload limit |
| Audit Logs | Last 100 admin actions |

## Public API endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET  | `/api/health` | Service health check |
| GET  | `/api/tools`  | List enabled AI tools |
| POST | `/api/tools/background-remover` | Remove image background |
| POST | `/api/tools/background-replace` | Replace background with AI scene |
| POST | `/api/tools/photo-restore` | Restore old / damaged photos |
| POST | `/api/tools/unblur` | Sharpen blurry images |
| POST | `/api/tools/upscale` | Upscale up to 8x |
| POST | `/api/tools/object-remove` | Remove objects via mask |
| POST | `/api/tools/style-transfer` | Photo to anime / pixar / sketch / etc. |
| POST | `/api/tools/flyer-generator` | Generate flyer from prompt |
| POST | `/api/tools/fantasy-map` | Generate fantasy map |
| GET  | `/api/jobs` | List recent jobs |
| GET  | `/api/jobs/{jobId}` | Poll job status / result |

## Auth & admin endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/auth/login` | Email + password to bearer token |
| POST | `/api/auth/logout` | Invalidate token |
| GET  | `/api/auth/me` | Current user |
| GET  | `/api/admin/stats` | Dashboard aggregates |
| GET/POST | `/api/admin/users` | List / create users |
| PATCH/DELETE | `/api/admin/users/{id}` | Update / delete user |
| GET  | `/api/admin/jobs` | List jobs (q, status, tool filters) |
| POST | `/api/admin/jobs/{id}/retry` | Re-queue job |
| DELETE | `/api/admin/jobs/{id}` | Delete job |
| GET/PATCH | `/api/admin/tools` | List / update tools |
| GET/POST | `/api/admin/api-keys` | List / generate API keys |
| DELETE | `/api/admin/api-keys/{id}` | Revoke key |
| GET/PUT | `/api/admin/settings` | Read / update system settings |
| GET  | `/api/admin/audit-logs` | Recent admin actions |

All admin endpoints require `Authorization: Bearer <token>` from a user with `role === 'admin'`.

## Production mode

`npm start` runs `NODE_ENV=production node backend/server.js` which enables:

- HSTS header (`Strict-Transport-Security`)
- 1-day cache for static assets
- Hidden error stack traces
- `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` headers
- Graceful SIGTERM/SIGINT shutdown
- `trust proxy` for running behind nginx / cloudflare

Environment variables:

| Var | Default | Notes |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `NODE_ENV` | `development` | `production` enables prod hardening |
| `DB_PATH` | `./data/imgkits.db` | SQLite file location |
| `CORS_ORIGIN` | `*` | Restrict CORS to a single origin in prod |

## Project layout

```
backend/
  server.js              Express app, Swagger setup, security headers, SPA fallback
  store.js               Data access layer (wraps SQLite)
  middleware/auth.js     Bearer token + role guards
  routes/api.js          Public AI tool & job endpoints
  routes/admin.js        Auth + admin CRUD endpoints
  db/
    index.js             better-sqlite3 connection, schema bootstrap
    schema.sql           Tables, indexes, FKs
    seed.js              Default users, tools, settings (idempotent)
public/
  index.html             Public marketing site
  css/styles.css         Shared theme (purple→cyan gradients)
  js/app.js              Loads tools, runs jobs from public site
  admin/
    index.html           Admin SPA shell + login view
    admin.css            Admin layout, sidebar, tables, toasts
    admin.js             Hash router, all admin pages, auth flow
data/
  imgkits.db             SQLite database (auto-created, gitignored)
```
