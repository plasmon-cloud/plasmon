# #96 post-#190 reassessment

Audit base: PR #211 (`b66081630d6edc57f913b07cde7beabdf02bdefe`), the accepted
#190 candidate, before integration. This document deliberately does not modify
PR #211 or create artwork.

## What #190 changed

#190 established and migrated the **consumer** side of application/resource
presentation:

- `os/visual/resource-presentation.ts` maps already-authoritative resource
  classification and native handler identity to `ResourceIconPresentation`.
- `os/visual/primitives.tsx` renders application artwork through `NativeAppIcon`
  and uses the shared `application.svg` fallback when a reference is missing or
  fails to load.
- `os/visual/assets.ts` owns the shared Plasmon static asset vocabulary and the
  package-installed path contract.
- Shell, FileManager, Explorer, Properties, Search, Start, taskbar, and shortcut
  consumers use the shared visual adapter rather than their former local icon
  tables or initials/glyph fallback rules.
- #190 added deterministic fallback characterization and an installed-package
  asset request/HTTP gate for representative shared assets.

The #190 candidate did **not** change `native-apps/content-apps.ts` or the
canonical identity values for Text Editor, Markdown, Photos, Video Player,
Browser, and Settings. Those six handlers/apps still publish inline generated
SVG data URIs (`T`, `M↓`, `▧`, `▶`, `↗`, `⚙`). The new resolver can consume an
image reference if supplied, but it does not manufacture or curate first-party
identity references.

## Ownership boundary

| concern | owner | #96 status |
|---|---|---|
| first-party identity asset bytes, provenance, and offline package references | #96 / Native Apps + Visual asset contract | unmet |
| HandlerDefinition/NativeAppDefinition identity metadata | native app registry metadata | unmet for six apps |
| app/handler ID and association semantics | associations/native app registry | preserve; not tested as artwork behavior |
| shared app/resource presentation and fallback | #190 Visual seam | accepted/characterized |
| consumer icon tables, shortcut composition, sizing | #190 | migrated; not #96 work |
| filesystem type/folder/media icons | #190 / resource presentation | out of scope |
| runtime-only js-dos and EmulatorJS identities | runtime issues (#48/#202/#121) | excluded from #96 gate |
| accessibility naming | semantic app/handler/row metadata | independent of decorative asset pixels |

## Six first-party identity results

| app | handler/app metadata at #211 | packaged identity reference at #211 | consumer path after #190 | disposition |
|---|---|---|---|---|
| Text Editor | `content-apps.ts`, generated `data:image/svg+xml` | no metadata reference to `text.svg` | shared resolver can consume future reference | **FULL/CORE RED** |
| Markdown | same, generated `M↓` | no metadata reference to `markdown.svg` | shared resolver can consume future reference | **FULL/CORE RED** |
| Photos | same, generated `▧` | no metadata reference to `photos.svg` | shared resolver can consume future reference | **FULL/CORE RED** |
| Video Player | same, generated `▶` | no metadata reference to `video.svg` | shared resolver can consume future reference | **FULL/CORE RED** |
| Browser | same, generated `↗` | no metadata reference to `browser.svg` | shared resolver can consume future reference | **FULL/CORE RED** |
| Settings | same, generated `⚙` | no metadata reference to `settings.svg` | shared resolver can consume future reference | **FULL/CORE RED** |

The candidate package already contains same-named shared SVGs under
`public/static/plasmon/icons/`, but mere file presence does not make them
canonical application identity. #96 must connect canonical handler/app metadata
to package-owned references. It must not prescribe the pixels or add a second
surface-specific map.

## Refreshed executable RED

`.red/issue-96.red.test.ts` now proves only the remaining deterministic defect:

1. exactly the six user-launchable first-party definitions are in scope;
2. each app and its handler retain the same ID/metadata identity;
3. each app/handler icon value is one shared canonical value;
4. references are not generated data URIs or external URLs;
5. references use the package-owned static icon path vocabulary; and
6. the referenced package file exists in the offline source tree.

The current candidate fails at the generated data-URI assertion before any
artwork pixels or design are prescribed. The RED intentionally does not test
surface DOM, exact SVG contents, icon dimensions, or accessibility labels.

## Acceptance remaining after #190

- Replace the six canonical generated metadata values with stable packaged
  identity references, without changing IDs, associations, or app semantics.
- Keep the app and handler references coherent through canonical metadata.
- Ensure package output contains those referenced bytes and works offline.
- Let Start, Search, taskbar, Open With, Properties, and other consumers inherit
  identity via #190's shared seam; no local icon table may be added.
- Preserve deterministic shared fallback if a reference is absent or fails.
- Keep accessible labels/names sourced from semantic metadata, independently of
  decorative image pixels.
- Document asset provenance where required.

## Boundary

The source-level RED is **FULL/CORE RED**, not browser-blocked: current metadata
is provably wrong in Bun. The final offline installed URL/HTTP proof remains a
bounded **BROWSER/PACKAGE acceptance remainder**, because a source file and
static path cannot prove Neutron's installed application mount. Reuse #190's
minimal packaged asset gate; do not create a new visual screenshot suite.

No production code, artwork, IDs, association rules, or PR #211 files were
modified by this audit.
