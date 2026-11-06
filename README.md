# RhandytaVERSE

A self-contained editorial publishing platform: server-rendered React, a real SQLite-backed CMS, and a print-inspired design system. It is built to be read, not to look like a template.

**RhandytaVERSE** is the personal publication of **Rhandyta Briantama** — a digital commonplace book of essays across technology, design, science, culture, work, and the quieter parts of a working life. It is written and edited by Rhandyta Briantama; the publication and the person are the same project.

---

## Stack

| Layer | Choice |
| --- | --- |
| Runtime | [Bun](https://bun.sh) 1.3 |
| HTTP | Hono 4 on `Bun.serve` |
| Views | React 19, rendered to HTML on the server; only interactive islands ship JavaScript |
| Client build | Vite 6 (dev server + hashed production assets) |
| Styles | Tailwind CSS 4 utilities, a hand-written editorial design system, self-hosted fonts |
| Data | SQLite (`bun:sqlite`) locally, [Turso](https://turso.tech) (libSQL) on Vercel + Drizzle ORM + hand-written SQL migrations |
| Search | SQLite FTS5 with BM25 ranking (LIKE fallback if unavailable) |
| Editor | TipTap / ProseMirror (stored as JSON, rendered through a strict server-side serializer) |
| Images | `sharp` — WebP + AVIF variants, resized masters, 1200×630 social crops; local disk or [Vercel Blob](https://vercel.com/storage/blob) |
| Automation | Gemini (Google AI Studio) — drafts from daily activity or an editorial initiative, with a review window |
| Analytics | First-party, cookie-less readership and visitor aggregates; salted visitor hashes, no raw IP/UA, admin-only |
| Newsletter | Resend API; double opt-in, admin composer, scheduled digest, per-recipient unsubscribe, webhook delivery events |
| Audit & limits | Admin mutation log with hashed IPs; database-backed rate limits shared across instances |
| Validation | Zod |
| Tests | `bun test` (73 unit + integration tests) |

### Rendering architecture

```
Bun.serve
  └─ Hono app (src/server/app.tsx)
       ├─ public routes → SQLite → React renderToString → full HTML document
       ├─ admin routes  → server-rendered CMS pages + React islands
       ├─ /api/*        → JSON for editor, media, search, newsletter, preview
       └─ /assets/*     → Vite production bundle (dev: served by Vite on :5173)

Client
  ├─ site.ts   ~3 KB gzip: theme, menu, reading progress, TOC spy,
  │            bookmarks, share, newsletter, saved-articles page
  ├─ search.ts ~1 KB gzip: live search against /api/search
  └─ admin.tsx TipTap editor + media library (loaded only in the CMS)
```

There is **no client-side router**. Every page is a complete server response, so navigation, caching, and search-engine crawling work without JavaScript. The public article HTML is fully crawlable.

---

## Quick start

Requires **Bun 1.2+**.

```bash
bun install
cp .env.example .env        # edit the values
bun run db:migrate
bun run db:seed
bun run dev                 # Vite on :5173 + Bun server on :3000
```

Open <http://localhost:3000>. The editorial desk is at <http://localhost:3000/admin>.

### Demonstration credentials

The seed script creates an administrator from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `.env`. The example values are:

```
email:    editor@rhandytaverse.local
password: rhandytaverse-dev
```

Change these before deploying. The seed also creates three labelled demonstration author profiles.

### Reset the demo data

```bash
bun run db:reset            # removes the SQLite database and uploaded files
bun run db:migrate
bun run db:seed
```

> `db:reset` deletes `DATABASE_PATH` and `UPLOAD_DIR`. It is destructive.

---

## Scripts

| Script | Purpose |
| --- | --- |
| `bun run dev` | Vite dev server + Bun server with `--watch` |
| `bun run build` | Copy fonts, build hashed client assets into `dist/client` |
| `bun run start` | Production server (reads `dist/client/.vite/manifest.json`) |
| `bun run db:migrate` | Apply SQL migrations |
| `bun run db:seed` | Seed categories, authors, tags, 13 articles, and generated covers (idempotent) |
| `bun run db:reset` | Delete local data (database + uploads) |
| `bun run db:rebuild-search` | Rebuild the FTS5 index |
| `bun run db:clear-content -- --yes` | Remove articles, media, authors and subscribers; keep categories, tags, settings and admin users. Writes a local JSON backup first. |
| `bun test` | Unit + HTTP integration tests against an in-memory database |
| `bun run typecheck` | `tsc --noEmit` |

---

## Environment

Validated at boot by Zod (`src/lib/config.ts`).

| Variable | Required in production | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | `development` / `production` / `test` |
| `PUBLIC_ORIGIN` | yes | Absolute origin used for canonical URLs, OG tags, sitemap, RSS. No trailing slash. |
| `PORT` | no | Default `3000` |
| `DATABASE_PATH` | no | Default `./data/commonplace.db` |
| `UPLOAD_DIR` | no | Default `./data/uploads` — must be writable |
| `SESSION_SECRET` | yes | At least 16 characters, unique; used for signed preview tokens. Production refuses placeholder values (`dev-secret…`, `change-me…`). |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | at seed time | Used only by `db:seed` |
| `SITE_NAME` | no | Used for logging only |
| `DISABLE_SCHEDULER` | no | Set to `1` to disable the scheduled-publishing timer |
| `TURSO_DATABASE_URL` | Vercel only | `libsql://…` URL. When unset, the app uses the local SQLite file at `DATABASE_PATH`. |
| `TURSO_AUTH_TOKEN` | Vercel only | Token for the Turso database. |
| `BLOB_READ_WRITE_TOKEN` | Vercel only | Vercel Blob token. When unset, uploads go to `UPLOAD_DIR` on local disk. |
| `CRON_SECRET` | Vercel only | Bearer token protecting `GET /api/cron/publish` and `GET /api/cron/automation`. |
| `GEMINI_API_KEY` | Automation only | Google AI Studio key. Without it, automation stays idle and the admin page shows a warning. |
| `GEMINI_MODEL` | no | Optional fallback model; the model can also be set per automation settings. Default `gemini-2.5-flash`. |

On Vercel, `PUBLIC_ORIGIN` is derived automatically from `VERCEL_PROJECT_PRODUCTION_URL` (or `VERCEL_URL` on preview deployments) when it is not set explicitly.

The server refuses to boot in production with the placeholder session secret.

---

## Routes

**Public**

`/` · `/articles` (+ `?page=`) · `/articles/:slug` · `/category/:slug` · `/topics` · `/author/:slug` · `/archive` · `/tags/:slug` · `/search?q=` · `/saved` · `/about` · `/subscribe` · `/unsubscribe?token=` · `/preview/:id?token=` (signed draft previews) · `/rss.xml` · `/feed.xml` · `/sitemap.xml` · `/robots.txt` · styled 404 / 500.

**Editorial**

`/admin/login` · `/admin` · `/admin/articles` · `/admin/articles/new` · `/admin/articles/:id/edit` · `/admin/articles/:id/revisions` · `/admin/media` · `/admin/automation` · `/admin/categories[/:id]` · `/admin/tags[/:id]` · `/admin/authors[/:id]` · `/admin/subscribers` · `/admin/settings`.

**API**

`/api/admin/articles` (create/update/autosave/publish/schedule/unpublish/archive/delete) · `/api/admin/media` (upload, metadata, delete) · `/api/search` · `/api/articles?slugs=` · `/api/subscribe` · `/api/health` · `/api/cron/publish` · `/api/cron/automation`.

---

## CMS

- **Article lifecycle** — draft, preview (signed URL, 24 hours), publish, schedule, unpublish, archive, delete. A 60-second scheduler publishes due articles.
- **Editor** — TipTap with headings H1–H6, bold/italic/underline/strike, lists, blockquotes, links, images with alt text and captions, tables, highlighted code blocks, horizontal rules, and allowlisted YouTube/Vimeo embeds.
- **Autosave** every 20 seconds plus manual save; optimistic concurrency compares `updatedAt` and returns `409` on conflict.
- **Revisions** — the previous version is snapshotted on every explicit save; the latest 30 are kept and can be restored.
- **Media** — upload, alt text, caption, copy URL, delete (blocked while referenced), automatic WebP/AVIF variants and OG crops.
- **Organisation** — categories with accent colours, tags with usage counts, author profiles, featured rank, editors' picks.
- **SEO panel** — slug, SEO title, meta description, canonical URL, social image, no-index, live search and social previews.
- **Roles** — `admin`, `editor`, `author`. Authors see and edit only their own articles; content settings and taxonomy management are restricted.
- **Subscribers** — real persistence, deduplication, unsubscribe tokens, CSV export. No transactional email provider is connected (see Limitations).
- **Automation** — daily activity (text + optional image), a configurable author/language/model, Gemini drafts, a daily generation cap, and auto-publish after a 24-hour review window. See *Content automation* below.

### Content safety

The article body is stored as TipTap JSON, never trusted HTML. It is rendered by `src/lib/content/render.ts`, which:

- escapes every text node and attribute,
- drops links whose scheme is not `http`, `https`, `mailto`, a relative path, or an anchor,
- builds image URLs only from known media records,
- allows iframes only for YouTube (privacy-enhanced domain) and Vimeo with validated IDs,
- never emits author-supplied raw HTML.

The renderer is covered by unit tests for scripts, event handlers, unsafe URLs, and attribute escaping.

### Security

- Argon2id password hashing (`Bun.password`), generic login failures, timing-safe CSRF comparisons.
- Server-side sessions (SHA-256 hashed tokens), 30-day rolling expiry, `HttpOnly` + `SameSite=Lax` (+ `Secure` in production) cookies.
- CSRF: origin/`Sec-Fetch-Site` checks on mutations, per-session tokens in forms and `x-csrf-token` for the JSON API.
- Rate limits: login (5 / 15 min per IP+email), subscribe (5 / hour per IP), search (60 / min per IP).
- Uploads: 8 MB cap, magic-byte sniffing, re-encoded through sharp, random filenames, no SVG uploads, `nosniff` + immutable caching.
- CSP, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and HSTS in production.
- All data access is parameterised (Drizzle / `bun:sqlite`), and every mutation validates input with Zod.

---

## SEO and feeds

- Semantic landmarks, one `h1` per page, `<time datetime>`, breadcrumbs.
- Unique titles/descriptions, canonical URLs, Open Graph and Twitter cards with image dimensions.
- JSON-LD: `WebSite` + `SearchAction`, `BlogPosting`, `BreadcrumbList`, `Person`, `CollectionPage`.
- `sitemap.xml` (excludes drafts, scheduled, archived, and no-indexed articles), `robots.txt`, and RSS 2.0 with full `content:encoded` and absolute URLs.
- Clean URLs; internal links between articles, sections, authors, and tags.

Rankings are not promised — the technical foundation is in place.

---

## Design system

- **Typography** — Fraunces (display), Newsreader (long-form reading), IBM Plex Mono (labels and metadata), all self-hosted for privacy and performance.
- **Palette** — warm paper, near-black ink, a single vermilion accent, plus a restrained accent per section. Full dark theme with no flash on load.
- **Layout** — 12-column grid, asymmetric feature splits, margin rails, hairline rules, print-derived section numbering; no rounded-card grid, gradients, or decorative shadows.
- **Motion** — short, purposeful transitions only; disabled under `prefers-reduced-motion`.
- **Reading** — 66–72ch measure, drop caps, styled pull quotes, figures with captions, sticky contents, reading progress.
- **Accessibility** — skip link, visible focus rings, keyboard-operable dialogs and menus, labelled forms with live validation messages, semantic headings, and tested colour contrast in both themes.

---

## Testing

```bash
bun test
```

The suite uses an in-memory SQLite database seeded with fixtures. It covers:

- sanitisation, URL allowlists, TOC IDs, code highlighting, tables, embeds, and markdown parsing;
- reading time, excerpts, slugs, tagged-template rendering;
- public routes, 404 handling, security headers, JSON-LD, canonical/OG metadata;
- sitemap/RSS exclusions for unpublished and no-indexed content;
- search ranking and highlighting;
- newsletter subscribe/dedupe/honeypot/form redirects;
- login, session cookies, role permissions, CSRF rejection, unauthenticated API access;
- the full CMS pipeline: create → preview → publish → conflict → schedule → delete;
- image upload validation, metadata patching, and deletion.

Manual QA shapes: 390 / 768 / 1024 / 1440 widths, both themes, keyboard-only navigation, editor and media library.

---

## Deployment

### Direct (Bun + reverse proxy)

```bash
bun install --frozen-lockfile
bun run build
NODE_ENV=production bun run start
```

Set a real `SESSION_SECRET` and `PUBLIC_ORIGIN`. Put Nginx/Caddy in front for TLS and compression. Serve `/assets/*` from `dist/client` with long-lived caching (the app already does), keep HTML uncached, and proxy WebSocket upgrades only if you add them.

SQLite and uploads live under `data/`. Back up that directory. Run a single application instance (SQLite is single-writer and rate limits are in-memory).

### Vercel

Vercel Functions have a read-only filesystem, so the local SQLite file and uploads directory cannot be used there. The project ships with:

- [`server.ts`](./server.ts) — the entrypoint detected by Vercel's Bun runtime preset (`vercel.json` sets `bunVersion: "1.x"`).
- Turso (libSQL) for the database. Migrations run automatically on the first request.
- Vercel Blob for uploaded and generated images.

1. Create a Turso database and copy its URL and token:

   ```bash
   turso db create rhandytaverse
   turso db show rhandytaverse --url
   turso db tokens create rhandytaverse
   ```

2. Create a Blob store in the Vercel dashboard (Storage → Blob) and copy `BLOB_READ_WRITE_TOKEN`.

3. Add the environment variables in Vercel (Production and Preview):

   ```
   SESSION_SECRET=<long random string>
   TURSO_DATABASE_URL=libsql://…
   TURSO_AUTH_TOKEN=…
   BLOB_READ_WRITE_TOKEN=…
   CRON_SECRET=<long random string>
   GEMINI_API_KEY=<Google AI Studio key>
   ```

   `PUBLIC_ORIGIN` is optional and derived from the deployment URL.

4. Apply the schema and seed demo content once from your machine, pointing at the same services:

   ```bash
   TURSO_DATABASE_URL=libsql://… TURSO_AUTH_TOKEN=… \
   BLOB_READ_WRITE_TOKEN=… bun run db:migrate
   ```

   ```bash
   TURSO_DATABASE_URL=libsql://… TURSO_AUTH_TOKEN=… \
   BLOB_READ_WRITE_TOKEN=… ADMIN_EMAIL=… ADMIN_PASSWORD=… bun run db:seed
   ```

5. Deploy with the Vercel CLI or by connecting the repository:

   ```bash
   bunx vercel deploy
   ```

Scheduled publishing does not run in-process on Vercel. The project includes a daily Vercel Cron at `0 2 * * *` calling `GET /api/cron/automation`, which publishes due scheduled articles, auto-publishes reviewed-free AI drafts, and generates one new draft. On the Hobby plan the cron can run once per day; for tighter publishing windows, point a free external cron service at the same endpoint with `Authorization: Bearer $CRON_SECRET`.

### Content automation

`/admin/automation` is the editorial control room for AI-assisted drafts:

- Add a daily **activity** (text and optional image). The image is processed through the normal media pipeline and can become the article cover.
- Choose the **author**, **language** (default Indonesian), Gemini model, articles per 24 hours (default 1), and the initiative brief used when there is no activity.
- Choose the **cover source**: an activity photo, a procedural geometric cover (free), or an optional AI cover with `gemini-2.5-flash-image`. AI covers have their own daily cap and fall back to procedural on quota/error. Gemini image generation may require a paid tier; a free key can return a 0 image quota.
- Press **Generate draft** to create one draft immediately, or let the cron batch create up to the remaining daily quota. A batch stops at a 210-second budget so the function stays within its 300-second limit; any remainder continues on the next cron slot.
- Generated drafts are marked for **auto-publish after 24 hours**. If you edit, schedule, or publish the draft before then, auto-publish is skipped; otherwise the next cron publishes it automatically. This keeps a human review window without blocking the pipeline.

The Gemini integration is provider-side optional: without `GEMINI_API_KEY` the page loads and the cron stays idle. The free tier is enough for a small publication; the daily limit is a hard guard in the application, not just a provider quota.

SQLite FTS5 may not be available on every Turso database; the search layer detects it and falls back to `LIKE` queries automatically.

### Docker

```bash
docker compose up --build -d
docker compose exec commonplace bun scripts/seed.ts   # optional demo content
```

The provided `Dockerfile` builds on `oven/bun:1.3-alpine`, builds the client, and persists `/app/data` in a named volume. Compose reads environment variables from `.env`; ensure `.env` has a production `SESSION_SECRET`, `PUBLIC_ORIGIN`, and strong admin credentials.

Health check: `GET /api/health` returns `{ "ok": true }`.

---

## Limitations and next steps

- **Email delivery** — newsletter addresses are stored, deduplicated, exportable, and unsubscribable, but no transactional provider is connected. A mail hook belongs in `subscribeEmail` / the admin subscribers view. The UI does not claim an email was sent.
- **Single instance** — in-memory rate limiting assumes one server. On Vercel that limit is per function instance; move it to Redis or another shared store if you need a global limit. Filesystem storage is replaced by Turso + Vercel Blob there.
- **Popularity** — “Most read” appears only after real views have been recorded; no seeded fake numbers.
- **Slug changes** — editing a slug changes the public URL. A redirect-history table would be the next step for long-lived archives.
- **Scheduled publishing** runs in-process; on Vercel it is handled by `/api/cron/automation` and the daily cron jobs.
- **Automation timing** — the Hobby plan cron runs twice a day, so an auto-publish scheduled for a specific hour can land up to roughly 12 hours after its 24-hour window. Use an hourly external cron (with `CRON_SECRET`) if exact timing matters.
- **AI review** — Gemini drafts are intended to be reviewed. Auto-publish is a safety net, not a substitute for editorial judgement.

---

## Project layout

```
src/
  client/            site.ts, search.ts, admin.tsx (React islands)
  components/        editorial UI, layout chrome (header, footer, admin shell)
  pages/public/      home, articles, article, category/tag, author, archive,
                     topics, search/saved, about, subscribe, 404/500
  pages/admin/       dashboard, article list/revisions, taxonomy CRUD,
                     settings, subscribers, editor + media shells
  server/            Hono app, routes, middleware, document + asset rendering
  lib/
    auth/            sessions, passwords, permissions, rate limits
    content/         TipTap renderer, markdown parser, text utilities
    db/              schema, client, migrations, seed data, queries
    media/           upload pipeline, generated cover art
    automation/      Gemini client, draft generation, auto-publish queue
    seo/             meta/JSON-LD, feeds, signed preview tokens
    validation/      Zod schemas
  styles/            tokens, editorial CSS, admin CSS
tests/               unit + HTTP integration suites
scripts/             dev, build helpers, migrate, seed, reset, clear content, rebuild search
```

---

## Content note

The production dataset can be cleared with `bun run db:clear-content -- --yes`, which keeps categories, tags, settings and admin users, and writes a local JSON backup first. New content can be written in the CMS or generated from `/admin/automation`; AI drafts are reviewed before publication and still require editorial judgement for accuracy and tone.
