import { ensureDb } from '../src/lib/db/migrate'
import { rebuildSearchIndex } from '../src/lib/db/queries/articles'

await ensureDb()
const total = await rebuildSearchIndex()
console.log(`[search] indexed ${total} published articles`)
