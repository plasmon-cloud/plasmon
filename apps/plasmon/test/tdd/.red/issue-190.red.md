# Issue #190 — shared resource presentation and icon identity

## Disposition

**BROWSER BOUNDARY / RED.** Deterministic presentation and shortcut-composition
coverage is already green. The packaged runtime still requests Plasmon-owned
icons at `/static/plasmon/...` even though the installed package is mounted at
`/app/plasmon/...`; #187's browser-health ledger records this as a known
intentional allowance. This packet must remove that allowance by proving actual
installed asset loading.

## PRESERVE

- Filesystem/resource metadata and #189 classification own identity.
- Visual consumes resolved presentation; it does not inspect `FsNode`, suffixes,
  hidden state, or dereference shortcuts.
- Shortcut target identity is preserved and receives the shared overlay.
- Image thumbnail containment, lazy loading, failure fallback, and object URL
  cleanup remain intact.
- Missing/failed image sources remain deterministic safe fallbacks.

## CHANGE

- Every Plasmon-owned shared asset must resolve through the installed package
  mount and load successfully in the packaged browser runtime.
- Desktop, FileManager, Search, Start, taskbar, Properties, and native surfaces
  must consume the shared presentation vocabulary without competing primary
  icon tables.
- Remove the temporary #187 `/static/plasmon/icons/` browser-health allowance
  once the runtime path is corrected.

## UNSPECIFIED

- Final asset-root implementation and bundler/public-file mechanism.
- Artwork pixels, exact sizing, and theme redesign.
- Whether a future resolver adds caching; #171's bounded request behavior still
  applies.

## Existing green characterization

`src/os/visual/visual.test.ts`, `visual.components.test.tsx`,
`src/os/file-manager/file-icons.test.ts`, and `src/os/file-manager/polish.test.tsx`
cover deterministic file/folder/application/shortcut/thumbnail/fallback
composition. They are not replaced by the browser gate.

## Browser acceptance gate

The implementor should run a packaged Playwright journey and assert that the
representative shared icon requests are successful under the installed
`/app/plasmon/static/plasmon/icons/` path, with no first-party 404/ORB failures.
Do not weaken browser-health or substitute a static URL-string assertion for
actual asset loading.

## Authority boundary

Resource classification is #189; Visual owns resolved presentation and
composition; Neutron owns installed app/package identity; FileManager/Desktop
remain consumers and interaction owners. Do not move MIME inference or shortcut
execution into Visual.
