import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

// Chromium is preinstalled in this environment; never run `playwright install`.
const preinstalled = "/opt/pw-browsers/chromium";
const executablePath = process.env.PW_CHROMIUM_PATH ?? findChromium();

function findChromium(): string | undefined {
  // /opt/pw-browsers/chromium may be a dir or a binary; probe the common layouts.
  const candidates = [
    preinstalled,
    "/opt/pw-browsers/chromium-1243/chrome-linux/chrome",
    "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome",
  ];
  for (const c of candidates) {
    try {
      if (fs.statSync(c).isFile()) return c;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  // Warms every heavy route once before the first test (cold-start timeouts), see the file.
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  // Pages render on demand and the 3D proof uses software WebGL in CI, so allow slower steps.
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 780 } } },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/ar`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
