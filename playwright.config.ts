import { defineConfig, devices } from "@playwright/test";

const useSystemChrome = process.env.PLAYWRIGHT_CHANNEL === "chrome";

// Smoke tests run against a production build so they catch real build issues.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  // The WebGL hero, the film world, and a game canvas all paint at once per
  // test. Locally (with a real GPU) two workers is stable; on CI there is no
  // GPU, so Chromium falls back to SwiftShader and several concurrent WebGL
  // contexts starve or crash the browser outright ("Target page has been
  // closed"). CI therefore runs a single worker — one set of contexts at a
  // time survives software rendering where two or more do not.
  workers: process.env.CI ? 1 : 2,
  // Real-time canvas games on a software renderer are inherently timing-
  // sensitive; one retry absorbs a starved frame budget without hiding a
  // reproducible failure (a real break fails both attempts).
  retries: 1,
  // The heaviest tests (full catalog lifecycle, WebGL mounts) run ~20s alone
  // with a GPU. On CI's software renderer even a single worker's game loops
  // advance slower, so the per-test ceiling is more generous there.
  timeout: process.env.CI ? 45_000 : 60_000,
  forbidOnly: !!process.env.CI,
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
