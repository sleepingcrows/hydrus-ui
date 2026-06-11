import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const buildTimestamp = new Date().toISOString().replace('T', ' ').slice(0, 19)

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'inject-sw-cache-hash',
      closeBundle() {
        const swPath = resolve('dist/sw.js')
        if (!existsSync(swPath)) return
        const sw = readFileSync(swPath, 'utf-8')
        writeFileSync(swPath, sw.replace('__SW_CACHE_HASH__', buildTimestamp))
      },
    },
  ],
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
  },
})
