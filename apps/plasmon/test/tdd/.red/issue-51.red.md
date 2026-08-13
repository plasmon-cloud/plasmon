# Issue #51 — repaired packet

Disposition: **VERIFIED CORE RED / INCOMPLETE ACCEPTANCE**.

## Executable evidence

- `issue-51.red.ui.test.tsx` remains the intentional RTL RED for the missing
  production `Send to Desktop` consumer command.
- `issue-51.red.test.ts` adds production-backed headless protection around the
  real `createFileManagerShortcut` consumer primitive: canonical NodeId target,
  unchanged original parent/identity, collision-safe repeated creation, normal
  shortcut rename, missing target/destination errors, and no partial shortcut.

The lower test intentionally tests the existing primitive-backed consumer helper
and does not pretend it proves the missing Desktop command. #51 remains RED
until FileManager exposes the destination command and the RTL journey passes.

## Preserve

#44's shortcut serializer/primitive, FsService target identity and collision
naming remain authoritative. The original resource is never moved or copied.

## Remaining criterion

The missing production Desktop destination command must resolve `/Desktop`,
check one eligible selection, delegate to the canonical helper, surface
unavailable/ineligible errors, and preserve normal selection/rename behavior for
the created shortcut. No generic command framework is required by this packet.
