import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react({
      // Enable React Fast Refresh for better DX
      fastRefresh: true,
    }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Enable minification for production
    minify: 'esbuild', // Faster than terser
    // Optimize chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks for better caching
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-label', '@radix-ui/react-separator', '@radix-ui/react-slot'],
          'chart-vendor': ['recharts'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'query-vendor': ['@tanstack/react-query'],
        },
        // Optimize chunk file names for better caching
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    // Increase chunk size warning limit (we're using manual chunks)
    chunkSizeWarningLimit: 1000,
    // Enable source maps for production debugging (optional, can disable for smaller builds)
    sourcemap: false,
    // Optimize CSS
    cssCodeSplit: true,
    // Target modern browsers for smaller bundles
    target: 'esnext',
  },
  // Optimize dependencies pre-bundling
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      '@tanstack/react-query',
    ],
  },
  // Note: Vite dev server automatically handles SPA routing by serving index.html for all routes
  // For production, configure your web server (nginx, Apache, etc.) to serve index.html for all routes
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
})

