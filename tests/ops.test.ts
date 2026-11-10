import zlib from 'node:zlib'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { eq } from 'drizzle-orm'
import { resetRateLimits } from '../src/lib/auth/rate-limit'
import { createUser } from '../src/lib/auth/session'
import { resetConfigCache } from '../src/lib/config'
import type { PMDoc } from '../src/lib/content/doc'
import { getDb } from '../src/lib/db/client'
import { createArticle, deleteArticle } from '../src/lib/db/queries/articles'
import { upsertAuthor } from '../src/lib/db/queries/taxonomy'
import { adminAuditLog, authors as authorsTable, opsEvents, users as usersTable } from '../src/lib/db/schema'
import { articleToMarkdownFile, buildContentBackup, createZip, docToMarkdown } from '../src/lib/ops/export'
import {
  checkDatabaseHealth,
  getLatestCronHeartbeat,
  listOpsEvents,
  pruneOpsEvents,
  recordOpsEvent,
  resetAlertCooldowns,
  sendTestAlert,
} from '../src/lib/ops/monitor'
import { createApp } from '../src/server/app'

const app = createApp()

function cookieFrom(response: Response): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  const values =
    headers.getSetCookie?.() ?? (response.headers.get('set-cookie') ? [response.headers.get('set-cookie') ?? ''] : [])
  return values.map((value) => value.split(';')[0]).join('; ')
}

async function loginAs(
  email = 'test@example.com',
  password = 'test-password-123',
): Promise<{ cookie: string; csrfToken: string }> {
  await resetRateLimits()
  const get = await app.request('/admin/login')
  const html = await get.text()
  const csrf = /name="_csrf" value="([^"]+)"/.exec(html)?.[1] ?? ''
  const loginCookie = cookieFrom(get)
  const response = await app.request('/admin/login', {
    method: 'POST',
    headers: { cookie: loginCookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email, password, _csrf: csrf }).toString(),
  })
  expect(response.status).toBe(303)
  const cookie = cookieFrom(response)
  const session = await app.request('/api/admin/session', { headers: { cookie } })
  expect(session.status).toBe(200)
  const json = (await session.json()) as { csrfToken: string }
  return { cookie, csrfToken: json.csrfToken }
}

function parseZipEntries(zipBytes: Uint8Array): Array<{ name: string; content: Buffer; crc: number }> {
  const buf = Buffer.from(zipBytes)
  const eocdOffset = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  expect(eocdOffset).toBeGreaterThanOrEqual(0)
  const entryCount = buf.readUInt16LE(eocdOffset + 10)
  const cdOffset = buf.readUInt32LE(eocdOffset + 16)

  const parsed: Array<{ name: string; content: Buffer; crc: number }> = []
  let cursor = cdOffset
  for (let i = 0; i < entryCount; i++) {
    expect(buf.readUInt32LE(cursor)).toBe(0x02014b50)
    const compressedSize = buf.readUInt32LE(cursor + 20)
    const nameLen = buf.readUInt16LE(cursor + 28)
    const extraLen = buf.readUInt16LE(cursor + 30)
    const commentLen = buf.readUInt16LE(cursor + 32)
    const localOffset = buf.readUInt32LE(cursor + 42)
    const crc = buf.readUInt32LE(cursor + 16)

    expect(buf.readUInt32LE(localOffset)).toBe(0x04034b50)
    const localNameLen = buf.readUInt16LE(localOffset + 26)
    const localExtraLen = buf.readUInt16LE(localOffset + 28)
    const name = buf.subarray(localOffset + 30, localOffset + 30 + localNameLen).toString('utf8')
    const dataStart = localOffset + 30 + localNameLen + localExtraLen
    const content = buf.subarray(dataStart, dataStart + compressedSize)
    expect(zlib.crc32(content) >>> 0).toBe(crc)

    parsed.push({ name, content, crc })
    cursor += 46 + nameLen + extraLen + commentLen
  }
  return parsed
}

beforeAll(async () => {
  await resetRateLimits()
})

beforeEach(() => {
  resetAlertCooldowns()
})

afterAll(async () => {
  await getDb().delete(opsEvents)
  await getDb().delete(adminAuditLog)
  resetConfigCache()
})

describe('poin 4B: ops monitoring, alerts, health & cron heartbeats', () => {
  test('checkDatabaseHealth pings sqlite and reports ok status and latency', async () => {
    const health = await checkDatabaseHealth()
    expect(health.ok).toBe(true)
    expect(health.mode).toBe('sqlite')
    expect(health.latencyMs).toBeGreaterThanOrEqual(0)
  })

  test('recordOpsEvent persists events, dispatches alerts with cooldown, and supports pruning', async () => {
    const prevWebhook = process.env.OPS_ALERT_WEBHOOK_URL
    const prevAlertEmail = process.env.OPS_ALERT_EMAIL
    const prevResendKey = process.env.RESEND_API_KEY
    try {
      process.env.OPS_ALERT_WEBHOOK_URL = 'https://hooks.example.test/services/ops'
      process.env.OPS_ALERT_EMAIL = 'ops-alert@example.com'
      process.env.RESEND_API_KEY = 're_test_key_ops'
      resetConfigCache()

      const deliveredWebhooks: Array<{ severity?: string; code?: string }> = []
      const deliveredEmails: Array<{ to: string; subject: string }> = []
      const hooks = {
        fetchImpl: (async (_url, init) => {
          const payload = JSON.parse(String(init?.body ?? '{}')) as { severity?: string; code?: string }
          deliveredWebhooks.push(payload)
          return new Response('ok', { status: 200 })
        }) as typeof fetch,
        sendEmailImpl: async (input: { to: string; subject: string }) => {
          deliveredEmails.push({ to: input.to, subject: input.subject })
          return { ok: true as const, id: `email_ops_${deliveredEmails.length}` }
        },
      }

      const first = await recordOpsEvent(
        {
          level: 'error',
          source: 'cron.test',
          code: 'boom',
          message: 'Test operational failure',
          detail: { step: 1 },
          path: '/api/cron/automation',
        },
        hooks,
      )
      expect(first).toBeTruthy()
      expect(first?.notified).toBe(true)
      expect(deliveredWebhooks.length).toBe(1)
      expect(deliveredWebhooks[0]).toEqual({ severity: 'error', code: 'boom', ...(deliveredWebhooks[0] as object) })
      expect(deliveredEmails.length).toBe(1)
      expect(deliveredEmails[0]?.to).toBe('ops-alert@example.com')
      expect(deliveredEmails[0]?.subject).toContain('cron.test/boom')

      // Identical fingerprint within cooldown window should be deduplicated (logged, not emailed/webhooked again)
      const second = await recordOpsEvent(
        {
          level: 'error',
          source: 'cron.test',
          code: 'boom',
          message: 'Repeated failure',
          path: '/api/cron/automation',
        },
        hooks,
      )
      expect(second?.notified).toBe(false)
      expect(deliveredWebhooks.length).toBe(1)
      expect(deliveredEmails.length).toBe(1)

      // bypassCooldown forces alert delivery
      const forced = await recordOpsEvent(
        {
          level: 'error',
          source: 'cron.test',
          code: 'boom',
          message: 'Forced alert',
          path: '/api/cron/automation',
          bypassCooldown: true,
        },
        hooks,
      )
      expect(forced?.notified).toBe(true)
      expect(deliveredWebhooks.length).toBe(2)
      expect(deliveredEmails.length).toBe(2)

      // info events do not notify by default
      const info = await recordOpsEvent(
        {
          level: 'info',
          source: 'cron.test',
          code: 'heartbeat',
          message: 'All clear',
        },
        hooks,
      )
      expect(info?.notified).toBe(false)
      expect(deliveredWebhooks.length).toBe(2)

      // Test alert delivery directly
      const testAlert = await sendTestAlert('admin@example.com', hooks)
      expect(testAlert.status).toBe('sent')
      expect(testAlert.webhookOk).toBe(true)
      expect(testAlert.emailOk).toBe(true)
      expect(deliveredWebhooks.length).toBe(3)
      expect(deliveredWebhooks[2]?.code).toBe('test_alert')
      expect(deliveredEmails.length).toBe(3)
      expect(deliveredEmails[2]?.subject).toContain('admin.system/test_alert')

      // Prune events older than 30 days without touching recent rows
      const oldId = 'ops_old_row'
      await getDb()
        .insert(opsEvents)
        .values({
          id: oldId,
          level: 'warn',
          source: 'test.old',
          code: 'stale',
          message: 'Should be pruned',
          detail: null,
          requestId: null,
          path: null,
          notified: false,
          createdAt: new Date(Date.now() - 45 * 86_400_000).toISOString(),
        })
      await pruneOpsEvents(30)
      const remaining = await listOpsEvents({ limit: 50 })
      expect(remaining.items.some((item) => item.id === oldId)).toBe(false)
      expect(remaining.items.some((item) => item.id === first?.id)).toBe(true)
    } finally {
      if (prevWebhook === undefined) delete process.env.OPS_ALERT_WEBHOOK_URL
      else process.env.OPS_ALERT_WEBHOOK_URL = prevWebhook
      if (prevAlertEmail === undefined) delete process.env.OPS_ALERT_EMAIL
      else process.env.OPS_ALERT_EMAIL = prevAlertEmail
      if (prevResendKey === undefined) delete process.env.RESEND_API_KEY
      else process.env.RESEND_API_KEY = prevResendKey
      resetConfigCache()
    }
  })

  test('sendTestAlert reports not-configured when no alert channels exist', async () => {
    const result = await sendTestAlert('admin@example.com')
    expect(result.status).toBe('not-configured')
  })

  test('health, cron endpoints, and malformed webhook payloads behave cleanly', async () => {
    const health = await app.request('/api/health')
    expect(health.status).toBe(200)
    expect(health.headers.get('cache-control')).toBe('no-store')
    const healthJson = (await health.json()) as { ok: boolean; db: string; mode: string }
    expect(healthJson.ok).toBe(true)
    expect(healthJson.db).toBe('ok')
    expect(healthJson.mode).toBe('sqlite')

    const cronPublish = await app.request('/api/cron/publish')
    expect(cronPublish.status).toBe(200)
    const heartbeat = await getLatestCronHeartbeat()
    expect(heartbeat?.source).toBe('cron.publish')

    const cronAutomation = await app.request('/api/cron/automation')
    expect(cronAutomation.status).toBe(200)
    const automationHeartbeat = await getLatestCronHeartbeat()
    expect(automationHeartbeat?.source).toBe('cron.automation')

    const unconfiguredWebhook = await app.request('/api/webhooks/resend', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    expect(unconfiguredWebhook.status).toBe(503)

    const prevWebhookSecret = process.env.RESEND_WEBHOOK_SECRET
    try {
      process.env.RESEND_WEBHOOK_SECRET = 'whsec_dGVzdF9zZWNyZXRfMDEyMzQ1Njc4OWFiY2RlZg=='
      resetConfigCache()
      const badSignature = await app.request('/api/webhooks/resend', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{invalid-json',
      })
      expect(badSignature.status).toBe(401)
    } finally {
      if (prevWebhookSecret === undefined) delete process.env.RESEND_WEBHOOK_SECRET
      else process.env.RESEND_WEBHOOK_SECRET = prevWebhookSecret
      resetConfigCache()
    }
  })
})

describe('poin 4C: Markdown export, PKZIP archive, backup JSON & system RBAC', () => {
  test('docToMarkdown renders headings, marks, lists, code fences, tables, and sanitized links/images', () => {
    const doc: PMDoc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Section One' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' and ' },
            { type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'https://lab-rb.my.id' } }] },
            { type: 'text', text: ' and ' },
            { type: 'text', text: 'xss', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] },
          ],
        },
        {
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Quoted wisdom.' }] }],
        },
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Alpha' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Beta' }] }] },
          ],
        },
        {
          type: 'codeBlock',
          attrs: { language: 'ts' },
          content: [{ type: 'text', text: 'const x = "```fence```"' }],
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col A' }] }] },
                { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Col | B' }] }] },
              ],
            },
            {
              type: 'tableRow',
              content: [
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '1' }] }] },
                { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '2' }] }] },
              ],
            },
          ],
        },
        {
          type: 'image',
          attrs: { src: '/uploads/cover.webp', alt: 'Alt [brackets]', caption: 'Caption text' },
        },
      ],
    }

    const md = docToMarkdown(doc)
    expect(md).toContain('## Section One')
    expect(md).toContain('**Bold** and [link](https://lab-rb.my.id/) and xss')
    expect(md).toContain('> Quoted wisdom.')
    expect(md).toContain('- Alpha\n- Beta')
    expect(md).toContain('````ts\nconst x = "```fence```"\n````')
    expect(md).toContain('| Col A | Col \\| B |')
    expect(md).toContain('![Alt brackets](/uploads/cover.webp)\n\n*Caption text*')
  })

  test('articleToMarkdownFile and createZip produce valid frontmatter and standards-compliant PKZIP archives', () => {
    const md = articleToMarkdownFile({
      article: {
        id: 'art_md_1',
        slug: 'notes-on-systems',
        title: 'Notes on Systems',
        subtitle: 'Sub',
        excerpt: 'Excerpt',
        bodyJson: JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello Markdown.' }] }],
        }),
        bodyText: 'Hello Markdown.',
        readingMinutes: 1,
        status: 'published',
        authorId: 'author_test',
        categoryId: 'cat_test',
        featuredMediaId: null,
        featuredCaption: null,
        isFeatured: false,
        featuredRank: null,
        isEditorsPick: false,
        seoTitle: null,
        seoDescription: null,
        canonicalUrl: null,
        ogMediaId: null,
        noIndex: false,
        language: 'id',
        isDemo: false,
        publishedAt: '2026-11-08T00:00:00.000Z',
        scheduledFor: null,
        createdAt: '2026-11-08T00:00:00.000Z',
        updatedAt: '2026-11-08T00:00:00.000Z',
      },
      authorName: 'Test Author',
      categoryName: 'Test Section',
      tags: ['Testing', 'Architecture'],
    })

    expect(md.startsWith('---\n')).toBe(true)
    expect(md).toContain('title: "Notes on Systems"')
    expect(md).toContain('tags:\n  - "Testing"\n  - "Architecture"')
    expect(md).toContain('Hello Markdown.\n')

    const zipBytes = createZip([
      { name: 'README.md', content: '# Archive\n' },
      { name: 'articles/notes-on-systems.md', content: md },
    ])
    const entries = parseZipEntries(zipBytes)
    expect(entries.length).toBe(2)
    expect(entries[0]?.name).toBe('README.md')
    expect(entries[0]?.content.toString('utf8')).toBe('# Archive\n')
    expect(entries[1]?.name).toBe('articles/notes-on-systems.md')
    expect(entries[1]?.content.toString('utf8')).toBe(md)
  })

  test('buildContentBackup exports site content while excluding password hashes and tokens', async () => {
    const backup = await buildContentBackup()
    const serialized = JSON.stringify(backup)
    expect(backup.formatVersion).toBe(1)
    expect(Array.isArray(backup.articles)).toBe(true)
    expect(serialized).not.toContain('passwordHash')
    expect(serialized).not.toContain('pbkdf2$')
    expect(serialized).not.toContain('confirmationToken')
    expect(serialized).not.toContain('unsubscribeToken')
  })

  test('admin system console, JSON/ZIP/Markdown exports, and RBAC rules enforce permissions', async () => {
    const editorId = 'user_ops_editor'
    const authorId = 'user_ops_author'
    const authorProfileId = 'author_ops_author'
    const ownArticleId = 'art_ops_own'

    await createUser({
      id: editorId,
      email: 'ops-editor@example.com',
      password: 'editor-password-123',
      name: 'Ops Editor',
      role: 'editor',
    })
    await createUser({
      id: authorId,
      email: 'ops-author@example.com',
      password: 'author-password-123',
      name: 'Ops Author',
      role: 'author',
    })
    await upsertAuthor({
      id: authorProfileId,
      slug: 'ops-author-profile',
      displayName: 'Ops Author',
      userId: authorId,
      isDemo: false,
    })
    await createArticle({
      id: ownArticleId,
      slug: 'ops-author-own-piece',
      title: 'Ops Author Own Piece',
      subtitle: null,
      excerpt: 'Author own piece.',
      bodyJson: JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Owned content.' }] }],
      }),
      bodyText: 'Owned content.',
      readingMinutes: 1,
      status: 'published',
      authorId: authorProfileId,
      categoryId: 'cat_test',
      featuredMediaId: null,
      featuredCaption: null,
      isFeatured: false,
      featuredRank: null,
      isEditorsPick: false,
      seoTitle: null,
      seoDescription: null,
      canonicalUrl: null,
      ogMediaId: null,
      noIndex: false,
      isDemo: false,
      publishedAt: new Date().toISOString(),
      scheduledFor: null,
      tagIds: [],
    })

    try {
      // Anonymous blocked from system & export endpoints
      expect((await app.request('/admin/system', { redirect: 'manual' })).status).toBe(302)
      expect((await app.request('/admin/system/backup.json', { redirect: 'manual' })).status).toBe(302)
      expect((await app.request('/admin/system/articles.zip', { redirect: 'manual' })).status).toBe(302)
      expect((await app.request('/admin/articles/art_test_published/export.md', { redirect: 'manual' })).status).toBe(
        302,
      )

      // Editor blocked from /admin/system routes and sidebar omits System
      const editorSession = await loginAs('ops-editor@example.com', 'editor-password-123')
      expect(
        (await (await app.request('/admin', { headers: { cookie: editorSession.cookie } })).text()).includes(
          '/admin/system',
        ),
      ).toBe(false)
      expect(
        (await app.request('/admin/system', { headers: { cookie: editorSession.cookie }, redirect: 'manual' })).status,
      ).toBe(303)
      expect(
        (await app.request('/admin/system/backup.json', { headers: { cookie: editorSession.cookie } })).status,
      ).toBe(403)
      expect(
        (await app.request('/admin/system/articles.zip', { headers: { cookie: editorSession.cookie } })).status,
      ).toBe(403)
      expect(
        (
          await app.request('/admin/system/test-alert', {
            method: 'POST',
            headers: { cookie: editorSession.cookie, 'content-type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ _csrf: editorSession.csrfToken }).toString(),
            redirect: 'manual',
          })
        ).status,
      ).toBe(303)

      // Author can export own article Markdown, but is blocked from another author's article & /admin/system
      const authorSession = await loginAs('ops-author@example.com', 'author-password-123')
      const ownExport = await app.request(`/admin/articles/${ownArticleId}/export.md`, {
        headers: { cookie: authorSession.cookie },
      })
      expect(ownExport.status).toBe(200)
      expect(ownExport.headers.get('content-type')).toContain('text/markdown')
      expect(await ownExport.text()).toContain('Owned content.')
      expect(
        (
          await app.request('/admin/articles/art_test_published/export.md', {
            headers: { cookie: authorSession.cookie },
          })
        ).status,
      ).toBe(403)
      expect(
        (await app.request('/admin/system/backup.json', { headers: { cookie: authorSession.cookie } })).status,
      ).toBe(403)

      // Admin sees System link in sidebar and can download JSON backup, ZIP archive, and prune events
      const adminSession = await loginAs()
      const sysPage = await app.request('/admin/system', {
        headers: { cookie: adminSession.cookie, 'accept-language': 'en-US' },
      })
      expect(sysPage.status).toBe(200)
      const sysHtml = await sysPage.text()
      expect(sysHtml).toContain('System &amp; backups')
      expect(sysHtml).toContain('href="/admin/system"')

      const backupRes = await app.request('/admin/system/backup.json', {
        headers: { cookie: adminSession.cookie },
      })
      expect(backupRes.status).toBe(200)
      expect(backupRes.headers.get('cache-control')).toBe('private, no-store')
      expect(backupRes.headers.get('content-disposition')).toContain('.json')
      const backupRaw = await backupRes.text()
      expect(backupRaw).not.toContain('passwordHash')
      expect(JSON.parse(backupRaw).formatVersion).toBe(1)

      const zipRes = await app.request('/admin/system/articles.zip', {
        headers: { cookie: adminSession.cookie },
      })
      expect(zipRes.status).toBe(200)
      expect(zipRes.headers.get('content-type')).toContain('application/zip')
      expect(zipRes.headers.get('cache-control')).toBe('private, no-store')
      const zipEntries = parseZipEntries(new Uint8Array(await zipRes.arrayBuffer()))
      expect(zipEntries.some((entry) => entry.name === 'README.md')).toBe(true)
      expect(zipEntries.some((entry) => entry.name === 'articles/test-published.md')).toBe(true)

      const mdRes = await app.request('/admin/articles/art_test_published/export.md', {
        headers: { cookie: adminSession.cookie },
      })
      expect(mdRes.status).toBe(200)
      expect(mdRes.headers.get('content-disposition')).toContain('filename="test-published.md"')
      expect(await mdRes.text()).toContain('## A section heading')

      const badCsrf = await app.request('/admin/system/prune-events', {
        method: 'POST',
        headers: { cookie: adminSession.cookie, 'content-type': 'application/x-www-form-urlencoded' },
        body: '',
        redirect: 'manual',
      })
      expect(badCsrf.headers.get('location')).toContain('flash=error-csrf')

      const pruneOk = await app.request('/admin/system/prune-events', {
        method: 'POST',
        headers: { cookie: adminSession.cookie, 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ _csrf: adminSession.csrfToken }).toString(),
        redirect: 'manual',
      })
      expect(pruneOk.status).toBe(303)
      expect(pruneOk.headers.get('location')).toContain('flash=events-pruned')
    } finally {
      await deleteArticle(ownArticleId)
      await getDb().delete(authorsTable).where(eq(authorsTable.id, authorProfileId))
      await getDb().delete(usersTable).where(eq(usersTable.id, authorId))
      await getDb().delete(usersTable).where(eq(usersTable.id, editorId))
    }
  })
})
