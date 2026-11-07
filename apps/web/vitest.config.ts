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
  },
});
