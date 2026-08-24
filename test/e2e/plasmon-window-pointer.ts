import { expect, type Locator, type Page } from "@playwright/test";

const INTERACTIVE_TITLEBAR_DESCENDANTS = ".plasmon-window__controls, button, input, textarea, select, a, [role='button'], [role='menuitem']";

export interface NativeWindowDragStart {
  pageY: number;
  titlebarPoint: { x: number; y: number };
}

/**
 * Begin a real native-window drag through the rendered titlebar.
 *
 * Locator hover supplies Playwright's visibility/stability/receives-events
 * actionability boundary before a concrete raw-mouse coordinate is sampled.
 * The returned point is then proven to hit the rendered titlebar rather than a
 * control, and the production data-interacting lifecycle is the authority that
 * pointerdown actually established Plasmon's drag session.
 */
export async function startNativeWindowTitlebarDrag(
  page: Page,
  dialog: Locator,
  titlebar: Locator,
): Promise<NativeWindowDragStart> {
  await titlebar.hover();

  const titlebarPoint = await titlebar.evaluate((element, interactiveSelector) => {
    const rect = element.getBoundingClientRect();
    const y = Math.min(16, Math.max(1, rect.height / 2));
    const firstVisibleX = Math.max(1, Math.ceil(-rect.left) + 1);
    const lastVisibleX = Math.min(
      Math.floor(rect.width - 1),
      Math.floor(window.innerWidth - rect.left - 1),
    );

    for (let x = firstVisibleX; x <= lastVisibleX; x += 8) {
      const hit = document.elementFromPoint(rect.left + x, rect.top + y);
      if (!(hit instanceof Element) || !element.contains(hit)) continue;
      if (hit.closest(interactiveSelector)) continue;
      return { x, y };
    }
    return null;
  }, INTERACTIVE_TITLEBAR_DESCENDANTS);

  if (!titlebarPoint) {
    throw new Error("Native titlebar has no exposed draggable browser point");
  }

  await titlebar.hover({ position: titlebarPoint });
  await page.mouse.down();
  await expect(dialog).toHaveAttribute("data-interacting", "drag");

  const draggingTitlebarBox = await titlebar.boundingBox();
  if (!draggingTitlebarBox) {
    throw new Error("Dragging native titlebar has no browser bounds");
  }

  return {
    titlebarPoint,
    pageY: draggingTitlebarBox.y + titlebarPoint.y,
  };
}

/** Release a real native-window drag and observe the production session clear. */
export async function releaseNativeWindowTitlebarDrag(
  page: Page,
  dialog: Locator,
): Promise<void> {
  await page.mouse.up();
  await expect(dialog).not.toHaveAttribute("data-interacting", "drag");
}
