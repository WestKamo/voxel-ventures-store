import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
      ? {
          executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
          args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu-compositing',
            '--use-gl=angle',
            '--use-angle=swiftshader',
          ],
        }
      : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/server.mjs',
      url: 'http://localhost:5000/health',
      timeout: 120000,
      reuseExistingServer: false,
    },
    {
      command: process.env.E2E_PRODUCTION
        ? 'npm run preview -w client -- --host 127.0.0.1 --port 5173'
        : 'npm run dev -w client -- --host 127.0.0.1',
      url: 'http://localhost:5173',
      timeout: 60000,
      reuseExistingServer: false,
    },
  ],
});
