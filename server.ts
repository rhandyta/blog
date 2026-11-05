import { Hono } from 'hono'
import { createApp } from './src/server/app'
import { ensureDb } from './src/lib/db/migrate'

await ensureDb()

// Vercel's Bun preset builds Hono applications from this default export and
// routes every request to it. The direct `hono` import is required by its
// entrypoint detection.
void Hono
const app = createApp()
export default app
