import { createApp } from './app'
import { getConfig, isProd } from '../lib/config'
import { closeDb } from '../lib/db/client'
import { ensureDb } from '../lib/db/migrate'
import { publishDueArticles } from '../lib/db/queries/articles'
import { purgeExpiredSessions } from '../lib/auth/session'

await ensureDb()
const config = getConfig()
const app = createApp()

const server = Bun.serve({
  port: config.PORT,
  fetch: app.fetch,
  development: !isProd(),
  idleTimeout: 60,
})

console.log(`\n  ${config.SITE_NAME} — ${isProd() ? 'production' : 'development'}`)
console.log(`  http://localhost:${config.PORT}\n`)

if (!config.DISABLE_SCHEDULER && config.NODE_ENV !== 'test') {
  const publishTimer = setInterval(() => {
    publishDueArticles()
      .then((total) => {
        if (total > 0) console.log(`[scheduler] published ${total} scheduled article(s)`)
      })
      .catch((error) => console.error('[scheduler] failed', error))
  }, 60_000)
  const sessionTimer = setInterval(() => {
    purgeExpiredSessions().catch(() => undefined)
  }, 60 * 60 * 1000)
  ;(publishTimer as unknown as { unref?: () => void }).unref?.()
  ;(sessionTimer as unknown as { unref?: () => void }).unref?.()
}

const shutdown = () => {
  server.stop()
  closeDb()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
