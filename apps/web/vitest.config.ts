import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import { aliases, dedupe } from './vite.config.ts';

// Default export required by vitest.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: aliases, dedupe },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
    // AntD component tests (dialogs, the lease wizard) need more than the 5 s default on a busy
    // machine: the first render of a file pays for the AntD import and style generation.
    testTimeout: 20_000,
  },
});
