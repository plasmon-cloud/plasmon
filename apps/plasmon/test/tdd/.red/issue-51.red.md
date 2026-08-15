# Issue #51 — repaired packet

Disposition: **GREEN IN R2 — RED CONSUMED**.

PR #210 merged at `f3459881bbb1fb151ea71b17d7c0f8bb83f8a9c7` and the current
release contains the ordinary RTL regression at
`apps/plasmon/test/rtl/issue-51-send-to-desktop.test.tsx`.

## Promoted evidence

- The former `issue-51.red.ui.test.tsx` RED is now green through the merged
  FileManager Send to Desktop command.
- `issue-51.red.test.ts` adds production-backed headless protection around the
  real `createFileManagerShortcut` consumer primitive: canonical NodeId target,
  unchanged original parent/identity, collision-safe repeated creation, normal
  shortcut rename, missing target/destination errors, and no partial shortcut.

The lower test intentionally tests the existing primitive-backed consumer helper
and the promoted RTL journey now passes. The canonical helper and NodeId
protection remain the permanent lower-layer fence.

## Preserve

#44's shortcut serializer/primitive, FsService target identity and collision
naming remain authoritative. The original resource is never moved or copied.

## Promotion result

The production Desktop destination command now resolves `/Desktop`, checks one
eligible selection, delegates to the canonical helper, surfaces
unavailable/ineligible errors, and preserves normal selection/rename behavior
for the created shortcut. No generic command framework is required by this
packet.
