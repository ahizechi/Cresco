import { defineConfig } from "@playwright/test";
import { randomUUID } from "node:crypto";
const port = Number(process.env.CRESCO_TEST_PORT || "1463");
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw Error("Invalid test port");
export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  workers: 2,
  retries: 0,
  outputDir: "test-results/runs/" + randomUUID(),
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:" + port,
    viewport: { width: 1360, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      process.env.CRESCO_CSP_TEST === "1"
        ? "node tools/csp-server.cjs " + port
        : "npm run dev -- --port " + port + " --strictPort",
    url: "http://127.0.0.1:" + port,
    reuseExistingServer: false,
  },
});
