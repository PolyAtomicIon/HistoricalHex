// Живые тесты: настоящая база Firebase (нужны интернет и выложенные правила).
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/live/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 60_000,
  },
});
