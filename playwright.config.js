import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:4174',
    browserName: 'chromium',
    launchOptions: process.env.CARDLY_CHROME_PATH ? { executablePath: process.env.CARDLY_CHROME_PATH } : {},
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
  },
});
