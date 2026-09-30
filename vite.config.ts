import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// BASE_PATH lets the app be hosted under a sub-path (e.g. GitHub Pages:
// BASE_PATH=/timetable/ npm run build). Defaults to '/'.
const base = process.env.BASE_PATH || '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  worker: { format: 'es' },
  test: {
    include: ['src/**/*.test.ts', 'qa/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120000,
  },
})
