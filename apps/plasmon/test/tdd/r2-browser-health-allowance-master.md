# r2 browser-health allowance master ledger

Authority: `test/e2e/plasmon-browser-health.ts` and integrated `apps/plasmon/test/REFACTOR_GUARDS.md`. The harness is fatal by default; every allowance is narrow and retains evidence.

| exact allowance/pattern | Issue / surface | originating evidence | retirement gate | state |
|---|---|---|---|---|
| `console.warn` sandbox message: iframe has `allow-scripts` and `allow-same-origin`, `/chunks/` | Kernel-installed app iframe; #187 smoke | #187 hosted smoke | Kernel/packaged baseline owner, not #191 | still needed; unrelated to FileEntry |
| `requestfailed` `net::ERR_BLOCKED_BY_ORB`, `/static/plasmon/icons/` | historical Plasmon-owned icon URL defect; #190 | #187/#190 smoke; merged #211 focused asset spec proves required mount responses | remove only after post-merge smoke proves no old-root requests | **retirement pending; current smoke still allowlists it** |
| `requestfailed` `net::ERR_ABORTED`, `/static/plasmon/icons/` | historical same #190 path consequence | #187/#191 baseline; merged #211 | remove with old-root ORB rule after post-merge verification | **retirement pending; current smoke still allowlists it** |
| Search popup small right-edge overflow | #175/#193 Search geometry | #187 smoke | #175 exact geometry gate; retire only this geometry allowance | still needed |
| Monaco worker/sandbox diagnostic | #67/#200 | #187 smoke docs | #67/#89/#200 specialist worker-ready proof | still needed |
| js-dos storage bootstrap diagnostic | #202 | #187 smoke docs | #202 real sandbox storage proof | still needed |

Rules verified: #190 may retire only its icon allowances; it must not require #202, #67, or Kernel iframe warnings to disappear. #191 reuses the baseline but does not own or remove #190 rules. The focused #190 spec is green in merged PR CI, but the integrated smoke still carries the old-root allowances, so retirement is not yet evidenced. No broad allow pattern or accidental expansion was found. Current state remains **owner diagnostics active**, not a green closure certificate.
