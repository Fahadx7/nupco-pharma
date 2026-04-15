import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        // Externalize ALL non-relative imports in the main process.
        // This is critical: native .node binaries (better-sqlite3, bindings)
        // cannot be processed by Rollup and must load from node_modules at runtime.
        external: (id: string) => {
          if (id.startsWith('.') || id.startsWith('/') || id.startsWith('\0')) return false
          return true
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react()],
    resolve: { alias: { '@': resolve(__dirname, 'src') } },
  },
})
