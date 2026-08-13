# #64 js-dos save API audit

Source/package inspection result: Plasmon pins js-dos 8.4.1 and calls `Dos()`
with `{ url, pathPrefix, workerThread, autoStart, autoSave: false, ... }`.
`JsDosPlayer` receives only a `JsDosPlayerHandle.stop(): Promise<void>` from the
current runtime adapter. No `ci.persist`, `fsChanges`, export, import, or
save-event method is exposed through `runtime.ts` or the host. The current host
therefore cannot truthfully capture progress; `autoSave:false` avoids claiming
browser-local persistence.

The upstream/js-dos API concepts referenced by the accepted Games architecture
are filesystem-change bundles (`fsChanges.pull/push/delete/urlToKey`) and
`ci.persist()`. Repository inspection found no js-dos package source or expanded
runtime bundle in the current checkout/node_modules, only the generated build
contract and the host adapter. A public Plasmon adapter does not expose these
methods. Exact invocation signatures and lifecycle timing must be verified by
the future owner against the shipped 8.4.1 archive, not inferred from daedalOS
docs.

Current lifecycle: read FsService bytes -> Blob URL -> load packaged Dos global
-> construct player -> `ci-ready`/`bnd-play` readiness -> stop on unmount ->
revoke bundle URL. Save API and restore timing are the exact missing seam.
