# #177 browser adoption instructions

**Status:** HEADLESS RED plus browser adoption required.

Add to the existing packaged Explorer flow in `test/e2e/plasmon-golden-path.spec.ts` after `workspace` exists:

```ts
const first = await dialog.boundingBox();
if (!first) throw new Error("first native window has no bounds");
await dialog.getByRole("button", { name: "Close" }).click();
await expect(dialog).toHaveCount(0);
await rootShortcut.dblclick();
const reopened = app.locator(".plasmon-window-layer [data-window-id]").last();
await expect(reopened).toBeVisible();
const second = await reopened.boundingBox();
if (!second) throw new Error("reopened native window has no bounds");
expect(second.x).toBeGreaterThanOrEqual(workspace.x - 1);
expect(second.y).toBeGreaterThanOrEqual(workspace.y - 1);
expect(second.x + second.width).toBeLessThanOrEqual(workspace.x + workspace.width + 1);
expect(second.y + Math.min(38, second.height)).toBeLessThanOrEqual(workspace.y + workspace.height + 1);
```

Repeat enough opens/closes to exhaust cascade space, use a narrow/short viewport project or `page.setViewportSize`, and assert titlebar/control reachability via DOMRects rather than exact pixels. The pure gate is:

```sh
bun test ./apps/plasmon/test/tdd/.red/issue-177.red.test.ts
```

Current deterministic failure is exact: after 60 close/reopen cycles, current last geometry is `{x:1208,y:688,width:720,height:520}` while desired policy wraps/restarts at the first bounded placement. Browser execution was not claimed locally.
