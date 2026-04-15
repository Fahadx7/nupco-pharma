import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Native modules that MUST load from node_modules at runtime — they contain
// dynamic require() calls for .node binaries that @rollup/plugin-commonjs
// cannot statically resolve.
const NATIVE_MODULES = [
  'better-sqlite3',
  'bindings',
  'node-gyp-build',
  'electron',
]

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: [] })],
    build: {
      rollupOptions: {
        // Belt-and-suspenders: externalize any non-relative id so every bare
        // specifier (including transitive deps like `bindings`) resolves from
        // node_modules at runtime instead of being inlined by Rollup.
        external: (id: string) => {
          if (id.startsWith('.') || id.startsWith('/') || id.startsWith('\0')) return false
          if (NATIVE_MODULES.includes(id)) return true
          if (NATIVE_MODULES.some(m => id.startsWith(`${m}/`))) return true
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
