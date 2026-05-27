import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { copyFileSync, mkdirSync } from 'node:fs';

export default defineConfig({
  plugins: [
    react(),
    {
      // Plugin to copy manifest.json and icons to dist after build
      // Also renames popup/index.html → popup.html at root (required by MV3 manifest)
      name: 'copy-extension-files',
      closeBundle() {
        mkdirSync('dist', { recursive: true });
        copyFileSync('public/manifest.json', 'dist/manifest.json');
        // Vite outputs popup entry as dist/src/popup/index.html — copy to dist/popup.html
        try {
          const { readFileSync } = require('node:fs');
          const htmlContent = readFileSync('dist/src/popup/index.html', 'utf8');
          require('node:fs').writeFileSync('dist/popup.html', htmlContent);
        } catch {
          // Fall through — Vite may output differently
        }
        // Copy icons if they exist
        try {
          mkdirSync('dist/icons', { recursive: true });
          copyFileSync('public/icons/icon-16.png', 'dist/icons/icon-16.png');
          copyFileSync('public/icons/icon-32.png', 'dist/icons/icon-32.png');
          copyFileSync('public/icons/icon-48.png', 'dist/icons/icon-48.png');
          copyFileSync('public/icons/icon-128.png', 'dist/icons/icon-128.png');
        } catch {
          // Icons may not exist yet — silently skip
        }
      },
    },
  ],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: {
        // Popup page
        popup: resolve(__dirname, 'src/popup/index.html'),
        // Background service worker
        background: resolve(__dirname, 'src/background/index.ts'),
        // Content script
        content: resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
});
