import { mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { getConfig } from '../src/lib/config'
import { all, get, run } from '../src/lib/db/client'
import { ensureDb } from '../src/lib/db/migrate'
import { saveAutomationSettings } from '../src/lib/db/queries/automation'
import { deleteStoredFiles } from '../src/lib/media/storage'

if (!process.argv.includes('--yes')) {
  console.error('[clear] This removes every article, revision, view, media item, author and subscriber.')
  console.error('[clear] Categories, tags, settings and admin users are kept.')
  console.error('[clear] Run with --yes to continue.')
  process.exit(1)
}

await ensureDb()
const config = getConfig()

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const baseDir = config.DATABASE_PATH === ':memory:' ? './data' : dirname(config.DATABASE_PATH)
const backupPath = join(baseDir, `content-backup-${stamp}.json`)
mkdirSync(baseDir, { recursive: true })

const backup = {
  exportedAt: new Date().toISOString(),
  articles: await all('SELECT * FROM articles'),
  authors: await all('SELECT * FROM authors'),
  media: await all('SELECT * FROM media'),
  subscribers: await all('SELECT * FROM subscribers'),
  revisions: await all('SELECT * FROM article_revisions'),
  activity: await all('SELECT * FROM automation_activity'),
  runs: await all('SELECT * FROM automation_runs'),
}
await Bun.write(backupPath, JSON.stringify(backup, null, 2))
console.log(`[clear] backup written to ${backupPath}`)

const mediaRows = await all<{ variants: string }>('SELECT variants FROM media')
for (const asset of mediaRows) {
  try {
    await deleteStoredFiles({ variants: asset.variants })
  } catch (error) {
    console.warn('[clear] could not remove media files for one asset:', error)
  }
}
console.log(`[clear] removed ${mediaRows.length} media asset(s)`)

await run('DELETE FROM automation_runs')
await run('DELETE FROM automation_activity')
await run('DELETE FROM article_tags')
await run('DELETE FROM article_revisions')
await run('DELETE FROM article_views')
await run('DELETE FROM articles')
await run('DELETE FROM authors')
await run('DELETE FROM subscribers')

const fts = await get<{ name: string }>(
  "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'article_fts'",
)
if (fts) {
  await run('DELETE FROM article_fts')
}

await run('DELETE FROM media')
await saveAutomationSettings({ authorId: null, lastRunAt: null })

if (!config.BLOB_READ_WRITE_TOKEN) {
  try {
    rmSync(config.UPLOAD_DIR, { recursive: true, force: true })
  } catch {
    // Local uploads are best-effort.
  }
}

const remaining = {
  articles: (await get<{ n: number }>('SELECT COUNT(*) AS n FROM articles'))?.n ?? 0,
  authors: (await get<{ n: number }>('SELECT COUNT(*) AS n FROM authors'))?.n ?? 0,
  media: (await get<{ n: number }>('SELECT COUNT(*) AS n FROM media'))?.n ?? 0,
  subscribers: (await get<{ n: number }>('SELECT COUNT(*) AS n FROM subscribers'))?.n ?? 0,
  categories: (await get<{ n: number }>('SELECT COUNT(*) AS n FROM categories'))?.n ?? 0,
  tags: (await get<{ n: number }>('SELECT COUNT(*) AS n FROM tags'))?.n ?? 0,
  settings: (await get<{ n: number }>('SELECT COUNT(*) AS n FROM settings'))?.n ?? 0,
}

console.log('[clear] done')
console.log(JSON.stringify(remaining, null, 2))
