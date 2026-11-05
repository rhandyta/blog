import { ensureDb } from '../src/lib/db/migrate'

await ensureDb()
console.log('[db] migrations applied')
