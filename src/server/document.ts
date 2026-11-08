import { assetTags, viteClientScript, type Entry } from './assets'
import { isProd } from '../lib/config'

export type DocumentOptions = {
  head: string
  body: string
  entry: Entry
  extraEntries?: Entry[]
  bodyClass?: string
  lang?: string
  noScripts?: boolean
  noAnalytics?: boolean
}

export function renderDocument(options: DocumentOptions): string {
  const entries: Entry[] = [options.entry, ...(options.extraEntries ?? [])]
  const assets = entries.map((entry) => assetTags(entry))
  const styles = [...new Set(assets.flatMap((asset) => asset.styles))]
  const scripts = [...new Set(assets.flatMap((asset) => asset.scripts))]
  const viteClient = viteClientScript()
  const includeAnalytics =
    !options.noAnalytics && options.entry !== 'admin' && options.entry !== 'admin-common'

  const styleTags = styles.map((href) => `<link rel="stylesheet" href="${href}">`).join('\n    ')
  const scriptTags = scripts
    .map((src) => `<script type="module" src="${src}"></script>`)
    .join('\n    ')
  const viteTag = viteClient ? `<script type="module" src="${viteClient}"></script>` : ''
  const viteOrigin = (process.env.VITE_ORIGIN || 'http://localhost:5173').replace(/\/$/, '')
  const refreshPreamble =
    !isProd() && options.entry === 'admin'
      ? `<script type="module">
      import RefreshRuntime from "${viteOrigin}/@react-refresh"
      RefreshRuntime.injectIntoGlobalHook(window)
      window.$RefreshReg$ = () => {}
      window.$RefreshSig$ = () => (type) => type
      window.__vite_plugin_react_preamble_installed__ = true
    </script>`
      : ''

  return `<!doctype html>
<html lang="${options.lang ?? 'en'}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f6f2e9">
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#14130f">
    <meta name="color-scheme" content="light dark">
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <link rel="manifest" href="/manifest.webmanifest">
    <link rel="preload" href="/fonts/newsreader.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/fonts/fraunces.woff2" as="font" type="font/woff2" crossorigin>
    ${includeAnalytics
      ? `<script src="/analytics.js"></script>
    <script async src="https://www.googletagmanager.com/gtm.js?id=GTM-NSRP398Z"></script>
    <script async src="https://www.googletagmanager.com/gtm.js?id=GTM-TW77C5JM"></script>`
      : ''}
    <script src="/theme.js"></script>
    ${options.head}
    ${styleTags}
  </head>
  <body class="${options.bodyClass ?? 'site-body'}">
    ${options.body}
    ${options.noScripts ? '' : refreshPreamble}
    ${options.noScripts ? '' : scriptTags}
    ${options.noScripts ? '' : viteTag}
  </body>
</html>`
}
