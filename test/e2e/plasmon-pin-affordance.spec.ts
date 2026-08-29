import { expect, test, type Locator } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

async function pinPresentation(action: Locator): Promise<{
  label: string;
  pressed: boolean;
  state: string | null;
  transform: string;
  markerOpacity: string;
}> {
  const label = await action.getAttribute("aria-label");
  if (!label) throw new Error("Pin action has no accessible label");

  const pressed = await action.getAttribute("aria-pressed") === "true";
  const icon = action.locator(".plasmon-pin-icon");
  const art = icon.locator('[data-plasmon-owned-icon="system:pin"]');
  const marker = icon.locator(".plasmon-pin-icon__state");

  await expect(action).toHaveAttribute("title", label);
  await expect(icon).toHaveAttribute("data-pin-state", pressed ? "pinned" : "unpinned");
  await expect(art).toBeVisible();

  return {
    label,
    pressed,
    state: await icon.getAttribute("data-pin-state"),
    transform: await art.evaluate((image) => getComputedStyle(image).transform),
    markerOpacity: await marker.evaluate((element) => getComputedStyle(element).opacity),
  };
}

/**
 * Deterministic shared-primitive coverage already owns the canonical pin
 * presentation. This packaged proof exercises the actual Start and taskbar-
 * context consumers so platform emoji, missing artwork, inaccessible state, or
 * CSS that collapses pinned/unpinned into color-only presentation cannot regress.
 */
test("packaged Start and taskbar context share the canonical pin affordance", async ({ page }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, {
    firstPartyOrigins: [kernelUrl],
    allow: [
      {
        kind: "console.warn",
        messageIncludes: "An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute",
        urlPathPrefix: "/chunks/",
        reason: "Kernel-owned installed-app iframe warning is outside this pin-affordance acceptance; this test exercises the real packaged Shell",
      },
    ],
  });

  try {
    await page.goto(kernelUrl);
    await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
    await page.evaluate(
      (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
      runtime.developerIdentitySeed,
    );

    await page.locator('[data-tid="launcher-open"]').click();
    await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
    await page.locator('[data-tid="launcher-tile-plasmon-main"]').click();

    const plasmonSelector = 'iframe[data-app-id="plasmon"][data-tile-id="main"]';
    await expect(page.locator(plasmonSelector)).toBeVisible();
    const plasmon = page.frameLocator(plasmonSelector);
    const shell = plasmon.locator(".plasmon-shell").first();
    const start = plasmon.getByRole("button", { name: "Start", exact: true });
    const panel = plasmon.getByRole("region", { name: "Start menu" });

    await expect(shell).toBeVisible({ timeout: 30_000 });
    await start.click();
    await expect(panel).toBeVisible();
    await expect(plasmon.getByText("Loading Start Menu…")).toHaveCount(0, { timeout: 30_000 });

    const startAction = panel.getByRole("button", { name: /^(Pin to taskbar|Unpin from taskbar)$/ }).first();
    await expect(startAction).toBeVisible();
    const contextTarget = await startAction.evaluate((button) => {
      const row = button.closest(".plasmon-shell__row");
      const source = row?.querySelector<HTMLElement>("[data-shell-context-native], [data-shell-context-element]");
      if (!source) throw new Error("Start pin action has no canonical Shell context identity");
      if (source.dataset.shellContextNative) return { kind: "native" as const, id: source.dataset.shellContextNative };
      if (source.dataset.shellContextElement) return { kind: "element" as const, id: source.dataset.shellContextElement };
      throw new Error("Start pin action has no taskbar identity");
    });

    const before = await pinPresentation(startAction);
    expect(before.label).toBe(before.pressed ? "Unpin from taskbar" : "Pin to taskbar");
    expect(await startAction.textContent()).not.toContain("📌");

    await startAction.click();
    const after = await pinPresentation(startAction);
    expect(after.pressed).toBe(!before.pressed);
    expect(after.label).toBe(after.pressed ? "Unpin from taskbar" : "Pin to taskbar");
    expect(after.state).not.toBe(before.state);
    expect(after.transform, "pinned/unpinned artwork orientation is structurally distinct").not.toBe(before.transform);
    expect(after.markerOpacity, "pinned/unpinned state marker is structurally distinct").not.toBe(before.markerOpacity);

    // Restore the selected Start item's original pin state before the
    // taskbar-context proof, then normalize it to pinned for that boundary.
    await startAction.click();
    await expect(startAction).toHaveAttribute("aria-pressed", String(before.pressed));
    if (!before.pressed) {
      await startAction.click();
      await expect(startAction).toHaveAttribute("aria-pressed", "true");
    }

    const taskbar = plasmon.getByRole("navigation", { name: "Taskbar" });
    const contextableTask = contextTarget.kind === "native"
      ? taskbar.locator(`[data-shell-context-native="${contextTarget.id}"]`)
      : taskbar.locator(`[data-shell-context-element="${contextTarget.id}"]`);
    await expect(contextableTask).toBeVisible();
    await contextableTask.click({ button: "right" });

    const contextMenu = plasmon.getByRole("menu", { name: "Taskbar context menu" });
    await expect(contextMenu).toBeVisible();
    const contextAction = contextMenu.getByRole("menuitem", { name: "Unpin from taskbar" });
    await expect(contextAction).toBeVisible();

    const contextIcon = contextAction.locator(".plasmon-pin-icon");
    const contextArt = contextIcon.locator('[data-plasmon-owned-icon="system:pin"]');
    await expect(contextAction).toHaveAttribute("aria-label", "Unpin from taskbar");
    await expect(contextAction).toHaveAttribute("title", "Unpin from taskbar");
    await expect(contextArt).toBeVisible();
    expect(await contextAction.textContent()).not.toContain("📌");
    await expect(contextIcon).toHaveAttribute("data-pin-state", "pinned");

    // Restore the selected item's original preference state when this test
    // temporarily pinned it for taskbar-context acceptance.
    if (!before.pressed) {
      await contextAction.click();
    }

    health.assertClean();
  } finally {
    health.dispose();
  }
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
