import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ui",
  outputDir: "./.local-test/playwright",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:8797", headless: true },
  projects: [
    { name: "chromium", use: { browserName: "chromium", channel: "chrome" } },
    // Opt in after `npx playwright install webkit`; existing Chrome setup works
    // without downloading another browser. Runs the same suite with iPhone input.
    ...(process.env.PLAYWRIGHT_WEBKIT === "1" ? [{
      name: "webkit-iphone", use: { ...devices["iPhone 13"], browserName: "webkit" }
    }] : [])
  ],
  webServer: {
    command: "node scripts/serve.mjs 8797",
    url: "http://127.0.0.1:8797",
    reuseExistingServer: !process.env.CI
  }
});
