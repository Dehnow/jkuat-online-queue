import { defineConfig } from '@tanstack/start/config'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  server: {
    preset: 'node-server',   // ✅ outputs to .output/server/index.mjs
  },
  vite: {
    plugins: [
      viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
      tailwindcss(),
      viteReact(),
    ],
  },
})