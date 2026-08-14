# Luna-B criterion-level dispositions

This supplements the issue inventory with explicit authority → observable → layer → evidence mapping for packets without a separate acceptance file.

## #61 — Shell overlay controller

| canonical criterion | authority / observable | layer | evidence / disposition |
|---|---|---|---|
| deterministic overlay state below React | Shell interaction policy; open/switch/dismiss state transitions | Bun model | `shouldDismissShellFlyout`, context policy tests characterize behavior; no controller exists |
| adapters use same transitions | Shell event adapter yields same visible flyout state | RTL | existing Start open/Escape RTL; full adapter extraction is future |
| click-away/keyboard/focus | browser event delivery | RTL/browser | click-away helper and Start Escape exist; global keyboard browser proof incomplete |
| opening remains external | dispatcher/Process/Neutron | headless composition | #32 and current callbacks prove delegation |
| no parallel state machine | architecture/source | static audit only | source-shape RED prohibited; **CHARACTERIZATION** — current React orchestration is characterized and the operational claim is released, but controller extraction remains implementation architecture work |

## #63 — Alt-Tab

| criterion | authority / observable | layer | evidence / disposition |
|---|---|---|---|
| canonical MRU cycle | WindowManager `focusSnapshot` | Bun + RTL | #62 MRU green; `issue-63.red.ui.test.tsx` fails to change focus |
| selected focus through manager | WindowManager | headless/RTL | no Shell adapter; RED |
| minimized restore | WindowManager.focus | Bun | manager test green; no Alt-Tab consumer |
| closed exclusion | manager snapshot pruning | Bun | #62 manager behavior green; no consumer |
| deterministic commit/cancel | future Shell controller | Bun | no current API; incomplete |
| actual keyboard boundary | browser global key | RTL/Playwright | RTL red is not final real-browser proof; browser follow-up |

## #72 — taskbar state (ALREADY GREEN)

Process identity, window identity, app identity, pin identity, pinned-only/running/active/launching/unknown and native focus/minimize actions are all directly covered by current production model tests. The taskbar buttons use `data-task-state`, accessible labels, and shared icon presentation; raw `yes/no/unknown` is not rendered in taskbar buttons. #187 smoke adds one composed native lifecycle. Complete #72 acceptance is therefore green; grouping (#118), context Close/alignment (#183), and tray/Search wording are separate issues.

## #87 — Start System retirement (ALREADY GREEN)

`reconcileStartMenu` and `gate3` prove fresh top-level native shortcuts, no managed `System` folder, idempotent reconciliation, user rename/move preservation, intentional deletion preservation, and user-created folder safety. Filesystem `/System` remains distinct. No new B RED is honest.

## #91 — Search cap/safety

`searchShell` is canonical authority. The refreshed deterministic gate creates ordinary category overflow and combined presentation overflow, proves the configured category/total bounds remain enforced, and fails because `batch.truncated` is `true` in both ordinary-cap cases. The traversal case remains green with `batch.truncated === true`. Exact current result: **2 failures, 1 pass, 9 assertions** from `bun test ./apps/plasmon/test/tdd/.red/issue-91.red.test.ts`. The implementation must expose a model distinction without requiring one representation: ordinary cap metadata may be separate, but only genuine filesystem incomplete/safety state may drive technical warning presentation. Latest-result/cancellation behavior is out of scope and must remain intact.

## #109 — pin presentation (ALREADY GREEN)

`PinIcon` is shared by Start and Shell context actions; `data-pin-state`, `is-pinned`, state marker, `Pin to taskbar`/`Unpin from taskbar`, and filesystem-backed preferences are covered by current Visual/Shell tests. No process authority is changed. Complete acceptance is green; packaged/manual platform rendering remains appearance review, not a missing semantic gate.

## #111 — visual convergence

The shared Visual tokens/primitives are consumed for pin and resource/application icons. Current r2 includes merged #190 resource-presentation work (PR #211, merge commit `c982d53`). Shell still owns inline marks and surface-local palette decisions; the token map classifies each as duplicate/local/unknown. Because #111 requires appearance and no broad visual redesign, this is **CHARACTERIZATION**, not a brittle CSS/source RED. Manual/package visual review remains missing; the operational claim is released.

## #115 — shared command vocabulary

Shell consumers and authority/outcome vocabulary are recorded in the command matrix. Existing Open/Trash/shortcut foundations are green; command-layer convergence itself is structural unless an externally observable divergent outcome is reproduced. **CHARACTERIZATION READY — NO HONEST STRUCTURAL RED**, Lane-A packet ownership respected.

## #119 — transient/dialog ownership

Process close negotiation is real and tested, but no accepted product surface currently qualifies as a native transient with parent identity. Existing overlays remain app-local. **CHARACTERIZATION**: preserve app-local overlays; do not create a fake owner API or RED for unspecified semantics. Implement only after a demonstrated true transient supplies the contract; the operational claim is released.
