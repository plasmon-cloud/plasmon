import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const DOOM_FIXTURE = resolve("apps/plasmon/dist/web/Games/DOS Bundles/Doom.jsdos");

test("normal boot stays clean and explicitly imported Doom opens through js-dos", async ({ page }) => {
  const runtimeRequests: string[] = [];
  const externalRuntimeRequests: string[] = [];
  const runtimeHttpErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRuntimeRequests: string[] = [];
  const demoAssetRequests: string[] = [];

  page.on("request", (request) => {
    const url = new URL(request.url());
    const path = decodeURIComponent(url.pathname);
    if (path.includes("/System/Program Files/js-dos/")) runtimeRequests.push(path);
    if (path === "/Games/DOS Bundles/Doom.jsdos") demoAssetRequests.push(path);
    if (["v8.js-dos.com", "github.com", "raw.githubusercontent.com"].includes(url.hostname)) {
      externalRuntimeRequests.push(request.url());
    }
  });
  page.on("response", (response) => {
    const url = new URL(response.url());
    const path = decodeURIComponent(url.pathname);
    if (response.status() >= 400 && path.includes("/System/Program Files/js-dos/")) {
      runtimeHttpErrors.push(`${response.status()} ${path}`);
    }
  });
  page.on("requestfailed", (request) => {
    const url = new URL(request.url());
    const path = decodeURIComponent(url.pathname);
    if (path.includes("/System/Program Files/js-dos/")) {
      failedRuntimeRequests.push(`${request.url()} :: ${request.failure()?.errorText ?? "failed"}`);
    }
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });

  const files = page.getByRole("listbox", { name: "Files" }).first();
  await expect(files).toBeVisible({ timeout: 30_000 });
  const doom = page.locator("[data-fm-node-id]", { hasText: "Doom.jsdos" }).first();

  // Normal production boot must not fetch or materialize the temporary demo game.
  await expect(doom).toHaveCount(0);
  expect(demoAssetRequests).toEqual([]);

  // The browser proof opts in explicitly by importing the packaged fixture
  // through the same FileManager path a user would use for any .jsdos bundle.
  await files.locator('input[type="file"]').setInputFiles(DOOM_FIXTURE);
  await expect(doom).toBeVisible({ timeout: 30_000 });
  // FileManager creates the node before chunked writes finish, then selects the
  // imported node only after importFileIntoFs() and its final refresh complete.
  await expect(doom).toHaveAttribute("aria-selected", "true", { timeout: 30_000 });
  await doom.dblclick();

  const dialog = page.getByRole("dialog", { name: "js-dos" });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  const player = dialog.getByLabel("DOS game");
  await expect(player).toHaveAttribute("data-jsdos-ready", "true", { timeout: 90_000 });

  const canvas = dialog.locator("canvas").first();
  await expect(canvas).toBeVisible();
  await expect.poll(
    () => canvas.evaluate((node) => {
      const element = node as HTMLCanvasElement;
      return element.width > 0 && element.height > 0;
    }),
    { timeout: 30_000 },
  ).toBe(true);

  // Exercise the same focused keyboard path a user uses in the DOS game.
  await player.click({ position: { x: 80, y: 80 } });
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Control");
  await page.waitForTimeout(500);
  await expect(canvas).toBeVisible();

  expect(runtimeRequests.some((path) => path.endsWith("/js-dos.js"))).toBe(true);
  expect(runtimeRequests.some((path) => path.endsWith("/emulators/wdosbox.wasm"))).toBe(true);
  expect(externalRuntimeRequests).toEqual([]);
  expect(runtimeHttpErrors).toEqual([]);
  expect(failedRuntimeRequests).toEqual([]);
  expect(pageErrors).toEqual([]);

  await dialog.getByRole("button", { name: "Close" }).click();
  await expect(dialog).toBeHidden({ timeout: 5_000 });
  await expect(doom).toBeVisible();
  expect(pageErrors).toEqual([]);
});
