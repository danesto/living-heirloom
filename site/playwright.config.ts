import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

/** Dev server, only used by the dev-mode tests (dev mode is not in production builds). */
export const DEV_PORT = 5174;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  reporter: process.env['CI'] ? 'github' : 'list',
  use: { baseURL: `http://localhost:${String(PORT)}`, trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: `pnpm build && pnpm preview --port ${String(PORT)} --strictPort`,
      port: PORT,
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: `pnpm dev --port ${String(DEV_PORT)} --strictPort`,
      port: DEV_PORT,
      reuseExistingServer: !process.env['CI'],
    },
  ],
});
