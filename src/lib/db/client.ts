import { Database } from 'bun:sqlite'
import { drizzle as drizzleBun } from 'drizzle-orm/bun-sqlite'
import { drizzle as drizzleLibsql, type LibSQLDatabase } from 'drizzle-orm/libsql'
import { createClient, type Client } from '@libsql/client'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { getConfig, isRemoteDatabase } from '../config'
import * as schema from './schema'

export type AppDatabase = LibSQLDatabase<typeof schema>
export type SqlRow = Record<string, unknown>

let sqliteInstance: Database | null = null
let libsqlClient: Client | null = null
let dbInstance: AppDatabase | null = null

function localSqlite(): Database {
  if (isRemoteDatabase()) {
    throw new Error('The local SQLite driver is unavailable when TURSO_DATABASE_URL is set')
  }
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

function remoteClient(): Client {
  if (!libsqlClient) {
    const config = getConfig()
    if (!config.TURSO_DATABASE_URL) {
      throw new Error('TURSO_DATABASE_URL is not configured')
    }
    libsqlClient = createClient({
      url: config.TURSO_DATABASE_URL,
      authToken: config.TURSO_AUTH_TOKEN,
    })
  }
  return libsqlClient
}

export function getDb(): AppDatabase {
  if (!dbInstance) {
    if (isRemoteDatabase()) {
      dbInstance = drizzleLibsql(remoteClient(), { schema }) as AppDatabase
    } else {
      // The sync bun:sqlite driver exposes the same query builder API for the
      // awaited calls used throughout the app.
      dbInstance = drizzleBun(localSqlite(), { schema }) as unknown as AppDatabase
    }
  }
  return dbInstance
}

export function closeDb(): void {
  dbInstance = null
  libsqlClient?.close()
  libsqlClient = null
  sqliteInstance?.close()
  sqliteInstance = null
}

export async function all<T = SqlRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (isRemoteDatabase()) {
    const result = await remoteClient().execute({ sql, args: params as never })
    return result.rows as unknown as T[]
  }
  const statement = localSqlite().query(sql)
  return (params.length ? statement.all(...(params as never[])) : statement.all()) as T[]
}

export async function get<T = SqlRow>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  if (isRemoteDatabase()) {
    const result = await remoteClient().execute({ sql, args: params as never })
    return result.rows[0] as unknown as T | undefined
  }
  const statement = localSqlite().query(sql)
  return (params.length ? statement.get(...(params as never[])) : statement.get()) as T | undefined
}

export async function run(sql: string, params: unknown[] = []): Promise<void> {
  if (isRemoteDatabase()) {
    await remoteClient().execute({ sql, args: params as never })
    return
  }
  const statement = localSqlite().query(sql)
  if (params.length) statement.run(...(params as never[]))
  else statement.run()
}

export async function exec(sql: string): Promise<void> {
  if (isRemoteDatabase()) {
    await remoteClient().executeMultiple(sql)
    return
  }
  localSqlite().exec(sql)
}

export async function hasFts5(): Promise<boolean> {
  const row = await get<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'article_fts'",
  )
  return Boolean(row)
}

export { schema }
