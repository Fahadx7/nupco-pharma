import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        // Force native modules to stay external — never bundle .node binaries
        external: [
          'better-sqlite3',
          'bindings',
          'file-uri-to-path',
          /^better-sqlite3.*/,
        ],
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
