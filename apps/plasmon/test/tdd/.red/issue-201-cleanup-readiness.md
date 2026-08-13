# Issue #201 cleanup / retirement readiness

Final inspected release: `f4ac3b4c9880da5c6ce3b344bde73acbed7179e3`.
This is an audit only. No production code is deleted or changed. Active PRs
#190, #191, #51, and #65 remain implementation ownership and are not consumed
as integrated replacements.

## Candidate inventory

| Candidate | Current file/symbol | Consumer evidence | Migration Issue | Integrated replacement? | Status | Safe action |
|---|---|---|---:|---|---|---|
| FileManager inline orchestration | `os/file-manager/FileManager.tsx` state/effects/callbacks | root component actively rendered | #195 | no | ACTIVE | wait #195 |
| FileEntry presentation seam | `FileEntry.tsx` | active FileManager consumer | #191/#190 | no | ACTIVE | wait active PRs |
| selected-label/rename CSS | `file-manager.scss`, FileEntry | active selected/rename behavior | #95/#191 | no | ACTIVE | preserve browser evidence |
| Desktop placement compatibility exports | `desktop/layout.ts`, Desktop callers/tests | imported by Desktop/FileManager/tests | #192 downstream | partial integrated controller | WAIT FOR #192 migration | inspect import graph, do not delete |
| `resourcePolicy.classifyResource` | `os/fs/resourcePolicy.ts` | many canonical consumers | #189 | yes, current authority | ACTIVE | never retire |
| Search `MEDIA_EXTENSIONS` | `os/shell/search.ts` | `categorizeNonApplicationFsNode` | #178/#193 | no | WAIT FOR #178 | migrate then remove only after tests |
| FileManager `IMAGE/VIDEO/SOURCE_EXTENSIONS` | `os/file-manager/file-icons.ts` | `resourceIconKind` | #178/#190/#196 | no | ACTIVE | visual support may remain |
| thumbnail MIME table | `os/file-manager/thumbnail.ts` | thumbnail resolver | #93/#190 | no | ACTIVE | browser decode policy distinct |
| Photos `EXTENSION_MIME` | `native-apps/photos/media.ts` | `inferImageMime`/associations | #178/#93 | no | WAIT FOR #178 | retain until consumer migration |
| Video `VIDEO_MIME` | `native-apps/video/media.ts` | video MIME helper | #94/#178 | no | WAIT FOR #94/#178 | retain actual decoder support |
| Text `LANGUAGE_BY_EXTENSION` | `native-apps/text/editorModel.ts` | TextEditor and tests | #178/#200 | no | WAIT FOR #178 | do not remove early |
| Shell Search state/JSX/effects | `os/shell/Shell.tsx` | active rendered surface | #193 | no | WAIT FOR #193 | delete after cutover only |
| Shell Start state/JSX/reconcile effect | `Shell.tsx` | active rendered surface | #169/#194 | no | WAIT FOR #169/#194 | preserve until migration |
| `deriveStartEntries` model | `os/shell/model.ts` | no current Shell JSX reference found | #194/#201 | unclear dynamic/legacy | UNKNOWN — INVESTIGATE | prove reachability before removal |
| Legacy gui2 Start/Search/catalog | `gui2/DesktopShell2.tsx`, `gui2/model.ts` | legacy entrypoint/reference tree | #25/#26 | no accepted retirement proof | ACTIVE legacy / WAIT | inspect build reachability |
| packaged `/static/plasmon/icons` allowances | E2E health specs | active smoke allowance | #190 | no, PR open | WAIT FOR #190 | remove only with strict rerun |
| shared Visual assets/primitives | `os/visual/*` | many consumers/tests | #190/#201 | yes | ACTIVE | never delete as “duplicate” |
| Neutron compatibility icon paths | `os/neutron/icon-resolver.ts` | installed Element resolver/tests | #171 | no | ACTIVE | dynamic runtime fallback; no text-count deletion |
| Monaco worker outputs/path | `build.ts`, `native-apps/packaging.ts` | package/build assertions | #89/#200 | no | WAIT FOR #89 | migrate package then retire old path |
| hypothetical `FileManager2`, `SearchPanel2`, `NativeWindow2`, `Visual2` | repository search | no source found | corresponding refactors | absent | PROVEN SUPERSEDED | no action |

## Import-boundary candidates

Recommend later low-noise restrictions after migrations, backed by actual imports:

- Search must not import a retired local classifier after #178/#193;
- Text/Markdown must not import retired extension-language tables after #178;
- future FileManager views must not import FsService internals directly when
  shared command contracts exist;
- no future Shell surface should import legacy `gui2`/`platform` modules.

Do not ban extension literals globally: association registrations, media decoder
support, package paths, and compatibility probes legitimately use them.

## Tool evaluation

| Tool/capability | False positives / risks | Dynamic import/runtime issue | Cost | Value |
|---|---|---|---|---|
| TypeScript `tsc -b` | reports type errors, not dead exports | cannot see runtime registration | already available | high for migration safety, not dead-code proof |
| ESLint `no-restricted-imports` | can overreach legacy/test boundaries | misses dynamic imports | already installed; low runtime cost | useful for known retired boundaries after proof |
| TypeScript compiler unused locals/exports | project config may not enable all checks; public/dynamic exports look live | misses string-based registration | low | targeted local checks only |
| `knip`/`ts-prune` | not installed; false positives for dynamic package/runtime exports, entry registries | high | dependency and config cost | reject for now |
| dependency-cruiser/madge | not installed; aliases/dynamic imports and generated package graph complicate | medium/high | dependency cost | reject until a concrete cycle boundary exists |
| coverage | cannot prove zero consumers/dead code | runtime paths may be untested | existing suite cost | supporting evidence only |

Conclusion: **reject decorative dead-code dependency now**. Use import search,
`tsc`, targeted ESLint restrictions, and composed tests only after each migration
proves replacement behavior and package reachability.

## Retirement protocol

A candidate becomes `PROVEN SUPERSEDED` only after: actual consumer graph is
inspected (including dynamic registration), replacement is integrated, focused
lower-layer/browser/package evidence passes, no legacy entrypoint uses it, and
retirement does not remove an accepted compatibility path. “One textual
reference” is not zero-consumer proof.
