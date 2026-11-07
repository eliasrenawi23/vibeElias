import { defineConfig } from 'tsup';

// Default export required by tsup.
export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  // In watch mode (npm run dev) keep the previous build so the API never sees an empty dist/.
  clean: !options.watch,
  target: 'es2022',
  platform: 'neutral',
  splitting: false,
  treeshake: true,
  // Keep Hebrew/Arabic locale strings readable (and smaller) in the bundle.
  esbuildOptions(esbuild) {
    esbuild.charset = 'utf8';
  },
}));
