# #176 packaged browser adoption

**Status:** browser boundary specified; not executed locally.

Adopt into the existing packaged Plasmon/refactor smoke after the Shell, a FileManager surface, a first-party native window, and an intentional embedded Browser/foreign frame are available. Reuse the existing `plasmon` page/frame and strict browser-health listener; do not add a context-menu harness.

The adopted spec must perform real right-clicks and record, for each target:

| target | expected event ownership |
|---|---|
| taskbar/background Shell-owned surface | `contextmenu.defaultPrevented === true`; specialized/generic Plasmon menu is visible |
| running task/native specialized target | prevented by Plasmon; specialized menu remains the only command surface |
| FileManager entry/sidebar/background | prevented by FileManager; capability-aware menu is visible |
| FileManager rename textbox and native editor/address inputs | intentional editable behavior is preserved; no generic ancestor interception |
| first-party native-app chrome/content root | prevented by owning app/Plasmon boundary, with no browser menu |
| Browser iframe / foreign authenticated content | not intercepted by an outer Plasmon handler; foreign/browser owner remains authoritative |

Use a capture listener only to record the real event's `defaultPrevented` value and target boundary; do not dispatch synthetic events as the browser proof. Assert no unexpected console/page/request failures, menu ownership remains accessible, and cleanup removes listeners/windows. The actual browser default menu is not queried through a fake DOM element.

Run through the existing packaged command/project, for example:

```sh
npx playwright test test/e2e/plasmon-refactor-smoke.spec.ts --project=chromium --retries=0
```

The deterministic editable RED is already executable in `issue-176.red.ui.test.tsx`; this browser adoption is only for real propagation, iframe/foreign ownership, and browser-default behavior.
