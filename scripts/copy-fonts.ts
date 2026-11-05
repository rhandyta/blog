import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = join(import.meta.dir, '..')
const outDir = join(root, 'public', 'fonts')
mkdirSync(outDir, { recursive: true })

const candidates: Array<[string, Array<string>]> = [
  ['newsreader.woff2', ['@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2']],
  ['newsreader-italic.woff2', ['@fontsource-variable/newsreader/files/newsreader-latin-wght-italic.woff2']],
  ['fraunces.woff2', ['@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2']],
  ['fraunces-italic.woff2', ['@fontsource-variable/fraunces/files/fraunces-latin-wght-italic.woff2']],
  [
    'plex-mono-400.woff2',
    [
      '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2',
      '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff',
    ],
  ],
  [
    'plex-mono-500.woff2',
    [
      '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2',
      '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2',
      '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff',
    ],
  ],
]

let copied = 0
for (const [target, sources] of candidates) {
  const source = sources
    .map((relative) => join(root, 'node_modules', relative))
    .find((path) => existsSync(path))
  if (!source) {
    console.warn(`[fonts] missing source for ${target} — the site will fall back to system fonts`)
    continue
  }
  copyFileSync(source, join(outDir, target))
  copied += 1
}
console.log(`[fonts] copied ${copied} font files to public/fonts`)
