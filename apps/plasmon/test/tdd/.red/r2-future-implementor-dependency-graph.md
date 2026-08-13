# r2 future implementor dependency graph

Finish refresh: release `f4ac3b4` first-parent history confirms #189, #192, #170,
#186 integrated. Open implementation ownership is #190/#211, #191/#204,
#51/#210, #65/#208. Today's unattended queue also owns #169/#176/#66/#86/#174/
#173/#182/#95. Those are dependencies only here; Luna did not modify their
packets or branches.

| Edge | Type | Truthful reason |
|---|---|---|
| #189 -> #178 | HARD / ACCEPTANCE | #178 must consume integrated canonical classification/type vocabulary |
| #174 -> #193 | HARD / ACCEPTANCE | Search uniqueness/source projection waits for accepted `.sys` policy |
| #190 -> #193 | HARD / ACCEPTANCE | Search surface consumes shared Visual/presentation asset identity |
| #175 -> #193 | HARD / ACCEPTANCE | stable geometry is independent behavior but #193 must preserve accepted frame |
| #189 -> #193 | HARD / TEST | Search categories/result metadata consume classifier |
| #169 -> #194 | HARD / ACCEPTANCE | Start surface needs accepted reconciliation/boot boundary |
| #189/#190 -> #194 | SOFT / PRESENTATION | Start may consume shared type/presentation, not root authority |
| #193 + #194 + #176 -> #197 | SOFT / ARCHITECTURAL | Shell decomposition can begin with independent inventory; final cutover needs surface/controller boundaries and context ownership |
| #190 + #176 -> #198 | SOFT / PRESENTATION | taskbar shared presentation and context policy must be accepted; projection model can start independently |
| #177 -> #199 | ACCEPTANCE | default placement must remain WindowManager-owned |
| #43 -> #199 | ACCEPTANCE | snap/adapter pointer contract constrains refactor |
| #89 -> #200 | HARD / PACKAGE | host consumes canonical worker asset root |
| #67 -> #200 | ACCEPTANCE | packaged worker/editor boundary already has specialist lane |
| #178/#189 -> #200 | SOFT / LANGUAGE | host consumes canonical language input, no global table |
| #191 -> #195 | HARD / ACCEPTANCE | final FileManager extraction must inspect surviving FileEntry seam |
| #195 -> #196 | HARD / ARCHITECTURAL | view strategies share the decomposition/command seam |
| #173 -> #196 | ACCEPTANCE / TEST | List strategy must consume accepted spatial/compact behavior |
| completed migrations -> #201 | CLEANUP | retire only after replacement integration and evidence |
| #65 -> #92 | HARD / TEST | #92 must reuse accepted FileOperationState vocabulary; #65 is active/open |

## Independence

- #178 can be finalized after #189 (integrated) without waiting for #174/#190;
  current ordinary derivation API remains a staging limitation.
- #175 geometry can be specified independently and is ready for browser execution,
  while #193 final source model waits for #174/#190.
- #197 inventory/transient characterization can proceed now; final cutover waits
  for #193/#194 and #176 ownership seam only where actually needed.
- #198 pure taskbar projection truth table can proceed now; grouping and menu
  acceptance are #118/#183-specific.
- #199 manager/adapter characterization can proceed now; #177/#43 browser
  acceptance remain separate.
- #200 document authority/duplication audit can proceed now; final host depends
  on #89 package path and #67 browser evidence.
- #195/#196 are explicitly not ready for final RED while #191 is open.

## Negative dependency rules

Issue mention or shared files do not create a hard edge. #190 does not block
pure Process/Window projection; #173 does not block FileManager command
characterization; #176 does not authorize a Luna global context interceptor.
