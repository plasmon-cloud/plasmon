# Review agent instructions

Review is a standalone vanilla-Neutron application. Read `README.md` and the accepted Plasmon Atom documents under `apps/plasmon/docs/atoms/` before changing Atom identity, revision, history, or portability semantics.

Preserve these invariants:

- `AtomId` is logical resource identity and is not AppScope, process/window/tile, filesystem path, or RevisionId.
- Review owns Review-domain semantics; do not push them into generic Plasmon/Neutron contracts from this package.
- MVP has no Plasmon or MTN dependency and no Yjs/CRDT/offline branch/merge machinery.
- one accepted semantic transaction -> one logical `RevisionId`;
- logical revisions do not prescribe physical snapshot/content-addressed/chunk encodings;
- ordinary small mutations must remain implementable as changed normalized records + small journal bookkeeping;
- human/test evidence is independent from coordinator/work metadata;
- whole-Atom restore creates a new current logical revision and preserves prior history;
- Markdown/TODO is portability/provenance, not canonical Atom identity/state.

Keep deterministic semantics in `engine.ts`/ports and test them without React. Use package/browser tests only for real Neutron package, persistence, Files, and launch boundaries.
