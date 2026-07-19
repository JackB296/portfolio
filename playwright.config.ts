import { defineConfig, devices } from "@playwright/test";

const useSystemChrome = process.env.PLAYWRIGHT_CHANNEL === "chrome";

// Smoke tests run against a production build so they catch real build issues.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  // Local runs choke at the default worker count: the WebGL hero, the film
  // canvases, and the playground sims contend for one GPU and random tests
  // die by timeout. Four workers keeps the suite deterministic on a laptop.
  workers: process.env.CI ? undefined : 4,
  // The heaviest tests (full catalog lifecycle, WebGL mounts) run ~20s alone
  // and stretch past 30s when the suite shares a laptop GPU. CI keeps the
  // strict ceiling.
  timeout: process.env.CI ? 30_000 : 60_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(useSystemChrome ? { channel: "chrome" as const } : {}),
      },
    },
  ],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
