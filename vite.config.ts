import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Note: Vite dev server automatically handles SPA routing by serving index.html for all routes
  // For production, configure your web server (nginx, Apache, etc.) to serve index.html for all routes
  test: {
    globals: true,
    environment: 'node',
    setupFiles: './src/test/setup.ts',
  },
})

