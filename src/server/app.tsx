import { join } from 'node:path'
import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { getCookie } from 'hono/cookie'
import { getConfig, isProd } from '../lib/config'
import { getSessionUser, SESSION_COOKIE } from '../lib/auth/session'
import { getSiteSettings } from '../lib/db/queries/taxonomy'
import { defaultSettings } from '../lib/db/queries/taxonomy'
import { listCategories } from '../lib/db/queries/taxonomy'
import { recordOpsEvent } from '../lib/ops/monitor'
import { NotFoundPage } from '../pages/public/search'
import { registerAdminRoutes } from './routes/admin'
import { registerPublicRoutes } from './routes/public'
import { renderPageResponse } from './render-page'
import { baseHead } from './head'
import type { AppEnv } from './types'

const CONTENT_TYPES: Record<string, string> = {
  webp: 'image/webp',
  avif: 'image/avif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  svg: 'image/svg+xml',
}

function contentSecurityPolicy(allowAnalytics: boolean): string {
  const dev = !isProd()
  const viteOrigin = process.env.VITE_ORIGIN || 'http://localhost:5173'
  const devSources = dev
    ? ` ${viteOrigin} http://127.0.0.1:5173 ws://localhost:5173 ws://127.0.0.1:5173`
    : ''
  const devScriptSources = dev ? ` 'unsafe-inline'${devSources}` : ''
  const gtmScriptSources = allowAnalytics
    ? ' https://www.googletagmanager.com https://www.google-analytics.com'
    : ''
  const gtmConnectSources = allowAnalytics
    ? ' https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com'
    : ''
  const gtmImgSources = allowAnalytics
    ? ' https://www.googletagmanager.com https://*.google-analytics.com'
    : ''
  const gtmFrameSources = allowAnalytics ? ' https://www.googletagmanager.com' : ''
  const scriptSrc = `'self'${gtmScriptSources}${devScriptSources}`
  const styleSrc = `'self' 'unsafe-inline'${dev ? devSources : ''}`
  const connectSrc = `'self'${gtmConnectSources}${dev ? devSources : ''}`
  const blobSources = ' https://*.public.blob.vercel-storage.com'
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    `img-src 'self' data: blob:${blobSources}${gtmImgSources}${dev ? devSources : ''}`,
    `font-src 'self' data:${dev ? devSources : ''}`,
    `connect-src ${connectSrc}`,
    `frame-src 'self' https://www.youtube-nocookie.com https://player.vimeo.com${gtmFrameSources}`,
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ')
}

function isPublicCacheableHtmlPath(path: string): boolean {
  if (
    path === '/' ||
    path === '/articles' ||
    path === '/topics' ||
    path === '/archive' ||
    path === '/about' ||
    path === '/privacy' ||
    path === '/terms'
  ) {
    return true
  }
  return (
    path.startsWith('/articles/') ||
    path.startsWith('/category/') ||
    path.startsWith('/author/') ||
    path.startsWith('/tags/')
  )
}

function isPrivateNoStorePath(path: string): boolean {
  return (
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path.startsWith('/preview/') ||
    path === '/subscribe' ||
    path === '/confirm' ||
    path === '/unsubscribe'
  )
}

export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>()

  app.use('*', async (c, next) => {
    c.set('requestId', crypto.randomUUID().slice(0, 8))
    c.set('user', null)
    c.set('session', null)
    await next()
  })

  app.use('*', async (c, next) => {
    await next()
    const path = c.req.path
    const allowAnalytics = path !== '/admin' && !path.startsWith('/admin/') && !path.startsWith('/preview/')
    c.header('X-Content-Type-Options', 'nosniff')
    c.header('X-Frame-Options', 'DENY')
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()')
    c.header('Content-Security-Policy', contentSecurityPolicy(allowAnalytics))
    if (isProd()) c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  })

  app.use('*', async (c, next) => {
    if (c.req.path === '/api/webhooks/resend' || c.req.path === '/unsubscribe') {
      await next()
      return
    }
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method)) {
      const origin = c.req.header('origin')
      if (origin) {
        const allowed = new Set([
          new URL(c.req.url).origin,
          getConfig().PUBLIC_ORIGIN.replace(/\/$/, ''),
        ])
        if (!allowed.has(origin.replace(/\/$/, ''))) {
          return c.text('Cross-origin request blocked.', 403)
        }
      }
      if (c.req.header('sec-fetch-site') === 'cross-site') {
        return c.text('Cross-site request blocked.', 403)
      }
    }
    await next()
  })

  // Static files are handled before any session or database work.
  app.use('/assets/*', async (c, next) => {
    await next()
    if (c.res.ok) c.header('Cache-Control', 'public, max-age=31536000, immutable')
  })
  app.use('/fonts/*', async (c, next) => {
    await next()
    if (c.res.ok) c.header('Cache-Control', 'public, max-age=604800')
  })
  app.use('/theme.js', async (c, next) => {
    await next()
    if (c.res.ok) c.header('Cache-Control', 'public, max-age=3600')
  })
  app.use('/analytics.js', async (c, next) => {
    await next()
    if (c.res.ok) c.header('Cache-Control', 'public, max-age=3600')
  })
  // Vite copies public assets into dist/client during a production build, so
  // the deployed function only needs that directory.
  const staticRoot = isProd() ? './dist/client' : './public'
  app.use('/assets/*', serveStatic({ root: './dist/client' }))
  app.use('/fonts/*', serveStatic({ root: staticRoot }))
  app.use('/theme.js', serveStatic({ root: staticRoot }))
  app.use('/analytics.js', serveStatic({ root: staticRoot }))
  app.use('/favicon.svg', serveStatic({ root: staticRoot }))
  app.use('/manifest.webmanifest', serveStatic({ root: staticRoot }))

  app.get('/uploads/:file', async (c) => {
    const filename = c.req.param('file')
    if (!/^[a-zA-Z0-9_-]+\.(webp|avif|jpe?g|png|gif|svg)$/.test(filename)) {
      return c.notFound()
    }
    const extension = filename.split('.').pop()?.toLowerCase() ?? ''
    const file = Bun.file(join(getConfig().UPLOAD_DIR, filename))
    if (!(await file.exists())) return c.notFound()
    return new Response(file, {
      headers: {
        'Content-Type': CONTENT_TYPES[extension] ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  })

  app.use('*', async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE)
    if (token) {
      const result = await getSessionUser(token).catch(() => null)
      if (result) {
        c.set('user', result.user)
        c.set('session', result.session)
      }
    }
    await next()
  })

  app.use('*', async (c, next) => {
    const start = performance.now()
    await next()
    if (!isProd()) {
      const duration = Math.round(performance.now() - start)
      console.log(`${c.req.method} ${c.req.path} → ${c.res.status} (${duration}ms)`)
    }
    if (c.res.headers.get('content-type')?.includes('text/html') && !c.res.headers.has('cache-control')) {
      const path = c.req.path
      if (isPrivateNoStorePath(path) || c.get('user')) {
        c.header('Cache-Control', 'private, no-store')
      } else if (c.req.method === 'GET' && c.res.status === 200 && isPublicCacheableHtmlPath(path)) {
        c.header('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300')
      } else {
        c.header('Cache-Control', 'no-cache')
      }
    }
  })

  registerPublicRoutes(app)
  registerAdminRoutes(app)

  app.notFound(async (c) => {
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    const settings = await getSiteSettings().catch(() => defaultSettings)
    const categories = await listCategories({ withCounts: true }).catch(() => [])
    return renderPageResponse(c, {
      element: (
        <NotFoundPage settings={settings} categories={categories} status={404} />
      ),
      head: baseHead({
        settings,
        origin,
        title: 'Halaman tidak ditemukan',
        description: 'Alamat yang kamu minta tidak ada di indeks.',
        path: c.req.path,
        robots: 'noindex, follow',
      }),
      status: 404,
    })
  })

  app.onError(async (error, c) => {
    const requestId = c.get('requestId')
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorDetail = error instanceof Error ? (error.stack ?? error.name) : String(error)
    await recordOpsEvent({
      level: 'error',
      source: 'http',
      code: 'unhandled_error',
      message: errorMessage || 'Unhandled server error',
      detail: errorDetail,
      requestId,
      path: c.req.path,
    })
    if (c.req.path.startsWith('/api/')) {
      return c.json({ error: 'Internal server error', requestId }, 500)
    }
    const settings = await getSiteSettings().catch(() => defaultSettings)
    const categories = await listCategories({ withCounts: true }).catch(() => [])
    const origin = getConfig().PUBLIC_ORIGIN.replace(/\/$/, '')
    return renderPageResponse(c, {
      element: (
        <NotFoundPage settings={settings} categories={categories} status={500} requestId={requestId} />
      ),
      head: baseHead({
        settings,
        origin,
        title: 'Kesalahan server',
        description: 'Terjadi kesalahan tak terduga.',
        path: c.req.path,
        robots: 'noindex, nofollow',
      }),
      status: 500,
    })
  })

  return app
}
