# r2 legacy-removal boundary audit: #25 / #26

Snapshot: integrated `origin/release/0.1.0-r2` = `f4ac3b4c`; audit run after Luna-A/B/C refreshes. No production files were changed.

## #25 — gui2

| check | evidence | result |
|---|---|---|
| entrypoint | `apps/plasmon/src/index.tsx` imports/render `./os/PlasmonOS.tsx`; no `DesktopShell2` import | current boot does not select gui2 |
| active source import | recursive source search found no import of `src/gui2` outside gui2/docs | no active consumer observed |
| runtime/build reference | `apps/plasmon/build.ts` has only `src/index.tsx`, background, and Monaco worker entrypoints | no gui2 build entry |
| implementation presence | `src/gui2/DesktopShell2.tsx`, `desktop2.scss`, `model.ts`, README/AGENTS still exist | **acceptance fails: obsolete code remains** |
| tests/docs | `test/platform.test.ts` is legacy-platform, not gui2; GUI2 docs explicitly call it historical | no packaged boot proof was run |
| dynamic registration | no `gui2` registration/import discovered in source/build/package manifests | pass |
| safe-removal evidence | boot/import scan is sufficient to remove gui2 as a source cleanup, but a package build + packaged boot must follow | pending implementor |

**Truthful disposition:** `VERIFIED CORE RED / INCOMPLETE ACCEPTANCE` (RED test staged below). The absence of active imports is already green, but the Issue explicitly requires removal, build/tests, and packaged/manual boot. Do not port GUI2 behavior or delete it from this TDD branch.

## #26 — platform

| file/consumer | evidence | disposition |
|---|---|---|
| `src/platform/index.ts`, `mock.ts`, `neutron.ts`, `types.ts`, `parse.ts` | legacy abstraction remains | removal target, not accepted source of truth |
| `src/DesktopShell.tsx` | imports `createPlatform`, `PlasmonApp`, `PlatformMode`, `PlatformSnapshot`; imports `InstallDialog` | dead/unreferenced legacy shell consumer; must migrate/remove with the shell |
| `src/components/AppCard.tsx` | imports `PlasmonApp` type from platform | dead legacy component consumer |
| `src/components/InstallDialog.tsx` | imports `normalizePackageUrl` from platform parser | dead legacy component consumer unless separately adopted by current OS |
| `src/os/integration/legacyNeutronBridge.ts` | imports `createPlatform`, `PlasmonApp`, `PlasmonPlatform` | transitional adapter; no current import consumer found, but source still duplicates bridge behavior |
| `src/gui2/DesktopShell2.tsx` | imports platform and uses `createPlatform()` | historical consumer; removed with #25, not migrated into OS |
| `test/platform.test.ts` | directly tests legacy parser | test-only dependency; should move only the still-useful URL/parser contract to canonical Neutron tools or retire it |
| current `src/index.tsx` / `src/os/**` | no platform imports in the current boot graph | current runtime does not need platform |

**Truthful disposition:** `VERIFIED CORE RED / INCOMPLETE ACCEPTANCE`. #26 is not already green: a static search still finds several source/test imports and the compatibility layer remains. Build-metafile proof that the current bundle excludes these files is useful but cannot satisfy dead-file removal. Split any required parser migration into a separate Issue rather than broadening #26.

## RED gate

`apps/plasmon/test/tdd/.red/issue-25-26.red.test.ts` asserts: no legacy directories, no source consumers, current `src/os/PlasmonOS.tsx` boot, and no legacy build entry. It is intentionally RED against the current release because the directories/source consumers remain. It is not a product implementation.
