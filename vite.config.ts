import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  publicDir: 'public',
  server: {
    port: 1420,
    strictPort: true,
    host: process.env.TAURI_DEV_HOST || '127.0.0.1',
  },
  optimizeDeps: { exclude: ['pdfjs-dist'] },
  build: { target: 'es2022' },
  test: { include: ['src/**/*.test.ts'] },
});
