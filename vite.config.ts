import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const src = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  // Our HTML shell is server-rendered (there is no Vite index.html), so the
  // React Refresh preamble is injected by src/server/document.ts in dev.
  plugins: [react(), tailwindcss()],
  publicDir: 'public',
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    manifest: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        site: `${src}/client/site.ts`,
        search: `${src}/client/search.ts`,
        admin: `${src}/client/admin.tsx`,
        'admin-common': `${src}/client/admin-common.ts`,
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    cors: true,
    origin: 'http://localhost:5173',
  },
})
