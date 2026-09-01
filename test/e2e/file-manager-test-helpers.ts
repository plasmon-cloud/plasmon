import { type Locator } from "@playwright/test";
import { clickNewContextMenuItem } from "./plasmon-context-menu.ts";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

function containsPoint(box: Box, point: { x: number; y: number }, margin = 4): boolean {
  return point.x >= box.x - margin
    && point.x <= box.x + box.width + margin
    && point.y >= box.y - margin
    && point.y <= box.y + box.height + margin;
}

/** Open a FileManager background menu without relying on removed creation buttons. */
export async function chooseFileManagerBackgroundAction(
  files: Locator,
  action: "New Folder" | "New Text Document" | "New Markdown Document",
): Promise<void> {
  const bounds = await files.boundingBox();
  if (!bounds) throw new Error("FileManager surface has no browser bounds");

  const entryBoxes = await files.getByRole("option").evaluateAll((entries) => entries.map((entry) => {
    const rect = entry.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }));
  const candidates = [
    { x: 12, y: 12 },
    { x: bounds.width - 12, y: 12 },
    { x: 12, y: bounds.height - 12 },
    { x: bounds.width - 12, y: bounds.height - 12 },
    { x: bounds.width / 2, y: bounds.height / 2 },
  ].filter((point) => point.x >= 1 && point.y >= 1 && point.x <= bounds.width - 1 && point.y <= bounds.height - 1);
  const point = candidates.find((candidate) => !entryBoxes.some((entry) => containsPoint(
    entry,
    { x: bounds.x + candidate.x, y: bounds.y + candidate.y },
  )));
  if (!point) throw new Error("No exposed FileManager background point is available");

  await files.click({ button: "right", position: point });
  await clickNewContextMenuItem(files, action);
}
