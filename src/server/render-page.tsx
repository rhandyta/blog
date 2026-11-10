import type { Context } from 'hono'
import type { ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import { I18nProvider } from '../lib/i18n/react'
import { LOCALE_META, type Locale } from '../lib/i18n'
import type { PageHead } from '../lib/seo/meta'
import { renderHead } from '../lib/seo/meta'
import { renderDocument } from './document'
import type { Entry } from './assets'
import type { AppEnv } from './types'

export type RenderPageOptions = {
  element: ReactElement
  head: PageHead
  status?: number
  entry?: Entry
  extraEntries?: Entry[]
  noScripts?: boolean
  noAnalytics?: boolean
}

const SITE_ENTRIES = new Set<Entry>(['site', 'search'])

/**
 * Renders a React tree to HTML inside the request's language context. Public
 * entries get locale-prefixed links; the editorial desk keeps its own URLs.
 */
export function renderPageResponse(c: Context<AppEnv>, options: RenderPageOptions): Response {
  const entry = options.entry ?? 'site'
  const locale: Locale = (c.get('locale') as Locale | undefined) ?? 'id'
  const localPath = c.get('localPath') ?? c.req.path
  const currentPath = `${localPath}${new URL(c.req.url).search}`
  const element = (
    <I18nProvider locale={locale} localizedLinks={SITE_ENTRIES.has(entry)} currentPath={currentPath}>
      {options.element}
    </I18nProvider>
  )
  const body = renderToString(element)
  const html = renderDocument({
    head: renderHead(options.head),
    body,
    entry,
    extraEntries: options.extraEntries,
    bodyClass: entry.startsWith('admin') ? 'admin-body' : 'site-body',
    lang: options.head.lang ?? LOCALE_META[locale].htmlLang,
    noScripts: options.noScripts,
    noAnalytics: options.noAnalytics,
  })
  c.header('Content-Type', 'text/html; charset=utf-8')
  c.header('Content-Language', locale)
  return c.html(html, (options.status ?? 200) as 200)
}
