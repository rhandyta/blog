import { all, exec, run } from './client'
import { migrations } from './migration-sql'

let migrated: Promise<void> | null = null

export function ensureDb(): Promise<void> {
  if (!migrated) {
    migrated = runMigrations()
  }
  return migrated
}

export async function runMigrations(): Promise<void> {
  await exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `)

  const applied = new Set(
    (await all<{ name: string }>('SELECT name FROM _migrations')).map((row) => row.name),
  )

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue
    try {
      await exec(migration.sql)
    } catch (error) {
      const message = String(error).toLowerCase()
      if (migration.name.includes('search')) {
        console.warn(`[db] full-text search unavailable — falling back to LIKE queries (${String(error)})`)
      } else if (message.includes('duplicate column name')) {
        // A previous run applied the ALTER TABLE but was interrupted before it
        // could record the migration. The schema is already correct.
        console.warn(`[db] ${migration.name} already applied; recording it`)
      } else {
        throw error
      }
    }
    await run('INSERT OR IGNORE INTO _migrations (name, applied_at) VALUES (?, ?)', [
      migration.name,
      new Date().toISOString(),
    ])
  }
}

export function resetMigrationState(): void {
  migrated = null
}
