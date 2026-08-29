import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const PLASMON_APP_ID = "plasmon";
const PLASMON_TILE_ID = "main";
const REVIEW_APP_ID = "review";
const REVIEW_TILE_ID = "review";
const RAW_RUNTIME_TOKEN = /\b(?:yes|no|unknown)\b/i;

test("packaged taskbar exposes user-facing native and Element state", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });
  let filesWasPinned: boolean | undefined;

  try {
    await page.goto(kernelUrl);
    await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
    const principal = await page.evaluate(
      (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
      runtime.developerIdentitySeed,
    );
    expect(principal).toBe(runtime.developerIdentityPrincipal);

    await page.locator('[data-tid="launcher-open"]').click();
    await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
    await page.locator(`[data-tid="launcher-tile-${PLASMON_APP_ID}-${PLASMON_TILE_ID}"]`).click();

    const plasmonSelector = `iframe[data-app-id="${PLASMON_APP_ID}"][data-tile-id="${PLASMON_TILE_ID}"]`;
    const plasmon = page.frameLocator(plasmonSelector).first();
    const taskbar = plasmon.getByRole("navigation", { name: "Taskbar" });
    await expect(taskbar).toBeVisible({ timeout: 30_000 });
    await expect(plasmon.locator(".plasmon-shell")).toHaveAttribute("aria-busy", "false");

    // Preserve any pre-existing persisted pin choice. With no native Files
    // process at startup, a rendered Files task means the user already pinned it.
    const initialFilesTask = taskbar.getByRole("button", { name: /^Files;/ });
    filesWasPinned = await initialFilesTask.count() > 0;
    if (filesWasPinned) {
      await expect(initialFilesTask.first()).toHaveAttribute("data-task-state", "pinned-only");
      await expect(initialFilesTask.first()).toHaveAccessibleName("Files; Pinned to taskbar");
    }

    const nativeWindows = plasmon.locator(".plasmon-window-layer [data-window-id]");
    const initialWindowCount = await nativeWindows.count();
    const rootShortcut = plasmon.locator("[data-fm-node-id]", { hasText: "Root" }).first();
    await expect(rootShortcut).toBeVisible({ timeout: 30_000 });
    await rootShortcut.dblclick();
    await expect(nativeWindows).toHaveCount(initialWindowCount + 1, { timeout: 20_000 });

    let filesTask = taskbar.getByRole("button", { name: /^Files;/ }).first();
    await expect(filesTask).toHaveAttribute("data-task-state", "active");
    await expect(filesTask).toHaveAttribute("aria-pressed", "true");
    expect((await filesTask.getAttribute("aria-label")) ?? "").not.toMatch(RAW_RUNTIME_TOKEN);

    // Pin through the real taskbar command so closing the process exposes the
    // user-visible pinned-only state instead of making the entry disappear.
    if (!filesWasPinned) {
      await filesTask.click({ button: "right" });
      const itemMenu = plasmon.getByRole("menu", { name: "Taskbar context menu" });
      await expect(itemMenu).toBeVisible();
      await itemMenu.getByRole("menuitem", { name: "Pin to taskbar" }).click();
      filesTask = taskbar.getByRole("button", { name: /^Files;/ }).first();
      await expect(filesTask).toHaveAccessibleName(/Files; Active and focused; pinned to taskbar/);
    }

    const activeExplorer = plasmon.locator(".plasmon-window-layer [data-window-id].plasmon-window--active");
    await expect(activeExplorer).toHaveCount(1);
    await activeExplorer.locator(".plasmon-window__controls").getByRole("button", { name: "Close" }).click();
    await expect(nativeWindows).toHaveCount(initialWindowCount, { timeout: 10_000 });

    filesTask = taskbar.getByRole("button", { name: /^Files;/ }).first();
    await expect(filesTask).toHaveAttribute("data-task-state", "pinned-only");
    await expect(filesTask).toHaveAccessibleName("Files; Pinned to taskbar");
    await expect(filesTask).toHaveAttribute("aria-pressed", "false");

    // Relaunch, minimize, and focus through the same task button. These are
    // browser-visible projections of Process/Windowing state, not Shell-owned
    // lifecycle flags.
    await filesTask.click();
    await expect(nativeWindows).toHaveCount(initialWindowCount + 1, { timeout: 20_000 });
    await expect(filesTask).toHaveAttribute("data-task-state", "active");
    await expect(filesTask).toHaveAccessibleName(/Files; Active and focused; pinned to taskbar/);
    await expect(filesTask).toHaveAttribute("aria-pressed", "true");

    await filesTask.click();
    await expect(filesTask).toHaveAttribute("data-task-state", "running");
    await expect(filesTask).toHaveAccessibleName(/Files; Running; pinned to taskbar/);
    await expect(filesTask).toHaveAttribute("aria-pressed", "false");

    await filesTask.click();
    await expect(filesTask).toHaveAttribute("data-task-state", "active");
    await expect(filesTask).toHaveAccessibleName(/Files; Active and focused; pinned to taskbar/);

    // Exercise an actual installed Neutron Element. The Shell must translate
    // Neutron's canonical runtime observation into user-facing "Running"
    // rather than expose the raw `yes` implementation token.
    await plasmon.getByRole("button", { name: "Search" }).click();
    const search = plasmon.getByLabel("Search Plasmon");
    await expect(search).toBeVisible();
    await search.fill("Review");
    const reviewResult = plasmon.locator("[data-search-result]", { hasText: "Review" }).first();
    await expect(reviewResult).toBeVisible({ timeout: 15_000 });
    await reviewResult.click();

    const reviewSelector = `iframe[data-app-id="${REVIEW_APP_ID}"][data-tile-id="${REVIEW_TILE_ID}"]`;
    await expect(page.locator(reviewSelector).last()).toBeVisible({ timeout: 10_000 });
    const reviewTask = taskbar.getByRole("button", { name: /^Review;/ }).first();
    await expect(reviewTask).toHaveAttribute("data-task-state", "running", { timeout: 15_000 });
    await expect(reviewTask).toHaveAccessibleName("Review; Running");

    // Audit every rendered task state, including any environment-provided
    // uncertain Element, without assuming that an unavailable runtime status is
    // present in every healthy packaged run. Raw runtime tokens must never be
    // exposed in either accessible names or visible task-button text.
    const renderedTasks = taskbar.locator("button[data-task-state]");
    const renderedPresentation = await renderedTasks.evaluateAll((buttons) => buttons.map((button) => ({
      label: button.getAttribute("aria-label") ?? "",
      text: button.textContent ?? "",
      state: button.getAttribute("data-task-state") ?? "",
    })));
    expect(renderedPresentation.length).toBeGreaterThanOrEqual(2);
    for (const task of renderedPresentation) {
      expect(task.label).not.toMatch(RAW_RUNTIME_TOKEN);
      expect(task.text).not.toMatch(RAW_RUNTIME_TOKEN);
      expect(["pinned-only", "launching", "running", "active", "uncertain"]).toContain(task.state);
      if (task.state === "uncertain") expect(task.label).toContain("Runtime status unavailable");
    }

    health.assertClean();
  } finally {
    try {
      // Restore only a pin created by this test. This teardown also covers
      // assertion failures/timeouts after the mutation, including retries that
      // reuse the durable installed Plasmon preference store.
      if (filesWasPinned === false) {
        const cleanupPlasmon = page.frameLocator(
          `iframe[data-app-id="${PLASMON_APP_ID}"][data-tile-id="${PLASMON_TILE_ID}"]`,
        ).first();
        const cleanupTaskbar = cleanupPlasmon.getByRole("navigation", { name: "Taskbar" });
        const cleanupFilesTask = cleanupTaskbar.getByRole("button", { name: /^Files;/ }).first();
        if (await cleanupFilesTask.count() > 0) {
          const cleanupLabel = (await cleanupFilesTask.getAttribute("aria-label")) ?? "";
          if (/pinned to taskbar/i.test(cleanupLabel)) {
            await cleanupFilesTask.click({ button: "right" });
            const cleanupMenu = cleanupPlasmon.getByRole("menu", { name: "Taskbar context menu" });
            await expect(cleanupMenu).toBeVisible();
            await cleanupMenu.getByRole("menuitem", { name: "Unpin from taskbar" }).click();
            await expect(cleanupFilesTask).not.toHaveAccessibleName(/pinned to taskbar/i);
          }
        }
      }
    } finally {
      health.dispose();
    }
  }
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
