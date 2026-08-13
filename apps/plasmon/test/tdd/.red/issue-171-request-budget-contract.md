# Issue #171 request-budget contract

The deterministic resolver already proves the following policy:

- safe declared metadata is preferred;
- one declared path tries only its established safe origin forms;
- compatibility fallback is sequential, not concurrent;
- first success short-circuits later candidates;
- no-descriptor fallback is bounded to the current finite candidate set;
- unsafe metadata cannot become an arbitrary URL;
- missing icon resolves to `undefined` and caller fallback.

The installed browser complement should assert behavioral budgets:

| Case | Allowed behavior |
|---|---|
| declared icon | only accepted equivalent origin forms for declared path |
| declared icon succeeds | later candidates are not requested |
| declared icon missing | bounded sequential alternate forms only |
| no declaration | finite compatibility set, no concurrent fan-out |
| missing all | deterministic fallback, no retry storm |
| repeated render | no uncontrolled duplicate probes within one stable presentation |

Do not make Plasmon own Neutron package identity, fetch external artwork, or
assert a guessed URL merely because it is currently observed.
