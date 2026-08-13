# Native-app test quality audit v2

| test family | finding | action |
|---|---|---|
| DocumentSession tests | real small FS test doubles are used for session authority | retain; lower-layer semantics are appropriate |
| DocumentCloseModel tests | fake close session is a true model boundary | retain; #79 must compose real production |
| Monaco adapter tests | fake model proves ownership only | retain; never call Worker proof |
| Monaco packaged e2e | visible ready + edit/save/reopen; health exceptions | strengthen with Worker handshake; do not delete |
| Photos/video helpers | deterministic policy/object URL leases | retain; browser decode/fullscreen separate |
| js-dos tests | associations/Keyboard Lock helper | retain; canvas/storage/save require browser/runtime |
| EmulatorJS tests | ROM/config/association | retain; e2e real child runtime |
| package tests | package bytes/graph | retain for package contract, not runtime readiness |
| Review engine tests | real domain engine + memory port | retain; installed package separate |
| Review e2e | semantic package journey | retain; visual/manual and current install rerun |
| RTL current | production renderPlasmon composition | strengthen app-specific controls where Issue requires |
| source/CSS assertions | package structural/docs checks exist | retain only where package contract; reject as UX proof |
| arbitrary sleeps | existing e2e bounded waits/timeout checks | avoid adding sleeps; use state/readiness |
| swallowed exceptions | emulator stop cleanup catches teardown by design | retain but strict health must catch startup errors |
| canvas/ready markers | runtime specs use real callbacks; jsdos data marker | marker is phase only; do not call health/save proof |
| direct component mounts | helper/unit tests only | reject as canonical open proof |

No active implementor test was modified. Future gates must cite production
composition and distinguish package structure, browser health, and visual review.
