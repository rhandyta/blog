import { ensureDb } from '../src/lib/db/migrate'

ensureDb()
console.log('[db] migrations applied')
