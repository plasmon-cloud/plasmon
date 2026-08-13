# Review durable model coverage map

| corpus behavior | current permanent test | gap |
|---|---|---|
| create Atom | engine semantic tests | none |
| reopen Atom | persistence restart test | installed IndexedDB rerun |
| Desired/Effort/Owner/Work | coordination test | no unit per enum needed; validation broad |
| Work/evidence/activity | coordination/evidence + comment engine path | packaged activity observation |
| one/multiple transactions | history length/sequence tests | none |
| logical revision vs physical writes | persistence stats test | none |
| independent actor evidence | coordination preserves evidence | none |
| restore old revision | whole-Atom restore test | none |
| restore keeps AtomId/new RevisionId | restore assertions | none |
| command replay/stale/concurrent | engine tests | none |
| corrupt/missing history | engine has `HISTORY_INCOMPLETE`; no test | **RED PROMOTION GAP**: inject incomplete checkpoint/journal |
| Markdown import/export | markdown tests | none at model layer |
| TODO import | parser test treats checkbox as non-evidence | none |
| empty Atom | create without items indirectly; no explicit assertion | add future deterministic characterization if owned |
| persistence recomposition | memory engine restart; e2e page reload | real installed browser |

No production edits. Missing history injection is a genuine deterministic test
opportunity but requires a deliberately corrupting persistence fixture; it is not
invented in this lane because it belongs Review test ownership.
