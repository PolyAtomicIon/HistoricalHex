import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const page = (file: string) => fileURLToPath(new URL(file, import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // Две страницы: игрок (index.html) и хост (host.html)
      input: { main: page('./index.html'), host: page('./host.html') },
    },
  },
  // Доступ с телефонов в той же сети при `npm run dev`
  server: { host: true },
  test: {
    include: ['test/**/*.test.ts'],
    // Живые тесты ходят в настоящую базу — запускаются отдельно: npm run test:live
    exclude: ['test/live/**', 'node_modules/**'],
  },
});
