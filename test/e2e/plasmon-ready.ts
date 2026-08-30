import { expect, type FrameLocator } from "@playwright/test";

/**
 * The Shell renders before preferences and filesystem-backed Start state are
 * ready. Browser tests should wait for this production-owned readiness
 * contract rather than sleeping for an assumed startup duration.
 */
export const PLASMON_STARTUP_TIMEOUT_MS = 10_000;
export const PLASMON_ACTION_TIMEOUT_MS = 5_000;

export async function expectPlasmonReady(app: FrameLocator): Promise<void> {
  const shell = app.locator(".plasmon-shell").first();
  await expect(shell).toBeVisible({ timeout: PLASMON_STARTUP_TIMEOUT_MS });
  await expect(shell).toHaveAttribute("aria-busy", "false", {
    timeout: PLASMON_STARTUP_TIMEOUT_MS,
  });
  await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible();
}
