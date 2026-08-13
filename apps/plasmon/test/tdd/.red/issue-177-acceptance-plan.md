# Issue #177 — default placement future acceptance plan

Status: **CHARACTERIZATION READY / VERIFIED MANAGER BOUNDARY**. #177 has no
active PR. Current manager constrains every create to a viewport and uses a
created-count cascade; the future RED must target any remaining repeated-open
stranding with real scenarios, not a hardcoded offset.

## Deterministic cases

Using real `NativeWindowManager` and a supplied viewport, assert for repeated
create/close/open:

- every geometry is constrained to viewport reachable titlebar bounds;
- titlebar and controls remain reachable by the manager's contract;
- cascade progression wraps/reuses bounded positions when space is exhausted;
- small/narrow/short viewports remain valid under min dimensions;
- closing/reopening does not grow an unbounded coordinate counter;
- deliberate initial/user moves remain preserved until a new default is created;
- taskbar/workspace inset is represented by the manager viewport, not Shell.

Current code inspection shows `createdCount` monotonically increases even after
close. Whether that violates accepted #177 depends on actual constraints and
viewport size; write the intentional failing assertion only after reproducing a
stranded sequence with accepted bounds. Do not assert “x equals 64 + n*28”.

## Browser complement

Open repeated real native windows through the packaged path, measure window and
close/titlebar rectangles, and assert viewport containment/reachability. This is
focused geometry only; manager semantics remain Bun.
