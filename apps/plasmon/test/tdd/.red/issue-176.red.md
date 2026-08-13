# Issue #176 — first-party browser/context ownership

## Disposition

**BROWSER BOUNDARY / RECONNAISSANCE.** Current FileManager specialized context
menus call `preventDefault()` and existing packaged smoke covers taskbar
specialized menus. A complete r2 gate must still cover representative
first-party FileManager/sidebar/native-app surfaces and explicit foreign Browser
content exemptions using real event propagation; no broad global interception or
source-shape test is staged here.

## Preserve

Specialized subsystem menus, editable-control text behavior, foreign/embedded
browser ownership, keyboard dismissal, and command authority remain separate.

## Change to specify after shared event seam is observable

One bounded first-party ownership policy should suppress browser-native menus
and provide either the specialized menu or a supported fallback. It must not
become a global `preventDefault()` hack or absorb #115 command semantics.

Existing relevant evidence: FileManager `onContextMenu`, Shell/taskbar context
handling, `openWithDialog` pointer handling, RTL refactor smoke, and packaged
refactor smoke. A later focused Playwright gate should assert browser event
outcomes, not DOM structure.
