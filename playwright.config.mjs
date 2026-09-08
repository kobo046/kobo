import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/ui",
  outputDir: "./tests/results",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:8797", channel: "chrome", headless: true },
  webServer: {
    command: "node scripts/serve.mjs 8797",
    url: "http://127.0.0.1:8797",
    reuseExistingServer: !process.env.CI
  }
});
