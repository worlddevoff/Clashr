import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['@solana/web3.js', 'buffer', 'three'],
  },
  resolve: {
    alias: {
      buffer: 'buffer',
      '@shared': path.resolve(import.meta.dirname, 'shared'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3001',
      '/ws': { target: 'ws://127.0.0.1:3001', ws: true },
    },
    fs: {
      allow: [path.resolve(import.meta.dirname)],
    },
  },
})
