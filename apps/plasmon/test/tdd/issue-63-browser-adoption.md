# #63 Alt-Tab browser adoption

**Status:** RTL RED is executable; real packaged keyboard delivery remains unexecuted locally.

Adopt into the existing packaged refactor smoke after two native windows are opened through production Search/FileManager activation. Use the existing `plasmon` frame and `installPlasmonBrowserHealth` policy:

```ts
const taskbar = plasmon.getByRole("navigation", { name: "Taskbar" });
const files = taskbar.getByRole("button", { name: /Files; Active and focused/ });
const text = taskbar.getByRole("button", { name: /Text Editor; Active and focused/ });
await expect(files).toBeVisible();
await expect(text).toBeVisible();
await plasmon.locator("body").press("Alt+Tab");
await expect(files).toHaveAttribute("aria-pressed", "true");
await expect(plasmon.getByRole("listbox", { name: "Window switcher" })).toBeVisible();
```

The final test must hold Alt while sending repeated Tab events, assert deterministic MRU cycling, assert a minimized selected window is restored/focused through taskbar/window state, release Alt to commit, and use Escape (while held) to cancel without changing focus. Assert accessible labels/icons and exclude closed windows. Do not derive order from DOM/taskbar order. Fail unexpected browser errors through the strict #187 health listener. The current RTL failures are:

- focus remains `native:text#1` instead of cycling to `native:explorer#1`;
- no accessible `listbox[name="Window switcher"]` exists.
