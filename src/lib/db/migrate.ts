import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Database } from 'bun:sqlite'
import { getSqlite } from './client'

const migrationsDir = join(import.meta.dir, 'migrations')

let migrated = false

export function runMigrations(sqlite: Database = getSqlite()): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `)

  const applied = new Set(
    (sqlite.query('SELECT name FROM _migrations').all() as Array<{ name: string }>).map((row) => row.name),
  )

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = readFileSync(join(migrationsDir, file), 'utf8')
    try {
      sqlite.exec(sql)
    } catch (error) {
      if (file.includes('search')) {
        console.warn(`[db] full-text search unavailable — falling back to LIKE queries (${String(error)})`)
      } else {
        throw error
      }
    }
    sqlite.query('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(file, new Date().toISOString())
  }
}

export function ensureDb(): Database {
  const sqlite = getSqlite()
  if (!migrated) {
    runMigrations(sqlite)
    migrated = true
  }
  return sqlite
}

export function resetMigrationState(): void {
  migrated = false
}
