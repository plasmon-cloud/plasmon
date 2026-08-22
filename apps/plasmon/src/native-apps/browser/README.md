# Browser

<!-- plasmon-docs-review:v1 sha256=ad95db631ce1513c301b0029a89c6e41566b602a44a8951c0f75420c64c78ec1 base=2f895e1b9df52cd127020356f00989dc08c8a25e -->

The Browser native app presents HTTP(S) web targets inside a Plasmon native window and offers external navigation when embedded browsing is unsuitable.

`url.ts` owns deterministic URL normalization/validation and resource-to-URL resolution. `Browser.tsx` owns address-bar UI, iframe presentation, loading/error state, and external-window interaction.

Generic shortcut/resource dereference and association selection remain shared OS responsibilities. This app should receive an already selected browser target rather than becoming a second generic dispatcher.

## Refactor direction

Keep URL/security normalization below React and keep iframe/browser-policy behavior in the Browser surface. If navigation history, permissions, downloads, or richer browsing are added, model them explicitly rather than scattering browser state through event handlers.

## Testing

Use fast tests for URL parsing, safe-scheme policy, and target resolution. Use real-browser tests for iframe restrictions, external-window behavior, focus/navigation UI, and browser-policy failure states.
