import { defineConfig } from '@playwright/test';
const port = process.env.ZUNO_TEST_PORT || '8082';
export default defineConfig({
  testDir: './tests',
  testMatch:
    process.env.ZUNO_TEST_PHONE_PREVIEW === '1' ? 'phone-signup.spec.ts' : 'journeys.spec.ts',
  timeout: 45000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1440, height: 960 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
  },
  webServer: {
    command: 'node scripts/test-web-server.mjs',
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    timeout: 90000,
  },
});
