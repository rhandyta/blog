import { join } from 'node:path'

const root = join(import.meta.dir, '..')

const vite = Bun.spawn(['bun', 'x', 'vite', '--host', '127.0.0.1'], {
  cwd: root,
  stdout: 'inherit',
  stderr: 'inherit',
})

const server = Bun.spawn(['bun', '--watch', 'src/server/index.ts'], {
  cwd: root,
  stdout: 'inherit',
  stderr: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' },
})

let shuttingDown = false
const shutdown = () => {
  if (shuttingDown) return
  shuttingDown = true
  vite.kill()
  server.kill()
  setTimeout(() => process.exit(0), 300)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

await Promise.race([vite.exited, server.exited])
shutdown()
