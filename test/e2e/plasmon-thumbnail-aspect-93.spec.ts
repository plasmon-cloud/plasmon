import { mkdir, copyFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Locator } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";

interface ThumbnailExpectation {
  name: string;
  fixture: string;
  width: number;
  height: number;
}

const FIXTURE_ROOT = resolve(process.cwd(), "test/e2e/fixtures");
const FIXTURES: readonly ThumbnailExpectation[] = [
  { name: "portrait.svg", fixture: "thumbnail-93-portrait.svg", width: 40, height: 100 },
  { name: "landscape.svg", fixture: "thumbnail-93-landscape.svg", width: 120, height: 50 },
  { name: "square.svg", fixture: "thumbnail-93-square.svg", width: 72, height: 72 },
] as const;

async function assertContainedThumbnail(entry: Locator, expected: ThumbnailExpectation): Promise<void> {
  const thumbnail = entry.locator(".plasmon-icon-frame--thumbnail img.plasmon-media-thumbnail");
  await expect(thumbnail).toBeVisible({ timeout: 20_000 });
  await expect(thumbnail).toHaveJSProperty("naturalWidth", expected.width, { timeout: 20_000 });
  await expect(thumbnail).toHaveJSProperty("naturalHeight", expected.height, { timeout: 20_000 });

  const geometry = await entry.evaluate((element) => {
    const frame = element.querySelector<HTMLElement>(".plasmon-icon-frame--thumbnail");
    const art = frame?.querySelector<HTMLElement>(".plasmon-icon-frame__art") ?? null;
    const image = frame?.querySelector<HTMLImageElement>("img.plasmon-media-thumbnail") ?? null;
    if (!frame || !art || !image) throw new Error("Thumbnail is missing the shared Visual frame");
    const imageRect = image.getBoundingClientRect();
    const artRect = art.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const scale = Math.min(imageRect.width / image.naturalWidth, imageRect.height / image.naturalHeight);
    return {
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      objectFit: getComputedStyle(image).objectFit,
      imageRect: { width: imageRect.width, height: imageRect.height },
      artRect: { width: artRect.width, height: artRect.height },
      frameRect: { width: frameRect.width, height: frameRect.height },
      containedWidth: image.naturalWidth * scale,
      containedHeight: image.naturalHeight * scale,
      frameBackground: getComputedStyle(frame).backgroundColor,
    };
  });

  expect(geometry.naturalWidth).toBe(expected.width);
  expect(geometry.naturalHeight).toBe(expected.height);
  expect(geometry.objectFit).toBe("contain");
  expect(geometry.imageRect.width).toBeLessThanOrEqual(geometry.artRect.width + 0.5);
  expect(geometry.imageRect.height).toBeLessThanOrEqual(geometry.artRect.height + 0.5);
  expect(geometry.artRect.width).toBeLessThanOrEqual(geometry.frameRect.width + 0.5);
  expect(geometry.artRect.height).toBeLessThanOrEqual(geometry.frameRect.height + 0.5);
  expect(geometry.containedWidth / geometry.containedHeight).toBeCloseTo(expected.width / expected.height, 6);
  expect(geometry.frameBackground).not.toBe("rgba(0, 0, 0, 0)");
}

test("#93 — packaged FileManager thumbnails contain portrait, landscape, and square images", async ({ page }, testInfo) => {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const health = installPlasmonBrowserHealth(page, {
    firstPartyOrigins: [kernelUrl],
    allow: [
      {
        kind: "console.warn",
        messageIncludes: "An iframe which has both allow-scripts and allow-same-origin for its sandbox attribute",
        urlPathPrefix: "/chunks/",
        reason: "Kernel-owned installed-app iframe warning is outside #93; this gate exercises the real packaged FileManager thumbnail path",
      },
    ],
  });

  try {
    await page.goto(kernelUrl);
    await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
    await page.evaluate((seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed), runtime.developerIdentitySeed);
    await page.locator('[data-tid="launcher-open"]').click();
    await expect(page.locator('[data-tid="launcher"]')).toBeVisible();
    await page.locator('[data-tid="launcher-tile-plasmon-main"]').click();

    const plasmonSelector = 'iframe[data-app-id="plasmon"][data-tile-id="main"]';
    await expect(page.locator(plasmonSelector)).toBeVisible();
    const plasmon = page.frameLocator(plasmonSelector);
    const windows = plasmon.locator(".plasmon-window-layer").first().locator("[data-window-id]");
    const initialWindowCount = await windows.count();
    const rootShortcut = plasmon.getByRole("region", { name: "Desktop" }).locator("[data-fm-node-id]", { hasText: "Root" });
    await expect(rootShortcut).toHaveCount(1);
    await expect(rootShortcut).toBeVisible({ timeout: 30_000 });
    await rootShortcut.dblclick();
    await expect(windows).toHaveCount(initialWindowCount + 1, { timeout: 20_000 });

    const explorer = windows.last();
    await expect(explorer.getByRole("textbox", { name: "Address" })).toHaveValue("/", { timeout: 20_000 });
    const suffix = Date.now();
    const uploadDir = testInfo.outputPath(`thumbnail-93-${suffix}`);
    await mkdir(uploadDir, { recursive: true });

    for (const fixture of FIXTURES) {
      const name = `${suffix}-${fixture.name}`;
      const destination = resolve(uploadDir, name);
      await copyFile(resolve(FIXTURE_ROOT, fixture.fixture), destination);
      const chooserPromise = page.waitForEvent("filechooser");
      await explorer.getByRole("button", { name: "Import Files…" }).click();
      await (await chooserPromise).setFiles(destination);
      const entry = explorer.locator("[data-fm-node-id]", { hasText: name }).first();
      await expect(entry).toBeVisible({ timeout: 30_000 });
      await entry.scrollIntoViewIfNeeded();
      await expect(entry).toHaveAttribute("aria-selected", "true", { timeout: 30_000 });
      await assertContainedThumbnail(entry, { ...fixture, name });
    }

    const brokenName = `${suffix}-broken.png`;
    const brokenPath = resolve(uploadDir, brokenName);
    await copyFile(resolve(FIXTURE_ROOT, "thumbnail-93-broken.png"), brokenPath);
    const brokenChooserPromise = page.waitForEvent("filechooser");
    await explorer.getByRole("button", { name: "Import Files…" }).click();
    await (await brokenChooserPromise).setFiles(brokenPath);
    const brokenEntry = explorer.locator("[data-fm-node-id]", { hasText: brokenName }).first();
    await expect(brokenEntry).toBeVisible({ timeout: 30_000 });
    await brokenEntry.scrollIntoViewIfNeeded();
    await expect(brokenEntry).toHaveAttribute("aria-selected", "true", { timeout: 30_000 });
    await expect(brokenEntry.locator('.fm-entry__icon--image [data-plasmon-owned-icon="file-type:image"]'))
      .toBeVisible({ timeout: 20_000 });
    await expect(brokenEntry.locator("img.plasmon-media-thumbnail")).toHaveCount(0);
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
