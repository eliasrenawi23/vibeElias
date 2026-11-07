import { defineConfig } from 'vitest/config';

// Default export required by vitest.
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
