import { rmSync } from 'node:fs';

// Runs after the test framework is installed in every e2e file: removes the per-file upload
// folder created in setup-env.ts once the file's suites (and their app instances) are done.
afterAll(() => {
  const dir = process.env.UPLOAD_DIR;
  if (dir && /renawi-e2e-uploads-/.test(dir)) rmSync(dir, { recursive: true, force: true });
});
