import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { getConfig } from '../src/lib/config'

const config = getConfig()
const targets = [config.DATABASE_PATH, `${config.DATABASE_PATH}-wal`, `${config.DATABASE_PATH}-shm`, config.UPLOAD_DIR]

for (const target of targets) {
  if (target === ':memory:') continue
  try {
    rmSync(resolve(target), { recursive: true, force: true })
    console.log(`[reset] removed ${target}`)
  } catch (error) {
    console.warn(`[reset] could not remove ${target}:`, error)
  }
}

console.log('[reset] done — run `bun run db:migrate && bun run db:seed` to rebuild.')
