# Commonplace

A self-contained editorial publishing platform: server-rendered React, a real SQLite-backed CMS, and a print-inspired design system. It is built to be read, not to look like a template.

**Commonplace** is a digital commonplace book — a personal index of essays across technology, design, science, culture, work, and the quieter parts of a working life. The demo content is labelled as demonstration material; the editorial tools behind it are fully functional.

---

## Stack

| Layer | Choice |
| --- | --- |
| Runtime | [Bun](https://bun.sh) 1.3 |
| HTTP | Hono 4 on `Bun.serve` |
| Views | React 19, rendered to HTML on the server; only interactive islands ship JavaScript |
| Client build | Vite 6 (dev server + hashed production assets) |
| Styles | Tailwind CSS 4 utilities, a hand-written editorial design system, self-hosted fonts |
| Data | SQLite (`bun:sqlite`) + Drizzle ORM + hand-written SQL migrations |
| Search | SQLite FTS5 with BM25 ranking (LIKE fallback if unavailable) |
| Editor | TipTap / ProseMirror (stored as JSON, rendered through a strict server-side serializer) |
| Images | `sharp` — WebP + AVIF variants, resized masters, 1200×630 social crops |
| Validation | Zod |
| Tests | `bun test` (42 unit + integration tests) |

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
email:    editor@commonplace.local
password: commonplace-dev
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

The server refuses to boot in production with the placeholder session secret.

---

## Routes

**Public**

`/` · `/articles` (+ `?page=`) · `/articles/:slug` · `/category/:slug` · `/topics` · `/author/:slug` · `/archive` · `/tags/:slug` · `/search?q=` · `/saved` · `/about` · `/subscribe` · `/unsubscribe?token=` · `/preview/:id?token=` (signed draft previews) · `/rss.xml` · `/feed.xml` · `/sitemap.xml` · `/robots.txt` · styled 404 / 500.

**Editorial**

`/admin/login` · `/admin` · `/admin/articles` · `/admin/articles/new` · `/admin/articles/:id/edit` · `/admin/articles/:id/revisions` · `/admin/media` · `/admin/categories[/:id]` · `/admin/tags[/:id]` · `/admin/authors[/:id]` · `/admin/subscribers` · `/admin/settings`.

**API**

`/api/admin/articles` (create/update/autosave/publish/schedule/unpublish/archive/delete) · `/api/admin/media` (upload, metadata, delete) · `/api/search` · `/api/articles?slugs=` · `/api/subscribe` · `/api/health`.

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
- **Single instance** — in-memory rate limiting and local uploads assume one server. Moving to Postgres + S3 + Redis rate limiting is a documented migration, not implemented here.
- **Popularity** — “Most read” appears only after real views have been recorded; no seeded fake numbers.
- **Slug changes** — editing a slug changes the public URL. A redirect-history table would be the next step for long-lived archives.
- **Scheduled publishing** runs in-process; for multiple instances, move it to a shared cron job.
- **Demo content** — the authors, articles, and cover art are generated for this prototype. No statistics, testimonials, or credentials are invented.

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
    seo/             meta/JSON-LD, feeds, signed preview tokens
    validation/      Zod schemas
  styles/            tokens, editorial CSS, admin CSS
tests/               unit + HTTP integration suites
scripts/             dev, build helpers, migrate, seed, reset, rebuild search
```

---

## Content note

The publication, its three authors, and all seeded articles are demonstration material written for this project. Author profiles say so on the public site, and seeded articles carry a discreet prototype notice. The CMS, authentication, persistence, search, feeds, and media pipeline are real and operate on that content.
