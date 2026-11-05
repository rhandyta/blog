import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { isProd } from '../lib/config'

export type Entry = 'site' | 'search' | 'admin' | 'admin-common'
type ManifestChunk = {
  file: string
  src?: string
  isEntry?: boolean
  css?: string[]
  imports?: string[]
}

let manifest: Record<string, ManifestChunk> | null = null

function loadManifest(): Record<string, ManifestChunk> {
  if (manifest) return manifest
  const path = join(process.cwd(), 'dist', 'client', '.vite', 'manifest.json')
  if (!existsSync(path)) {
    console.warn('[assets] production manifest missing — run `bun run build`')
    manifest = {}
    return manifest
  }
  manifest = JSON.parse(readFileSync(path, 'utf8')) as Record<string, ManifestChunk>
  return manifest
}

export function assetTags(entry: Entry): { scripts: string[]; styles: string[] } {
  if (!isProd()) {
    const origin = (process.env.VITE_ORIGIN || 'http://localhost:5173').replace(/\/$/, '')
    const file =
      entry === 'admin'
        ? 'src/client/admin.tsx'
        : entry === 'admin-common'
          ? 'src/client/admin-common.ts'
          : entry === 'search'
            ? 'src/client/search.ts'
            : 'src/client/site.ts'
    return {
      scripts: [`${origin}/${file}`],
      styles: [],
    }
  }

  const data = loadManifest()
  const target = Object.entries(data).find(([key, chunk]) => {
    if (!chunk.isEntry) return false
    return key.endsWith(`client/${entry}.ts`) || key.endsWith(`client/${entry}.tsx`)
  })?.[1]

  if (!target) return { scripts: [], styles: [] }
  return {
    scripts: [`/${target.file}`],
    styles: (target.css ?? []).map((css) => `/${css}`),
  }
}

export function viteClientScript(): string | null {
  if (isProd()) return null
  const origin = (process.env.VITE_ORIGIN || 'http://localhost:5173').replace(/\/$/, '')
  return `${origin}/@vite/client`
}
