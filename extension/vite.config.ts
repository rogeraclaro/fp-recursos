import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup/index.html'),
        content: resolve(__dirname, 'content/content.ts'),
        'service-worker': resolve(__dirname, 'background/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Content script and service worker need specific paths
          if (chunkInfo.name === 'content') {
            return 'content/content.js';
          }
          if (chunkInfo.name === 'service-worker') {
            return 'background/service-worker.js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        // Inline all imports for service worker and content script
        manualChunks: (id) => {
          // Don't split chunks for service worker dependencies
          if (id.includes('shared/api') || id.includes('shared/config') || id.includes('shared/types')) {
            return undefined; // Will be inlined
          }
        },
      },
    },
  },
});
