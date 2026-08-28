import { expect, test } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";

const PLASMON_APP_ID = "plasmon";
const PLASMON_TILE_ID = "main";
const REVIEW_APP_ID = "review";
const REVIEW_TILE_ID = "review";

test("[demo profile] Plasmon demo discovers and opens the installed Review Element", { tag: ["@demo-profile"] }, async ({ page, request }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(kernelUrl);
  await page.waitForFunction(
    () => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function",
  );
  const principal = await page.evaluate(
    (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
    runtime.developerIdentitySeed,
  );
  expect(principal).toBe(runtime.developerIdentityPrincipal);

  const registryResponse = await request.get(new URL("/system/apps.json", kernelUrl).href);
  expect(registryResponse.ok()).toBe(true);
  const registry = await registryResponse.json() as Record<string, {
    tiles?: Array<{ id?: string; path?: string }>;
  }>;
  expect(registry[PLASMON_APP_ID]?.tiles).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: PLASMON_TILE_ID, path: "index.html" }),
    ]),
  );
  expect(registry[REVIEW_APP_ID]?.tiles).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: REVIEW_TILE_ID, path: "index.html" }),
    ]),
  );

  const reviewAsset = await request.get(new URL(`/app/${REVIEW_APP_ID}/index.html`, kernelUrl).href);
  expect(reviewAsset.ok(), "Review should be served from its independently installed package").toBe(true);

  await page.locator('[data-tid="launcher-open"]').click();
  await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
  await page.locator(`[data-tid="launcher-tile-${PLASMON_APP_ID}-${PLASMON_TILE_ID}"]`).click();

  const plasmonSelector = `iframe[data-app-id="${PLASMON_APP_ID}"][data-tile-id="${PLASMON_TILE_ID}"]`;
  const plasmonFrame = page.locator(plasmonSelector).first();
  await expect(plasmonFrame).toBeVisible();
  const plasmon = page.frameLocator(plasmonSelector).first();
  await expect(plasmon.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });

  // Search presents the Kernel-authoritative installed Review projection and
  // activates it through Plasmon's canonical filesystem/open path. Review's
  // own demo workflow is accepted in the standalone Review lane.
  await plasmon.getByRole("button", { name: "Search" }).click();
  const search = plasmon.getByLabel("Search Plasmon");
  await expect(search).toBeVisible();
  await search.fill("Review");
  const reviewResult = plasmon.locator("[data-search-result]", { hasText: "Review" }).first();
  await expect(reviewResult).toBeVisible({ timeout: 15_000 });
  await reviewResult.click();

  const reviewSelector = `iframe[data-app-id="${REVIEW_APP_ID}"][data-tile-id="${REVIEW_TILE_ID}"]`;
  const reviewFrame = page.locator(reviewSelector).last();
  await expect(reviewFrame).toBeVisible({ timeout: 10_000 });
  const review = page.frameLocator(reviewSelector).last();
  await expect(review.locator("#root > .review-app")).toBeVisible({ timeout: 5_000 });
  await expect(review.getByRole("region", { name: "Current Review workspace" })).toBeVisible({ timeout: 5_000 });

  expect(pageErrors).toEqual([]);
});

test(
  "[demo profile] #118 groups canonical Explorer processes and focuses individual members",
  { tag: ["@demo-profile", "@issue-303"] },
  async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto(kernelUrl);
  await page.waitForFunction(
    () => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function",
  );
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

  const nativeWindows = plasmon.locator(".plasmon-window-layer [data-window-id]");
  const initialWindowCount = await nativeWindows.count();
  const rootShortcut = plasmon.locator("[data-fm-node-id]", { hasText: "Root" }).first();
  await expect(rootShortcut).toBeVisible({ timeout: 30_000 });
  await rootShortcut.dblclick();
  await expect(nativeWindows).toHaveCount(initialWindowCount + 1, { timeout: 20_000 });

  // The native window count is the creation boundary. Explorer publishes its
  // canonical title asynchronously, so bind the newly active Windowing record
  // first and prove the real Explorer surface is initialized before continuing.
  const primary = plasmon.locator(".plasmon-window-layer [data-window-id].plasmon-window--active");
  await expect(primary).toHaveCount(1);
  await expect(primary.getByRole("textbox", { name: "Address" })).toHaveValue("/");
  const primaryId = await primary.getAttribute("data-window-id");
  if (!primaryId) throw new Error("Primary Explorer native window has no stable window id");
  const primaryWindow = plasmon.locator(`.plasmon-window-layer [data-window-id="${primaryId}"]`);
  await expect(primaryWindow).toHaveAccessibleName("This Plasmon");
  await primaryWindow.locator(".plasmon-window__controls").getByRole("button", { name: "Minimize" }).click();
  await expect(primaryWindow).toHaveAttribute("aria-hidden", "true");

  await rootShortcut.dblclick();
  await expect(nativeWindows).toHaveCount(initialWindowCount + 2, { timeout: 20_000 });
  const activeSibling = plasmon.locator(".plasmon-window-layer [data-window-id].plasmon-window--active");
  await expect(activeSibling).toHaveCount(1);
  const siblingId = await activeSibling.getAttribute("data-window-id");
  if (!siblingId || siblingId === primaryId) throw new Error("Sibling Explorer native window has no distinct stable window id");
  const siblingWindow = plasmon.locator(`.plasmon-window-layer [data-window-id="${siblingId}"]`);

  await expect(siblingWindow.getByRole("textbox", { name: "Address" })).toHaveValue("/");
  await expect(siblingWindow).toHaveAccessibleName("This Plasmon");

  const filesGroup = taskbar.getByRole("button", { name: /^Files;.*2 windows$/ });
  await expect(filesGroup).toHaveCount(1);

  // A multi-member task remains app-scoped for Pin/Unpin and must not guess
  // which concrete Process should receive Close.
  await filesGroup.click({ button: "right" });
  const groupedContextMenu = plasmon.getByRole("menu", { name: "Taskbar context menu" });
  await expect(groupedContextMenu).toBeVisible();
  await expect(groupedContextMenu.getByRole("menuitem", { name: /Pin to taskbar|Unpin from taskbar/ })).toBeVisible();
  await expect(groupedContextMenu.getByRole("menuitem", { name: "Close" })).toHaveCount(0);

  // Ordinary activation dismisses the group context menu and exposes the
  // canonical Process members instead of inventing group-level lifecycle.
  await filesGroup.click();
  await expect(groupedContextMenu).toHaveCount(0);

  const chooser = plasmon.getByRole("region", { name: "Files windows" });
  await expect(chooser).toBeVisible();
  await expect(chooser.getByRole("button", { name: "This Plasmon; Minimized" })).toBeVisible();
  await expect(chooser.getByRole("button", { name: "This Plasmon; Active" })).toBeVisible();
  await chooser.getByRole("button", { name: "This Plasmon; Minimized" }).click();
  await expect(chooser).toHaveCount(0);
  await expect(primaryWindow).not.toHaveAttribute("aria-hidden", "true");
  await expect(primaryWindow).toHaveClass(/plasmon-window--active/);
  await expect(siblingWindow).not.toHaveClass(/plasmon-window--active/);

  await filesGroup.click();
  const reopenedChooser = plasmon.getByRole("region", { name: "Files windows" });
  await expect(reopenedChooser).toBeVisible();
  await reopenedChooser.getByRole("button", { name: "This Plasmon; Running" }).click();
  await expect(siblingWindow).toHaveClass(/plasmon-window--active/);

  // A chooser member carries its canonical Process identity, so its context
  // menu exposes Close and delegates only that member to ProcessController.
  await filesGroup.click();
  const closeChooser = plasmon.getByRole("region", { name: "Files windows" });
  await expect(closeChooser).toBeVisible();
  const siblingMember = closeChooser.getByRole("button", { name: "This Plasmon; Active" });
  await siblingMember.click({ button: "right" });
  await expect(closeChooser).toHaveCount(0);

  const memberContextMenu = plasmon.getByRole("menu", { name: "Taskbar context menu" });
  await expect(memberContextMenu).toBeVisible();
  await expect(memberContextMenu.getByRole("menuitem", { name: /Pin to taskbar|Unpin from taskbar/ })).toBeVisible();
  await expect(memberContextMenu.getByRole("menuitem", { name: "Close" })).toBeVisible();
  await memberContextMenu.getByRole("menuitem", { name: "Close" }).click();

  await expect(siblingWindow).toHaveCount(0);
  await expect(primaryWindow).toHaveCount(1);
  await expect(nativeWindows).toHaveCount(initialWindowCount + 1, { timeout: 10_000 });
  await expect(taskbar.getByRole("button", { name: /^Files;/ })).toHaveCount(1);
  await expect(taskbar.getByRole("button", { name: /^Files;.*2 windows$/ })).toHaveCount(0);

  await primaryWindow.locator(".plasmon-window__controls").getByRole("button", { name: "Close" }).click();
  await expect(nativeWindows).toHaveCount(initialWindowCount, { timeout: 10_000 });
  expect(pageErrors).toEqual([]);
  },
);

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
