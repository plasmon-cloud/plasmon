import { expect, test, type Locator } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

const PLASMON_APP_ID = "plasmon";
const PLASMON_TILE_ID = "main";
const REVIEW_APP_ID = "review";
const REVIEW_TILE_ID = "review";
const REVIEW_DECLARED_ICON = "assets/hackathon-native-logo.svg";
const REVIEW_ICON_PATH = `/app/${REVIEW_APP_ID}/${REVIEW_DECLARED_ICON}`;
const REVIEW_COMPAT_ICON_PATH = `/app/${REVIEW_APP_ID}/static/icon.svg`;
const REVIEW_MANIFEST_PATH = `/app/${REVIEW_APP_ID}/pkg/neutron.json`;

function pathname(value: string): string {
  return new URL(value).pathname;
}

async function expectReviewArtwork(locator: Locator): Promise<void> {
  const image = locator.locator("img.plasmon-native-app-icon");
  await expect(image).toHaveCount(1);
  await expect(image).toBeVisible();
  const src = await image.getAttribute("src");
  expect(
    src,
    "Review should render its authoritative installed package artwork",
  ).toBeTruthy();
  expect(pathname(src!)).toBe(REVIEW_ICON_PATH);
  await expect.poll(async () =>
    image.evaluate((element) => {
      const img = element as HTMLImageElement;
      return img.complete && img.naturalWidth > 0;
    }),
  ).toBe(true);
}

test("authoritative installed Review artwork reaches Files, Search, taskbar, and shortcut composition", async ({ page, request }) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, {
    firstPartyOrigins: [kernelUrl],
  });
  const reviewRequests: string[] = [];
  page.on("request", (entry) => {
    try {
      const path = pathname(entry.url());
      if (path.startsWith(`/app/${REVIEW_APP_ID}/`)) reviewRequests.push(path);
    } catch {
      // Ignore non-URL browser internals; BrowserHealth remains the error authority.
    }
  });

  try {
    const manifestResponse = await request.get(
      new URL(REVIEW_MANIFEST_PATH, kernelUrl).href,
    );
    expect(
      manifestResponse.ok(),
      "installed Review package manifest should be certified and readable",
    ).toBe(true);
    const manifest = await manifestResponse.json() as {
      tiles?: Array<{ id?: string; icon?: string }>;
    };
    expect(manifest.tiles).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: REVIEW_TILE_ID,
        icon: REVIEW_DECLARED_ICON,
      }),
    ]));

    const artworkResponse = await request.get(
      new URL(REVIEW_ICON_PATH, kernelUrl).href,
    );
    expect(
      artworkResponse.ok(),
      "declared non-conventional Review artwork should be installed",
    ).toBe(true);
    const compatibilityResponse = await request.get(
      new URL(REVIEW_COMPAT_ICON_PATH, kernelUrl).href,
    );
    expect(
      compatibilityResponse.status(),
      "the packaged fixture must not contain static/icon.svg",
    ).toBe(404);

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
    await page
      .locator(
        `[data-tid="launcher-tile-${PLASMON_APP_ID}-${PLASMON_TILE_ID}"]`,
      )
      .click();

    const plasmonSelector =
      `iframe[data-app-id="${PLASMON_APP_ID}"][data-tile-id="${PLASMON_TILE_ID}"]`;
    await expect(page.locator(plasmonSelector).first()).toBeVisible();
    const plasmon = page.frameLocator(plasmonSelector).first();
    const taskbar = plasmon.getByRole("navigation", { name: "Taskbar" });
    await expect(taskbar).toBeVisible({ timeout: 30_000 });

    // Search must use the same authoritative resource-presentation path before a
    // same-named Desktop shortcut exists and can make the result ambiguous.
    await plasmon.getByRole("button", { name: "Search" }).click();
    const search = plasmon.getByLabel("Search Plasmon");
    await expect(search).toBeVisible();
    await search.fill("Review");
    const reviewResult = plasmon
      .locator("[data-search-result]", { hasText: "Review" })
      .first();
    await expect(reviewResult).toBeVisible({ timeout: 15_000 });
    await expectReviewArtwork(reviewResult);
    await page.keyboard.press("Escape");
    await expect(search).toBeHidden();

    const desktop = plasmon.locator(".fm-root--desktop").first();
    await expect(desktop).toBeVisible({ timeout: 30_000 });
    const desktopEntries = desktop.locator("[data-fm-node-id]");
    const beforeDesktopIds = new Set(
      (await desktopEntries.evaluateAll((entries) =>
        entries.map((entry) => entry.getAttribute("data-fm-node-id")),
      )).filter((id): id is string => Boolean(id)),
    );

    const appsShortcut = desktop
      .locator("[data-fm-node-id]", { hasText: "Apps" })
      .first();
    await expect(appsShortcut).toBeVisible();
    const windows = plasmon.locator(
      ".plasmon-window-layer [data-window-id]",
    );
    const beforeWindowCount = await windows.count();
    await appsShortcut.dblclick();
    await expect(windows).toHaveCount(beforeWindowCount + 1, {
      timeout: 20_000,
    });

    const explorer = plasmon.locator(
      ".plasmon-window-layer [data-window-id].plasmon-window--active",
    );
    await expect(explorer).toHaveCount(1);
    await expect(explorer.getByRole("textbox", { name: "Address" }))
      .toHaveValue("/Apps");
    const reviewProjection = explorer
      .locator("[data-fm-node-id]", { hasText: "Review.neutron" })
      .first();
    await expect(reviewProjection).toBeVisible({ timeout: 20_000 });
    await expectReviewArtwork(reviewProjection);

    await reviewProjection.click();
    const toolbar = explorer.getByRole("toolbar", { name: "File commands" });
    const sendToDesktop = toolbar.getByRole("button", {
      name: "Send to Desktop",
      exact: true,
    });
    await expect(sendToDesktop).toBeEnabled();
    await sendToDesktop.click();

    await expect.poll(async () => await desktopEntries.count())
      .toBe(beforeDesktopIds.size + 1);
    const afterDesktopIds = (await desktopEntries.evaluateAll((entries) =>
      entries.map((entry) => entry.getAttribute("data-fm-node-id")),
    )).filter((id): id is string => Boolean(id));
    const createdId = afterDesktopIds.find((id) => !beforeDesktopIds.has(id));
    if (!createdId) {
      throw new Error(
        "Send to Desktop did not create a distinct Review shortcut NodeId",
      );
    }

    const createdShortcut = desktop.locator(
      `[data-fm-node-id="${createdId}"]`,
    );
    await expect(createdShortcut).toBeVisible();
    await expect(createdShortcut).toContainText("Review.neutron");
    await expectReviewArtwork(createdShortcut);
    await expect(createdShortcut.locator(".plasmon-shortcut-overlay"))
      .toBeVisible();

    // Opening the real shortcut resolves through its installed /Apps target and
    // must preserve the authoritative native artwork on the launched taskbar item.
    await createdShortcut.dblclick();
    const reviewSelector =
      `iframe[data-app-id="${REVIEW_APP_ID}"][data-tile-id="${REVIEW_TILE_ID}"]`;
    await expect(page.locator(reviewSelector).last()).toBeVisible({
      timeout: 10_000,
    });
    const reviewTask = taskbar.getByRole("button", { name: /^Review;/ }).first();
    await expect(reviewTask).toBeVisible({ timeout: 15_000 });
    await expectReviewArtwork(reviewTask);

    expect(
      reviewRequests,
      "Plasmon should render the authoritative icon returned by apps.describe",
    ).toContain(REVIEW_ICON_PATH);
    expect(
      reviewRequests,
      "Plasmon must not refetch package metadata after apps.describe preserves the icon declaration",
    ).not.toContain(REVIEW_MANIFEST_PATH);
    expect(
      reviewRequests,
      "Plasmon must not probe the compatibility icon when authoritative metadata exists",
    ).not.toContain(REVIEW_COMPAT_ICON_PATH);

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
