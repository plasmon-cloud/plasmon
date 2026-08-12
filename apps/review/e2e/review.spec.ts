import { expect, test } from "@playwright/test";
import { approveFilesTool, callReviewTool, login, openReview } from "./harness.ts";

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
  await card.getByRole("button", { name: "Working" }).click();
  await expect(card.getByRole("button", { name: "Working" })).toHaveClass(/active/);

  await card.getByLabel("Desired").selectOption("must");
  await card.getByLabel("Effort").selectOption("small");
  await card.getByLabel("Owner").fill("Agent 13");
  await card.getByLabel("Work state").selectOption("needs_retest");
  await card.getByRole("button", { name: "Save coordination" }).click();
  await card.getByLabel("Comment on Review launches in vanilla Neutron").fill("Packaged workflow verified.");
  await card.getByRole("button", { name: "Comment" }).click();
  await expect(card.getByText("Packaged workflow verified.")).toBeVisible();

  const beforePortability = await callReviewTool(page, "review_catalog", {});
  expect(beforePortability.atoms).toHaveLength(1);
  const originalAtomId = beforePortability.atoms[0].atomId;
  const originalRevision = beforePortability.atoms[0].currentRevision;

  const exportPath = `/e2e/review-${Date.now()}.md`;
  await harness.review.getByLabel("Export Markdown path").fill(exportPath);
  await harness.review.getByRole("button", { name: "Export Markdown" }).click();
  await approveFilesTool(page, "writeBinary");
  await expect(harness.review.getByText(`Exported revision`, { exact: false })).toBeVisible();

  await harness.review.getByLabel("Markdown or TODO path").fill(exportPath);
  await harness.review.getByRole("button", { name: "Open Markdown/TODO" }).click();
  await approveFilesTool(page, "readBinary");
  await expect(harness.review.getByText(/Imported 1 item; source path remains provenance only\./)).toBeVisible();

  const afterImport = await callReviewTool(page, "review_catalog", {});
  expect(afterImport.atoms).toHaveLength(2);
  const imported = afterImport.atoms.find((entry: any) => entry.atomId !== originalAtomId);
  expect(imported).toBeTruthy();
  const importedState = await callReviewTool(page, "review_atom", { atomId: imported.atomId });
  expect(importedState.meta.source.path).toBe(exportPath);
  expect(importedState.meta.atomId).not.toBe(exportPath);
  expect(importedState.items.map((item: any) => item.title)).toEqual(["Review launches in vanilla Neutron"]);
  expect(Object.keys(importedState.items[0].results)).toHaveLength(0);

  await page.reload({ waitUntil: "domcontentloaded" });
  await login(page);
  harness = await openReview(page);
  const afterReload = await callReviewTool(page, "review_catalog", {});
  expect(afterReload.atoms).toHaveLength(2);
  const reopenedOriginal = afterReload.atoms.find((entry: any) => entry.atomId === originalAtomId);
  expect(reopenedOriginal.currentRevision).toBe(originalRevision);
  expect(afterReload.atoms.some((entry: any) => entry.atomId === imported.atomId)).toBe(true);
});
