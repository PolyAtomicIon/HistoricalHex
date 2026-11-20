import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const page = (file: string) => fileURLToPath(new URL(file, import.meta.url));

export default defineConfig({
  // На сервере игра живёт в /catan/ (VITE_BASE=/catan/ npm run build)
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
  build: {
    rollupOptions: {
      // index.html — всё приложение; host.html — переадресация для старых ссылок
      input: { main: page('./index.html'), host: page('./host.html') },
    },
    chunkSizeWarningLimit: 1500,
  },
  server: {
    host: true,
    // Локальная разработка: npm run server (порт 8790) + npm run dev
    proxy: { '/ws': { target: 'ws://127.0.0.1:8790', ws: true } },
  },
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/live/**', 'node_modules/**'],
  },
});
