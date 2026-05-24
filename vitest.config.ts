import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    exclude: ['**/node_modules/**', '**/toy-repo/**'],
    testTimeout: 60000,
    hookTimeout: 30000,
    clearMocks: true,
  },
});
