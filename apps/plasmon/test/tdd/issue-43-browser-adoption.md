# #43 browser adoption instructions

**Status:** BROWSER SPEC ONLY; local browser execution was not claimed.

Adopt into the existing `test/e2e/plasmon-golden-path.spec.ts` after `dialog`, `titlebar`, and `workspace` are established (the file already opens a real Explorer window and proves left/right snap state). Run:

```sh
npx playwright test test/e2e/plasmon-golden-path.spec.ts --project=chromium --retries=0
```

Insert this executable block after the current right-snap assertion. It uses existing `page`, `dialog`, `titlebar`, `workspace` fixtures and no new product API:

```ts
const snapProbe = async (side: "left" | "right") => {
  const before = await dialog.boundingBox();
  const title = await titlebar.boundingBox();
  if (!before || !title) throw new Error("snap probe has no window/titlebar bounds");
  const grab = { x: title.x + Math.min(120, title.width / 2), y: title.y + Math.min(16, title.height / 2) };
  const offset = { x: grab.x - before.x, y: grab.y - before.y };
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  const releaseX = side === "left" ? workspace.x + workspace.width * 0.24 : workspace.x + workspace.width * 0.76;
  await page.mouse.move(releaseX, grab.y, { steps: 5 });
  await page.mouse.up();
  const after = await dialog.boundingBox();
  if (!after) throw new Error("snap probe has no post-drag bounds");
  expect(Math.abs((grab.x - after.x) - offset.x)).toBeLessThanOrEqual(2);
  expect(Math.abs((grab.y - after.y) - offset.y)).toBeLessThanOrEqual(2);
  expect(await dialog.getAttribute("data-window-snap")).toBeNull();
};

await dragTitlebarTo(workspace.x + 1);
await expect(dialog).toHaveAttribute("data-window-snap", "left");
await snapProbe("left");
await dragTitlebarTo(workspace.x + workspace.width - 1);
await expect(dialog).toHaveAttribute("data-window-snap", "right");
await snapProbe("right");
```

The adopted spec must add repeated left/right snap-out, small viewport, pointer-cancel/lost-capture cleanup, and strict browser-health assertions. It must record pointer coordinates, grab offset, pre/post rects, snap state, and cleanup. Do not reduce the gate to `window moved`.
