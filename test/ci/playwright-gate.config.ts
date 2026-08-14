import { defineConfig } from "@playwright/test";
import sharedConfig from "../../playwright.config.ts";

export default defineConfig({
  ...sharedConfig,
  testDir: ".",
  testMatch: "playwright-gate.probe.spec.ts",
  reporter: "list",
  projects: [{ name: "gate-contract" }],
  use: {
    trace: "off",
  },
});
