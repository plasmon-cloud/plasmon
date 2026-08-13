# Issue #174 — FULL RED PACKET

Classification: **FULL RED PACKET**

## Ownership check

No active Luna-B packet or implementation PR was visible in the live GitHub
state at preparation time. PR #207 contains a related `system-app` Search change
on a different implementation branch, but it is not integrated into
`release/0.1.0-r2`; this packet remains the consumer contract and does not alter
that branch.

## Executable gate

`apps/plasmon/test/tdd/.red/issue-174.red.test.ts`

Focused command:

```sh
bun test ./apps/plasmon/test/tdd/.red/issue-174.red.test.ts
```

Current result: setup reaches `searchShell`; one `.sys` system application yields
two matching Search results (native app plus raw `Browser.sys` file), so the
intended duplicate assertion fails. This is a deterministic headless RED, not a
browser/runtime failure.

## Acceptance fence

- one canonical native application produces one visible Search result;
- raw `.sys` resources never enter Documents;
- display title may hide `.sys`, while canonical filesystem NodeId and resource
  name remain unchanged;
- hidden/system visibility follows filesystem policy;
- running state never changes classification;
- Search does not create a second app catalog;
- activation delegates to the canonical filesystem/open or native authority.

The packet deliberately does not redesign Search UI, ranking, limits, or Shell
React structure. #189 owns classification; #190 owns presentation; #193 owns
Search rendered-surface reconstruction. When #189 integrates, this gate should
consume its actual canonical `system-app` result rather than infer from MIME or
suffix locally.
