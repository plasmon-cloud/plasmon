import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { login, openReview } from "./harness.ts";

const TEST_PLAN = `# r2 Human Acceptance\n\n- [ ] Explorer Back returns to the prior folder\n  1. Open Explorer.\n  2. Navigate into Documents and then a child folder.\n  3. Press Back.\n  Expected: Explorer returns to Documents.\n\n- [ ] Markdown files open in Markdown\n  1. Open Explorer.\n  2. Double-click a Markdown file.\n  Expected: Markdown opens the selected file.`;

test("packaged Review first-run makes the human acceptance workflow obvious", async ({ page }, testInfo) => {
  await login(page);
  const harness = await openReview(page);

  await expect(harness.review.getByRole("heading", { name: "Human acceptance review" })).toBeVisible();
  await expect(harness.review.getByRole("heading", { name: "Test the real OS. Record what actually happened." })).toBeVisible();
  await expect(harness.review.getByText(/AI says what humans should verify/)).toBeVisible();
  await expect(harness.review.getByRole("button", { name: "Paste AI test plan" }).first()).toBeVisible();
  await expect(harness.review.getByText(/Pass\/Fail results save as you record them/)).toBeVisible();

  await harness.review.getByRole("button", { name: "Paste AI test plan" }).first().click();
  const dialog = harness.review.getByRole("dialog", { name: "Paste AI test plan" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/top-level bullet or checkbox becomes one acceptance check/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Create Review from plan" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Close import" }).click();

  await page.emulateMedia({ colorScheme: "light" });
  await expectReadable(harness.review.locator(".review-app"), 4.5);
  await attachBrowserScreenshot(page, testInfo, "review-395-first-run-light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expectReadable(harness.review.locator(".review-app"), 4.5);
  await attachBrowserScreenshot(page, testInfo, "review-395-first-run-dark");
});

test("packaged Review pastes a plan, resumes human progress, and submits without Files", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "light" });
  await login(page);
  let harness = await openReview(page);

  await harness.review.getByRole("button", { name: "Paste AI test plan" }).first().click();
  const dialog = harness.review.getByRole("dialog", { name: "Paste AI test plan" });
  await dialog.getByLabel("Review name").fill("r2 Human Acceptance");
  await dialog.getByLabel("Test plan").fill(TEST_PLAN);
  await dialog.getByRole("button", { name: "Create Review from plan" }).click();

  await expect(harness.review.locator(".review-workspace").getByRole("heading", { name: "r2 Human Acceptance" })).toBeVisible();
  await expect(harness.review.getByText("0 of 2 checks reviewed by you.")).toBeVisible();
  await expect(harness.review.getByText("2 Remaining", { exact: true })).toBeVisible();

  let backCard = harness.review.locator(".review-card").filter({ hasText: "Explorer Back returns to the prior folder" });
  await expect(backCard.getByRole("heading", { name: "Test instructions / expected result" })).toBeVisible();
  await expect(backCard.getByText("Press Back.")).toBeVisible();
  await expect(backCard.getByText("Expected: Explorer returns to Documents.")).toBeVisible();
  await expect(backCard.getByRole("button", { name: "× Fail" })).toBeDisabled();

  await backCard.getByLabel("What happened?").fill("Back returned to the desktop instead of Documents.");
  await backCard.getByRole("button", { name: "× Fail" }).click();
  await expect(backCard.getByText("Fail", { exact: true }).first()).toBeVisible();
  await expect(harness.review.getByText("1 Fail", { exact: true })).toBeVisible();
  await expect(harness.review.getByText("1 Remaining", { exact: true })).toBeVisible();
  await expect(harness.review.locator(".submission-state")).toContainText("Current changes are not submitted");
  await attachBrowserScreenshot(page, testInfo, "review-395-recorded-failure");

  await page.reload({ waitUntil: "domcontentloaded" });
  await login(page);
  harness = await openReview(page);
  backCard = harness.review.locator(".review-card").filter({ hasText: "Explorer Back returns to the prior folder" });
  await expect(backCard.getByText("Fail", { exact: true }).first()).toBeVisible();
  await expect(backCard.getByLabel("What happened?")).toHaveValue("Back returned to the desktop instead of Documents.");

  await harness.review.getByRole("button", { name: "Submit current review" }).click();
  await expect(harness.review.locator(".submission-state")).toContainText("Submitted snapshot is current");
  const snapshot = harness.review.getByLabel("Submitted review snapshot");
  await expect(snapshot).toBeVisible();
  await expect(snapshot).toHaveValue(/Explorer Back returns to the prior folder/);
  await expect(snapshot).toHaveValue(/human:local: FAIL/);
  await expect(snapshot).toHaveValue(/Back returned to the desktop instead of Documents\./);

  await harness.review.getByRole("button", { name: "Copy for AI" }).click();
  await expect(harness.review.getByText(/Submitted review copied/)).toBeVisible();

  const markdownCard = harness.review.locator(".review-card").filter({ hasText: "Markdown files open in Markdown" });
  await markdownCard.getByRole("button", { name: "✓ Pass" }).click();
  await expect(harness.review.getByText("1 Pass", { exact: true })).toBeVisible();
  await expect(harness.review.locator(".submission-state")).toContainText("Current changes are not submitted");

  await harness.review.getByRole("button", { name: "Submit current review" }).click();
  await expect(harness.review.locator(".submission-state")).toContainText("Submitted snapshot is current");
  await expect(harness.review.getByLabel("Submitted review snapshot")).toHaveValue(/human:local: PASS/);
  await expect(harness.review.getByRole("button", { name: "Refresh" })).toBeVisible();

  await page.reload({ waitUntil: "domcontentloaded" });
  await login(page);
  harness = await openReview(page);
  await expect(harness.review.locator(".submission-state")).toContainText("Submitted snapshot is current");
  await harness.review.getByRole("button", { name: "Show submitted snapshot" }).click();
  await expect(harness.review.getByLabel("Submitted review snapshot")).toHaveValue(/human:local: PASS/);

  await page.setViewportSize({ width: 620, height: 900 });
  const narrow = await harness.review.locator("body").evaluate((body) => ({ clientWidth: body.clientWidth, scrollWidth: body.scrollWidth }));
  expect(narrow.scrollWidth).toBeLessThanOrEqual(narrow.clientWidth + 1);
  await attachBrowserScreenshot(page, testInfo, "review-395-narrow");
});

async function expectReadable(locator: Locator, minimumRatio: number): Promise<void> {
  const colors = await locator.evaluate((element) => {
    const foreground = getComputedStyle(element).color;
    let current: Element | null = element;
    let background = "rgba(0, 0, 0, 0)";
    while (current) {
      const candidate = getComputedStyle(current).backgroundColor;
      if (!candidate.endsWith(", 0)") && candidate !== "transparent") { background = candidate; break; }
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
