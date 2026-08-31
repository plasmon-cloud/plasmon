import { expect, type FrameLocator, type Locator } from "@playwright/test";

export type PlasmonContextMenuScope = Locator | FrameLocator;

/** Open an item from the Desktop/FileManager background New submenu. */
export async function clickNewContextMenuItem(
  scope: PlasmonContextMenuScope,
  name: "New Folder" | "New Text Document" | "New Markdown Document",
): Promise<void> {
  const menu = scope.getByRole("menu", { name: "Folder background context menu" });
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: "New", exact: true }).click();
  const submenu = menu.getByRole("menu", { name: "New submenu" });
  await expect(submenu).toBeVisible();
  const item = submenu.getByRole("menuitem", { name, exact: true });
  await item.focus();
  await item.press("Enter");
}
