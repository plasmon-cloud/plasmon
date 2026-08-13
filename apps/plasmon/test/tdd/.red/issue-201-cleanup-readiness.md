# Issue #201 cleanup readiness — refreshed after #192 integration

Integrated release inspected: `51cd761c207573a59197d53c9e2884335f2e7cc7`.

Audit only. Luna-A deletes nothing.

| Candidate | Current evidence | Classification |
|---|---|---|
| FileManager inline selection/rename/context/drag/render orchestration | active release consumer | STILL CONSUMED; wait for #195 |
| FileEntry local presentation/type mapping | active release consumer; #191 PR still not integrated | WAIT FOR #191 / #190 |
| FileEntry selected-label/rename CSS | active #95/#191 behavior | STILL CONSUMED |
| Desktop pre-controller placement helpers | integrated #192 release code still exposes compatibility/adapter paths as active consumers; inspect after downstream migration | STILL CONSUMED / #192 migration follow-up |
| Desktop old placement exports | integrated release retains compatibility exports for callers/tests | STILL CONSUMED; do not retire from PR history alone |
| resourcePolicy semantic classification | active canonical authority | STILL CONSUMED; wait for #189 richer seam |
| Search MIME/media/category tables | active release consumer | WAIT FOR #189 |
| Photos extension MIME helper | active consumer and #178 dependency | WAIT FOR #178/#189 |
| Text editor extension-language helper | active consumer; accepted #189 branch has migration but release does not | WAIT FOR #189 |
| Shell Search JSX/state/effects | active release consumer | WAIT FOR #193 |
| Shell Start JSX/reconciliation lifecycle | active release consumer | WAIT FOR #169/#194 |
| Explorer hard-coded Favorites paths | active release consumer and #182 defect | WAIT FOR #182 |
| `.fm-entry__thumbnail` legacy `cover` selector | current source selector; runtime uses shared thumbnail path but zero-consumer proof is not staged | UNKNOWN |
| `/static/plasmon/icons` health allowances | active #187 smoke allowance | WAIT FOR #190; remove only after gate passes |
| Visual shared primitives/assets | active shared authority | STILL CONSUMED |
| Neutron icon resolver compatibility candidates | active tested installed-Element authority | STILL CONSUMED; wait for #171 browser evidence |
| hypothetical `FileManager2`/`SearchPanel2`/`Visual2` | absent from integrated source | PROVEN SUPERSEDED / NOT PRESENT |

## Retirement rule

#192 integration removes the prior placement defect but does not prove every
compatibility helper is zero-consumer. Retire candidates only after actual
imports/consumers, accepted replacement tests, and package/browser evidence are
inspected on the integrated head. No line-count or PR-history inference is
sufficient.
