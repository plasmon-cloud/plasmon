# Browser.sys boundary matrix

| concern | Plasmon Browser owns | foreign/web content owns | evidence |
|---|---|---|---|
| identity/chrome | root label, address, Go, external action, loading/error | document title/body | RTL + packaged iframe |
| navigation | URL normalization and target update | page navigation within iframe | Bun URL tests + browser |
| keyboard | address form, Escape/focus conventions | iframe document shortcuts | browser focus boundary |
| context menu | Plasmon toolbar/window UI | foreign page inside iframe | #176 global ownership; no competing packet |
| downloads/popups | explicit external/open behavior and sandbox attributes | site download request | genuine browser/package only |
| iframe boundary | sandboxed iframe, no same-origin grant | site scripts/content | packaged browser |
| errors | embedded-load/error surface and actionable external route | foreign page errors | page health scoped by origin |

`Browser.tsx` uses a sandbox without `allow-same-origin`; this is a security
boundary, not a defect to bypass. Global context-menu ownership is #176 and
active implementation; this audit does not duplicate it. No unowned Browser.sys
r2 Issue with an app-specific primary authority was found.
