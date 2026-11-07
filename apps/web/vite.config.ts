import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brand, pwa } from '@renawi/brand/tokens';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const here = dirname(fileURLToPath(import.meta.url));
const sharedEntry = resolve(here, '../../packages/shared/src/index.ts');
const brandDir = resolve(here, '../../packages/brand');

/**
 * Aliases shared with vitest.config.ts. `@renawi/shared` points at the TypeScript source so edits
 * hot-reload without rebuilding the package; `@renawi/brand/*` points at the package directory.
 */
export const aliases = [
  { find: /^@renawi\/shared$/, replacement: sharedEntry },
  { find: /^@renawi\/brand\/(.*)$/, replacement: `${brandDir}/$1` },
];

/**
 * npm hoists zod 4 (used by the API tooling) to the root, so shared and web each get a nested
 * zod 3.25 copy. Dedupe resolves every `zod` import from this app, giving one instance (the
 * validation error map installed at startup then applies to the shared schemas too).
 */
export const dedupe = ['zod'];

/** Brand files served at fixed URLs (favicon, PWA manifest icons). */
const BRAND_PUBLIC_FILES: Record<string, string> = {
  'favicon.svg': 'logo/favicon.svg',
  'icons/icon-192.png': 'icons/icon-192.png',
  'icons/icon-512.png': 'icons/icon-512.png',
  'icons/maskable-512.png': 'icons/maskable-512.png',
  'icons/apple-touch-icon-180.png': 'icons/apple-touch-icon-180.png',
};

/**
 * Serves the brand icons in dev and emits them into the build, so they are not duplicated into
 * `public/`. Must run before the PWA plugin so the files are precached.
 */
function brandPublicFiles(): Plugin {
  return {
    name: 'renawi-brand-public-files',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0]?.replace(/^\//, '') ?? '';
        const source = BRAND_PUBLIC_FILES[path];
        if (!source) return next();
        res.setHeader('Content-Type', path.endsWith('.svg') ? 'image/svg+xml' : 'image/png');
        res.end(readFileSync(join(brandDir, source)));
      });
    },
    generateBundle() {
      for (const [fileName, source] of Object.entries(BRAND_PUBLIC_FILES)) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(join(brandDir, source)) });
      }
    },
  };
}

// Default export required by Vite.
export default defineConfig({
  plugins: [
    react(),
    brandPublicFiles(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: brand.name.en,
        short_name: 'Renawi',
        description: 'Renawi Motors - car dealership and taxi licences',
        lang: 'he',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: brand.colors.yellow,
        background_color: pwa.backgroundColor,
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell only: scripts, styles, the HTML entry and the brand icons.
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: { maxEntries: 60, maxAgeSeconds: 365 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  resolve: { alias: aliases, dedupe },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY ?? 'http://localhost:3000',
        changeOrigin: false,
      },
    },
  },
  preview: { port: 4173 },
  build: {
    sourcemap: true,
    // Ant Design alone is ~1.2 MB minified (Steps, Drawer, Timeline... since milestone 3); it gets
    // its own long-lived chunk.
    chunkSizeWarningLimit: 1400,
    rolldownOptions: {
      output: {
        // Vendor chunks change rarely, so they stay cached across app deploys.
        // (Module ids are normalised to forward slashes, also on Windows.)
        codeSplitting: {
          groups: [
            {
              name: 'react',
              test: /\/node_modules\/(react|react-dom|react-router|scheduler)\//,
              priority: 30,
            },
            {
              name: 'antd',
              test: /\/node_modules\/(antd|@ant-design|@rc-component)\//,
              priority: 20,
            },
            { name: 'vendor', test: /\/node_modules\//, priority: 10 },
          ],
        },
      },
    },
  },
});
