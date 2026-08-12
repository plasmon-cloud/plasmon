import { expect, test } from "@playwright/test";
import { approveFilesTool, login, openReview } from "./harness.ts";

test("packaged vanilla Neutron Review persists and round-trips Markdown through Files", async ({ page }) => {
  await login(page);
  let harness = await openReview(page);

  await harness.review.getByLabel("New review").fill("Packaged Review Gate");
  await harness.review.getByRole("button", { name: "Create Atom" }).click();
  await expect(harness.review.getByRole("heading", { name: "Packaged Review Gate" })).toBeVisible();

  await harness.review.getByLabel("New review item").fill("Review launches in vanilla Neutron");
  await harness.review.getByRole("button", { name: "Add item" }).click();
  const card = harness.review.locator(".review-card").filter({ hasText: "Review launches in vanilla Neutron" });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Working", exact: true }).click();
  await expect(card.getByRole("button", { name: "Working", exact: true })).toHaveClass(/active/);

  await card.getByLabel("Desired").selectOption("must");
  await card.getByLabel("Effort").selectOption("small");
  await card.getByLabel("Owner").fill("Agent 13");
  await card.getByLabel("Work state").selectOption("needs_retest");
  await card.getByRole("button", { name: "Save coordination" }).click();
  await card.getByLabel("Comment on Review launches in vanilla Neutron").fill("Packaged workflow verified.");
  await card.getByRole("button", { name: "Comment" }).click();
  await expect(card.getByText("Packaged workflow verified.")).toBeVisible();

  const atomChoices = harness.review.locator(".atom-choice");
  await expect(atomChoices).toHaveCount(1);
  const originalIdentity = await atomChoices.first().locator("span").innerText();
  expect(originalIdentity).toContain("r5 · ");

  const exportPath = `/e2e/review-${Date.now()}.md`;
  await harness.review.getByLabel("Export Markdown path").fill(exportPath);
  await harness.review.getByRole("button", { name: "Export Markdown" }).click();
  await approveFilesTool(page, "writeBinary");
  const exportBanner = harness.review.locator(".banner");
  await expect(exportBanner).toBeVisible({ timeout: 5_000 });
  const exportMessage = await exportBanner.innerText();
  expect(exportMessage, `Review export did not succeed: ${exportMessage}`).toContain("Exported revision");

  await harness.review.getByLabel("Markdown or TODO path").fill(exportPath);
  await harness.review.getByRole("button", { name: "Open Markdown/TODO" }).click();
  await approveFilesTool(page, "readBinary");
  await expect(harness.review.getByText(/Imported 1 item; source path remains provenance only\./)).toBeVisible();

  await expect(atomChoices).toHaveCount(2);
  const importedChoice = harness.review.locator(".atom-choice.active");
  const importedIdentity = await importedChoice.locator("span").innerText();
  expect(importedIdentity).toContain("r1 · ");
  expect(importedIdentity).not.toBe(originalIdentity);
  await expect(harness.review.locator(".source-chip")).toHaveText(`Source: ${exportPath}`);

  const importedCard = harness.review.locator(".review-card").filter({ hasText: "Review launches in vanilla Neutron" });
  await expect(importedCard).toBeVisible();
  await expect(importedCard.getByRole("button", { name: "Not Tested", exact: true })).toHaveClass(/active/);
  await expect(importedCard.getByLabel("Desired")).toHaveValue("");
  await expect(importedCard.getByLabel("Effort")).toHaveValue("");
  await expect(importedCard.getByLabel("Owner")).toHaveValue("");
  await expect(importedCard.getByLabel("Work state")).toHaveValue("untriaged");
  await expect(importedCard.locator(".comments p")).toHaveCount(0);
  await expect(harness.review.locator(".history-entry")).toHaveCount(1);

  await page.reload({ waitUntil: "domcontentloaded" });
  await login(page);
  harness = await openReview(page);

  const reopenedChoices = harness.review.locator(".atom-choice");
  await expect(reopenedChoices).toHaveCount(2);
  const reopenedIdentities = await reopenedChoices.locator("span").allInnerTexts();
  expect(reopenedIdentities).toContain(originalIdentity);
  expect(reopenedIdentities).toContain(importedIdentity);

  const originalChoice = reopenedChoices.filter({ hasText: originalIdentity });
  await originalChoice.click();
  const reopenedOriginalCard = harness.review.locator(".review-card").filter({ hasText: "Review launches in vanilla Neutron" });
  await expect(reopenedOriginalCard.getByRole("button", { name: "Working", exact: true })).toHaveClass(/active/);
  await expect(reopenedOriginalCard.getByText("Packaged workflow verified.")).toBeVisible();

  const persistedImportedChoice = reopenedChoices.filter({ hasText: importedIdentity });
  await persistedImportedChoice.click();
  await expect(harness.review.locator(".source-chip")).toHaveText(`Source: ${exportPath}`);
  await expect(harness.review.locator(".review-card").filter({ hasText: "Review launches in vanilla Neutron" }).getByRole("button", { name: "Not Tested", exact: true })).toHaveClass(/active/);
});
