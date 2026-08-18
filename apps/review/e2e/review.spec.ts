import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { approveFilesTool, login, openReview } from "./harness.ts";

test("packaged Review first-run explains the human acceptance contract", async ({ page }, testInfo) => {
  await login(page);
  const harness = await openReview(page);

  await expect(harness.review.getByRole("heading", { name: "Human acceptance review" })).toBeVisible();
  await expect(harness.review.getByRole("heading", { name: "Test the real OS. Record what actually happened." })).toBeVisible();
  await expect(harness.review.getByText(/AI or engineer defines what needs verification/)).toBeVisible();
  await expect(harness.review.getByText(/Only Submit publishes a fresh snapshot/)).toBeVisible();
  await expect(harness.review.getByRole("button", { name: "Import AI test plan" })).toBeVisible();

  await page.emulateMedia({ colorScheme: "light" });
  await expectReadable(harness.review.locator(".review-app"), 4.5);
  await expectReadable(harness.review.locator(".first-run-lead"), 4.5);
  await attachBrowserScreenshot(page, testInfo, "human-review-first-run-light");

  await page.emulateMedia({ colorScheme: "dark" });
  await expectReadable(harness.review.locator(".review-app"), 4.5);
  await expectReadable(harness.review.locator(".first-run-lead"), 4.5);
  await attachBrowserScreenshot(page, testInfo, "human-review-first-run-dark");

  await page.setViewportSize({ width: 560, height: 900 });
  const narrowMetrics = await harness.review.locator("body").evaluate((body) => ({ clientWidth: body.clientWidth, scrollWidth: body.scrollWidth }));
  expect(narrowMetrics.scrollWidth).toBeLessThanOrEqual(narrowMetrics.clientWidth + 1);
});

test("packaged Review saves human results locally and submits only on explicit Submit", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "light" });
  await login(page);
  let harness = await openReview(page);

  await harness.review.getByLabel("Review name").fill("r2 Human Acceptance");
  await harness.review.getByRole("button", { name: "Create review" }).click();
  await expect(harness.review.locator(".review-workspace").getByRole("heading", { name: "r2 Human Acceptance" })).toBeVisible();
  await expect(harness.review.locator(".persistence-status").getByText("Local progress saved", { exact: true })).toBeVisible();

  await harness.review.getByLabel("Add acceptance check").fill("Explorer Back returns to the prior folder");
  await harness.review.getByRole("button", { name: "Add check" }).click();
  const card = harness.review.locator(".review-card").filter({ hasText: "Explorer Back returns to the prior folder" });
  await expect(card).toBeVisible();
  await expect(card.getByRole("heading", { name: "How to test / expected behavior" })).toBeVisible();
  await expect(card.getByRole("button", { name: "× Fail" })).toBeDisabled();

  await card.getByLabel("What happened?").fill("Back returned to the desktop instead of the previous folder.");
  await expect(card.getByRole("button", { name: "× Fail" })).toBeEnabled();
  await card.getByRole("button", { name: "× Fail" }).click();
  await expect(card.getByText("Fail", { exact: true }).first()).toBeVisible();
  await expect(harness.review.getByText("0 Pass")).toBeVisible();
  await expect(harness.review.getByText("1 Fail")).toBeVisible();
  await expect(harness.review.getByText("0 Remaining")).toBeVisible();
  await expect(harness.review.locator(".submission-state")).toContainText("Changes not submitted");
  await attachBrowserScreenshot(page, testInfo, "recorded-human-failure");

  await page.reload({ waitUntil: "domcontentloaded" });
  await login(page);
  harness = await openReview(page);
  const reopenedCard = harness.review.locator(".review-card").filter({ hasText: "Explorer Back returns to the prior folder" });
  await expect(reopenedCard).toBeVisible();
  await expect(reopenedCard.getByText("Fail", { exact: true }).first()).toBeVisible();
  await expect(reopenedCard.getByLabel("What happened?")).toHaveValue("Back returned to the desktop instead of the previous folder.");

  const submissionPath = `/e2e/review-submission-${Date.now()}.md`;
  await harness.review.getByLabel("Submission file").fill(submissionPath);
  await harness.review.getByRole("button", { name: "Submit", exact: true }).click();
  await approveFilesTool(page, "writeBinary");
  await expect(harness.review.getByText(/Submitted revision/)).toBeVisible({ timeout: 5_000 });
  await expect(harness.review.locator(".submission-state")).toContainText("Submitted snapshot is current");

  await reopenedCard.getByLabel("What happened?").fill("");
  await reopenedCard.getByRole("button", { name: "✓ Pass" }).click();
  await expect(reopenedCard.getByText("Pass", { exact: true }).first()).toBeVisible();
  await expect(harness.review.locator(".submission-state")).toContainText("Changes not submitted");

  await expect(harness.review.getByRole("button", { name: "Refresh" })).toBeVisible();
  await expect(harness.review.getByText(/Other reviewers' queued changes appear only after Refresh/)).toBeVisible();

  await page.setViewportSize({ width: 620, height: 900 });
  const populatedNarrow = await harness.review.locator("body").evaluate((body) => ({ clientWidth: body.clientWidth, scrollWidth: body.scrollWidth }));
  expect(populatedNarrow.scrollWidth).toBeLessThanOrEqual(populatedNarrow.clientWidth + 1);
  await attachBrowserScreenshot(page, testInfo, "human-review-narrow");
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

async function attachBrowserScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await testInfo.attach(name, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
}
