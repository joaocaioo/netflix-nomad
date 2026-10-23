import { defineConfig } from '@playwright/test';

// A extensão é compilada antes (`npm run test:e2e`) e carregada em
// tests/e2e/fixtures.ts.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  reporter: process.env.CI ? 'github' : 'list',
  use: { trace: 'retain-on-failure' },
});
