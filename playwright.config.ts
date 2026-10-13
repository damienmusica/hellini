import { defineConfig, devices } from '@playwright/test';

// 로컬에 이미 설치된 Chromium을 쓰려면 PW_CHROMIUM_PATH로 경로를 넘긴다
const executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: 'tests/e2e',
  forbidOnly: !!process.env.CI,
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:4173',
    serviceWorkers: 'block',
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
