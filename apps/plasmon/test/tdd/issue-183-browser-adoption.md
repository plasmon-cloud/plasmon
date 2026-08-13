# #183 browser adoption instructions

**Status:** RTL RED for missing Close; browser geometry specification ready. Alignment persistence currently has a missing production preference seam and must not be faked in tests.

Adopt into `test/e2e/plasmon-refactor-smoke.spec.ts`, which already opens Settings, right-clicks the taskbar task, and measures `taskMenu` bounds:

```ts
const taskBox = await taskBounds;
const menuBox = await taskMenu.boundingBox();
if (!menuBox) throw new Error("taskbar context menu has no bounds");
expect(Math.abs(menuBox.x - taskBox.x)).toBeLessThan(80);
expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(viewport.height + 1);
expect(menuBox.y).toBeLessThanOrEqual(taskBox.y + 2);
await expect(taskMenu.getByRole("menuitem", { name: "Close" })).toBeVisible();
```

Repeat for a task near each viewport edge and for taskbar background. On `Close`, use a clean native process and assert the taskbar projection reconciles; separately use the existing packaged dirty-document prompt flow to prove veto/defer remains intact. The close action must be observed through Process lifecycle, not DOM disappearance. Alignment adoption requires the implementor to expose Center/Left through the existing `ShellPreferenceStore`; then add reconstruction proof in `src/os/shell/preferencesFs.test.ts` and RTL visible alignment assertions.
