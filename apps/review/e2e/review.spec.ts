import { expect, test, type Locator, type TestInfo } from "@playwright/test";
import { approveFilesTool, login, openReview } from "./harness.ts";

test("packaged Review first-run is readable and self-explanatory", async ({ page }, testInfo) => {
  await login(page);
  const harness = await openReview(page);

  await expect(harness.review.getByRole("heading", { name: "Structured reviews without the guesswork" })).toBeVisible();
  await expect(harness.review.getByText("Completed actions are stored automatically by Review’s provider.")).toBeVisible();
  await expect(harness.review.getByText("Live sharing isn’t available in this build")).toBeVisible();
  await expect(harness.review.getByText(/Markdown export is portability only/)).toBeVisible();
  await expect(harness.review.getByRole("button", { name: /save/i })).toHaveCount(0);

  await page.emulateMedia({ colorScheme: "light" });
  await expectReadable(harness.review.locator(".review-app"), 4.5);
  await expectReadable(harness.review.locator(".first-run-lead"), 4.5);
  await attachFrameScreenshot(harness.review.locator("body"), testInfo, "first-run-light");

  await page.emulateMedia({ colorScheme: "dark" });
  await expectReadable(harness.review.locator(".review-app"), 4.5);
  await expectReadable(harness.review.locator(".first-run-lead"), 4.5);
  await attachFrameScreenshot(harness.review.locator("body"), testInfo, "first-run-dark");

  await page.setViewportSize({ width: 560, height: 900 });
  const narrowMetrics = await harness.review.locator("body").evaluate((body) => ({
    clientWidth: body.clientWidth,
    scrollWidth: body.scrollWidth,
  }));
  expect(narrowMetrics.scrollWidth).toBeLessThanOrEqual(narrowMetrics.clientWidth + 1);
  await attachFrameScreenshot(harness.review.locator("body"), testInfo, "first-run-narrow");
});

test("packaged vanilla Neutron Review completes the first-demo workflow and persists it", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "light" });
  await login(page);
  let harness = await openReview(page);

  await harness.review.getByLabel("New review").fill("Packaged Review Gate");
  await harness.review.getByRole("button", { name: "Create review" }).click();
  await expect(harness.review.locator(".review-workspace").getByRole("heading", { name: "Packaged Review Gate" })).toBeVisible();
  await expect(harness.review.getByTestId("persistence-status").getByText("Saved", { exact: true })).toBeVisible();

  await harness.review.getByLabel("New review item").fill("Review launches in vanilla Neutron");
  await harness.review.getByRole("button", { name: "Add item" }).click();
  const card = harness.review.locator(".review-card").filter({ hasText: "Review launches in vanilla Neutron" });
  await expect(card).toBeVisible();
  await expect(card.getByText("Desired", { exact: true })).toBeVisible();
  await expect(card.getByText("How strongly this outcome needs to be true.")).toBeVisible();
  await expect(card.getByText("The expected size of the work.")).toBeVisible();
  await expect(card.getByText("No owner is assigned yet.")).toBeVisible();

  await card.getByRole("button", { name: "Working", exact: true }).click();
  await expect(card.getByRole("button", { name: "Working", exact: true })).toHaveAttribute("aria-pressed", "true");

  await card.getByLabel("Desired").selectOption("must");
  await card.getByLabel("Effort").selectOption("small");
  await card.getByLabel("Owner").fill("Agent 13");
  await card.getByLabel("Work").selectOption("needs_retest");
  await expect(card.getByText("Unsaved changes")).toBeVisible();
  await expect(harness.review.getByTestId("persistence-status").getByText("1 unsaved item")).toBeVisible();
  await card.getByRole("button", { name: "Save details" }).click();
  await expect(card.getByText("Saved", { exact: true })).toBeVisible();
  await expect(harness.review.getByTestId("persistence-status").getByText("Saved", { exact: true })).toBeVisible();

  await card.getByLabel("Comment on Review launches in vanilla Neutron").fill("Packaged workflow verified.");
  await card.getByRole("button", { name: "Add note" }).click();
  await expect(card.getByText("Packaged workflow verified.")).toBeVisible();
  await expect(card.getByText("Local reviewer")).toBeVisible();
  await attachFrameScreenshot(harness.review.locator("body"), testInfo, "populated-review");

  const originalAtomId = await harness.review.locator(".atom-details dd").first().innerText();
  await expect(harness.review.locator(".history-entry")).toHaveCount(5);
  const revisionFour = harness.review.locator(".history-entry").filter({ hasText: "r4" }).first();
  await revisionFour.getByRole("button", { name: "Restore…" }).click();
  await expect(revisionFour.getByText("Restore revision r4?")).toBeVisible();
  await expect(revisionFour.getByText(/keeping the same Review Atom and preserving all history/)).toBeVisible();
  await attachFrameScreenshot(harness.review.locator("body"), testInfo, "restore-confirmation");
  await revisionFour.getByRole("button", { name: "Restore revision" }).click();
  await expect(harness.review.locator(".history-entry")).toHaveCount(6);
  await expect(card.getByText("Packaged workflow verified.")).toHaveCount(0);
  expect(await harness.review.locator(".atom-details dd").first().innerText()).toBe(originalAtomId);

  await card.getByLabel("Comment on Review launches in vanilla Neutron").fill("Verified again after deliberate restore.");
  await card.getByRole("button", { name: "Add note" }).click();
  await expect(card.getByText("Verified again after deliberate restore.")).toBeVisible();

  await page.setViewportSize({ width: 620, height: 900 });
  const populatedNarrow = await harness.review.locator("body").evaluate((body) => ({ clientWidth: body.clientWidth, scrollWidth: body.scrollWidth }));
  expect(populatedNarrow.scrollWidth).toBeLessThanOrEqual(populatedNarrow.clientWidth + 1);
  await attachFrameScreenshot(harness.review.locator("body"), testInfo, "populated-review-narrow");
  await page.setViewportSize({ width: 1440, height: 900 });

  const exportPath = `/e2e/review-${Date.now()}.md`;
  await harness.review.getByLabel("Export Markdown path").fill(exportPath);
  await harness.review.getByRole("button", { name: "Export Markdown copy" }).click();
  await approveFilesTool(page, "writeBinary");
  const exportBanner = harness.review.locator(".banner");
  await expect(exportBanner).toBeVisible({ timeout: 5_000 });
  const exportMessage = await exportBanner.innerText();
  expect(exportMessage, `Review export did not succeed: ${exportMessage}`).toContain("portable copy, not a live share");

  await harness.review.getByLabel("Markdown or TODO path").fill(exportPath);
  await harness.review.getByRole("button", { name: "Import as new Review" }).click();
  await approveFilesTool(page, "readBinary");
  await expect(harness.review.getByText(/Imported 1 item into a new Review/)).toBeVisible();

  const atomChoices = harness.review.locator(".atom-choice");
  await expect(atomChoices).toHaveCount(2);
  const importedAtomId = await harness.review.locator(".atom-details dd").first().innerText();
  expect(importedAtomId).not.toBe(originalAtomId);
  await expect(harness.review.locator(".source-chip")).toHaveText(`Imported from ${exportPath}`);

  const importedCard = harness.review.locator(".review-card").filter({ hasText: "Review launches in vanilla Neutron" });
  await expect(importedCard).toBeVisible();
  await expect(importedCard.getByRole("button", { name: "Not tested", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(importedCard.getByLabel("Desired")).toHaveValue("");
  await expect(importedCard.getByLabel("Effort")).toHaveValue("");
  await expect(importedCard.getByLabel("Owner")).toHaveValue("");
  await expect(importedCard.getByLabel("Work")).toHaveValue("untriaged");
  await expect(importedCard.locator(".comment")).toHaveCount(0);
  await expect(harness.review.locator(".history-entry")).toHaveCount(1);
  await expect(harness.review.getByTestId("sharing-status").getByText("Live sharing isn’t available in this build")).toBeVisible();

  await page.reload({ waitUntil: "domcontentloaded" });
  await login(page);
  harness = await openReview(page);

  const reopenedChoices = harness.review.locator(".atom-choice");
  await expect(reopenedChoices).toHaveCount(2);
  const reopenedAtomIds: string[] = [];
  for (let index = 0; index < 2; index += 1) {
    await reopenedChoices.nth(index).click();
    reopenedAtomIds.push(await harness.review.locator(".atom-details dd").first().innerText());
  }
  expect(new Set(reopenedAtomIds)).toEqual(new Set([originalAtomId, importedAtomId]));

  const originalIndex = reopenedAtomIds.indexOf(originalAtomId);
  await reopenedChoices.nth(originalIndex).click();
  const reopenedOriginalCard = harness.review.locator(".review-card").filter({ hasText: "Review launches in vanilla Neutron" });
  await expect(reopenedOriginalCard.getByRole("button", { name: "Working", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(reopenedOriginalCard.getByText("Verified again after deliberate restore.")).toBeVisible();
  await expect(harness.review.getByTestId("persistence-status").getByText("Saved", { exact: true })).toBeVisible();
  await attachFrameScreenshot(harness.review.locator("body"), testInfo, "reopened-persisted-review");
});

async function expectReadable(locator: Locator, minimumRatio: number): Promise<void> {
  const colors = await locator.evaluate((element) => {
    const foreground = getComputedStyle(element).color;
    let current: Element | null = element;
    let background = "rgba(0, 0, 0, 0)";
    while (current) {
      const candidate = getComputedStyle(current).backgroundColor;
      if (!candidate.endsWith(", 0)") && candidate !== "transparent") {
        background = candidate;
        break;
      }
      current = current.parentElement;
    }
    return { foreground, background };
  });
  expect(contrastRatio(colors.foreground, colors.background), `${colors.foreground} on ${colors.background}`).toBeGreaterThanOrEqual(minimumRatio);
}

function contrastRatio(foreground: string, background: string): number {
  const fg = rgb(foreground);
  const bg = rgb(background);
  const lighter = Math.max(luminance(fg), luminance(bg));
  const darker = Math.min(luminance(fg), luminance(bg));
  return (lighter + 0.05) / (darker + 0.05);
}

function rgb(value: string): [number, number, number] {
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) throw new Error(`Unsupported computed color: ${value}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function luminance([red, green, blue]: [number, number, number]): number {
  const channels = [red, green, blue].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

async function attachFrameScreenshot(locator: Locator, testInfo: TestInfo, name: string): Promise<void> {
  await testInfo.attach(name, { body: await locator.screenshot(), contentType: "image/png" });
}
