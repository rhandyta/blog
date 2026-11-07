import type { Context } from 'hono'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import type { PageHead } from '../lib/seo/meta'
import { renderHead } from '../lib/seo/meta'
import { renderDocument } from './document'
import type { Entry } from './assets'
import type { AppEnv } from './types'

export function renderPageResponse(
  c: Context<AppEnv>,
  options: {
    element: ReactElement
    head: PageHead
    status?: number
    entry?: Entry
    extraEntries?: Entry[]
    noScripts?: boolean
  },
): Response {
  const body = renderToString(options.element)
  const html = renderDocument({
    head: renderHead(options.head),
    body,
    entry: options.entry ?? 'site',
    extraEntries: options.extraEntries,
    bodyClass: (options.entry ?? 'site').startsWith('admin') ? 'admin-body' : 'site-body',
    lang: options.head.lang,
    noScripts: options.noScripts,
  })
  c.header('Content-Type', 'text/html; charset=utf-8')
  return c.html(html, (options.status ?? 200) as 200)
}
