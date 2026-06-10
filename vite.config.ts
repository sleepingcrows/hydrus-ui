import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const gitHash = (() => {
  const headPath = resolve('.git/HEAD')
  if (!existsSync(headPath)) return 'unknown'
  try {
    const head = readFileSync(headPath, 'utf-8').trim()
    if (head.startsWith('ref: ')) {
      const refPath = resolve('.git', head.slice(5))
      return readFileSync(refPath, 'utf-8').trim().slice(0, 7)
    }
    return head.slice(0, 7)
  } catch {
    return 'unknown'
  }
})()

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
        writeFileSync(swPath, sw.replace('__SW_CACHE_HASH__', gitHash))
      },
    },
  ],
  define: {
    __GIT_HASH__: JSON.stringify(gitHash),
  },
})
