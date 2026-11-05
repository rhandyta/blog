import { Database } from 'bun:sqlite'
import { drizzle, type BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { getConfig } from '../config'
import * as schema from './schema'

let sqliteInstance: Database | null = null
let dbInstance: BunSQLiteDatabase<typeof schema> | null = null

export function getSqlite(): Database {
  if (!sqliteInstance) {
    const path = getConfig().DATABASE_PATH
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true })
    }
    sqliteInstance = new Database(path, { create: true, safeIntegers: false })
    sqliteInstance.exec('PRAGMA journal_mode = WAL')
    sqliteInstance.exec('PRAGMA foreign_keys = ON')
    sqliteInstance.exec('PRAGMA busy_timeout = 5000')
  }
  return sqliteInstance
}

export function getDb(): BunSQLiteDatabase<typeof schema> {
  if (!dbInstance) {
    dbInstance = drizzle(getSqlite(), { schema })
  }
  return dbInstance
}

export function closeDb(): void {
  dbInstance = null
  sqliteInstance?.close()
  sqliteInstance = null
}

export function hasFts5(): boolean {
  const row = getSqlite()
    .query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'article_fts'")
    .get() as { name: string } | undefined
  return Boolean(row)
}

export { schema }
