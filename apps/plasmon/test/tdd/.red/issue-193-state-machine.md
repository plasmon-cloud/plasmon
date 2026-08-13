# Issue #193 — Search state machine preparation

The current Shell state is observed as `flyout`, `searchQuery`, `searchTab`,
`searchBatch`, `searchBusy`, `searchError`, `busyId`, an AbortController and a
LatestSearchController. This table describes observable transitions without
requiring a future module/component.

| Current | Event | Guard | Next observable state | Side effect/authority |
|---|---|---|---|---|
| closed | open Search | none | loading or ready with prior/empty query per accepted policy | Shell flyout coordination; search source begins |
| open/loading | query changed | latest request wins | loading | Abort prior request; Search projection |
| loading | result resolves current | sequence current | populated/empty + warnings/truncated | commit only current batch |
| loading | result resolves stale | sequence changed | unchanged | discard |
| loading | request fails current | not AbortError | error | visible alert; no fake result |
| any open | category changed | valid tab | same frame, filtered state | pure category filter; no new source query |
| populated | pointer activate | result exists | activating | canonical Open/Process/Neutron/filesystem authority |
| populated | Enter focused result | result focus exists | activating | same as pointer activation |
| activating | success | command resolves | closed or accepted retained state | canonical authority owns lifecycle |
| activating | failure | command rejects | visible action error, Search remains/closed per existing policy | no guessed fallback |
| any open | Escape | no higher-priority editor owns event | closed | shell transient controller |
| any open | outside pointer | target foreign to surface | closed | document adapter only |
| closed | filesystem invalidation | none | closed | no visible work; next Search uses fresh source |
| open | filesystem invalidation | Search open | loading/current query refresh | FsEventSource + source projection |
| open | Start toggle | taskbar policy | Search closed, Start open | Shell one-flyout invariant |

## Characterization gates to prepare

1. Real headless `searchShell` cancellation and latest-request behavior (already
   covered in `search.test.ts`; preserve exact result semantics).
2. RTL Search journey: open, query, category switch, zero results, result focus,
   Enter, Escape, click-away, activation error.
3. Composed Search/Start exclusivity and taskbar toggle.
4. Future source-uniqueness fixture below, after #174/#190 integrate.
5. #175 browser geometry protocol, separate from deterministic state.

No test should inspect `Shell.tsx` line count, component names, state hook count,
or exact CSS declaration. Those are migration details, not behavior.
