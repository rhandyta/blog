import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const manifestPath = join(process.cwd(), 'dist', 'client', '.vite', 'manifest.json')
if (!existsSync(manifestPath)) {
  console.error("Missing dist/client/.vite/manifest.json — run 'bun run build' before running E2E tests.")
  process.exit(1)
}

const tempRoot = mkdtempSync(join(tmpdir(), 'rhandytaverse-e2e-'))
const dbPath = join(tempRoot, 'e2e.db')
const uploadDir = join(tempRoot, 'uploads')
mkdirSync(uploadDir, { recursive: true })

process.env.NODE_ENV = 'production'
process.env.DATABASE_PATH = dbPath
process.env.UPLOAD_DIR = uploadDir
process.env.SESSION_SECRET = 'e2e-test-session-secret-0123456789abcdef'
process.env.ADMIN_EMAIL = 'test@example.com'
process.env.ADMIN_PASSWORD = 'test-password-123'
process.env.DISABLE_SCHEDULER = '1'
delete process.env.TURSO_DATABASE_URL
delete process.env.TURSO_AUTH_TOKEN
delete process.env.BLOB_READ_WRITE_TOKEN
process.env.RESEND_API_KEY = 're_e2e_mock_key'
delete process.env.RESEND_WEBHOOK_SECRET
delete process.env.OPS_ALERT_WEBHOOK_URL
delete process.env.OPS_ALERT_EMAIL

const nativeFetch = globalThis.fetch
const e2eFetch = Object.assign(
  async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.startsWith('https://api.resend.com/')) {
      return new Response(JSON.stringify({ id: 'e2e_mock_email' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    return nativeFetch(input, init)
  },
  { preconnect: nativeFetch.preconnect },
)
globalThis.fetch = e2eFetch as typeof fetch

const { getConfig, resetConfigCache } = await import('../src/lib/config')
const { ensureDb } = await import('../src/lib/db/migrate')
const { closeDb, getDb } = await import('../src/lib/db/client')
const { tags } = await import('../src/lib/db/schema')
const { createUser, getUserByEmail } = await import('../src/lib/auth/session')
const { upsertAuthor, upsertCategory } = await import('../src/lib/db/queries/taxonomy')
const { createArticle } = await import('../src/lib/db/queries/articles')
const { createApp } = await import('../src/server/app')

await ensureDb()

let user = await getUserByEmail('test@example.com')
if (!user) {
  user = await createUser({
    id: 'user_test',
    email: 'test@example.com',
    password: 'test-password-123',
    name: 'Test Editor',
    role: 'admin',
  })
}

await upsertCategory({
  id: 'cat_test',
  slug: 'test-section',
  name: 'Test Section',
  description: 'A section used by E2E tests.',
  intro: 'A demonstration section for E2E tests.',
  accent: 'teal',
  sortOrder: 1,
})

await upsertAuthor({
  id: 'author_test',
  slug: 'test-author',
  displayName: 'Test Author',
  roleTitle: 'Editor',
  bio: 'An E2E test author profile.',
  expertise: ['testing'],
  userId: user.id,
  isDemo: true,
})

await getDb()
  .insert(tags)
  .values({ id: 'tag_test', slug: 'test-tag', name: 'Test Tag', description: '', createdAt: new Date().toISOString() })
  .onConflictDoNothing()

const doc = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'The notebook rewards attention and returning to the same pages. This sentence exists so the search index has something to find.',
        },
      ],
    },
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'A section heading' }],
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'More about the practice of keeping notes across a long working life.' }],
    },
  ],
}

const base = {
  title: 'The Published Test Article',
  subtitle: 'A test subtitle',
  excerpt: 'A published article used by E2E browser verification.',
  bodyJson: JSON.stringify(doc),
  bodyText: 'The notebook rewards attention and returning to the same pages.',
  readingMinutes: 2,
  authorId: 'author_test',
  categoryId: 'cat_test',
  featuredMediaId: null,
  featuredCaption: null,
  isFeatured: true,
  featuredRank: 1,
  isEditorsPick: true,
  seoTitle: null,
  seoDescription: null,
  canonicalUrl: null,
  ogMediaId: null,
  noIndex: false,
  isDemo: true,
  tagIds: ['tag_test'],
}

await createArticle({
  ...base,
  id: 'art_test_published',
  slug: 'test-published',
  status: 'published',
  publishedAt: new Date(Date.now() - 86_400_000).toISOString(),
  scheduledFor: null,
})

await createArticle({
  ...base,
  id: 'art_test_draft',
  slug: 'test-draft',
  title: 'A Draft Test Article',
  status: 'draft',
  publishedAt: null,
  scheduledFor: null,
})

let app: ReturnType<typeof createApp> | null = null
const server = Bun.serve({
  port: 0,
  idleTimeout: 60,
  fetch: (request) => {
    if (!app) return new Response('Starting…', { status: 503 })
    return app.fetch(request)
  },
})

const origin = `http://localhost:${server.port}`
process.env.PORT = String(server.port)
process.env.PUBLIC_ORIGIN = origin
resetConfigCache()
getConfig()
app = createApp()

console.log(`E2E_SERVER_READY ${JSON.stringify({ origin, port: server.port, tempRoot })}`)

const shutdown = () => {
  try {
    server.stop(true)
  } catch {
    // ignore
  }
  try {
    closeDb()
  } catch {
    // ignore
  }
  try {
    rmSync(tempRoot, { recursive: true, force: true })
  } catch {
    // ignore
  }
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
