# r2 Luna ownership consistency

Post-merge refresh: 2026-08-14 against release `82f176a6`; no ownership changes were made by Luna-D.

## Canonical owners

- **A — Desktop/FileManager/Filesystem:** #44, #51, #65, #66, #86, #92–#95, #108–#110, #115, #171–#178, #182, #189–#196, #201.
- **B — Shell/Windowing/Process/taskbar:** #43, #61, #63, #72, #81, #87, #91, #109, #111, #117–#119, #177, #183, #197–#199.
- **C — Native Apps/Text/Markdown/Photos/media/games/browser runtime:** #58, #64, #67, #83, #89, #96, #112–#114, #121, #123–#124, #170, #179–#180, #200, #202.
- **Sharing/Backend/Coordinator — external cross-system ownership:** #38. C may consume Review/Sharing evidence but must not absorb provider/backend/MTN reconciliation.
- **D — Testing/cross-surface:** #25, #26, #46, #78–#82, #100, #107, #155/#167, #181, #186–#187. D audits but does not own domain implementation.

## Collisions

1. **#109:** appears in A's historical packet and B's shell seed. Canonical product owner is B (Shell presentation); A's map is dependency evidence only. Coordinator decision: consume B for unresolved acceptance, A only for Visual icon assertions.
2. **#177:** appears in A's future acceptance planning and B's native-window backlog. Canonical owner is B (WindowManager/window placement); A's document is dependency evidence.
3. **#190/#189:** A packet covers Visual/classifier boundary while C owns native app consumers. Canonical owners remain A for #189/#190; C owns #67/#200 runtime acceptance.
4. **#107/#167/#187:** historical domain packets and D testing ownership overlap. D is canonical for the integrated testing gate; domain packets are consumers, not competing owners.
5. **#186:** D/Testing Lead owns packaged persistence; no domain lane may replace the retained-profile proof.

## Post-merge ownership/status reconciliation

- #51/#65/#173/#189/#190/#191/#192 are merged and their RED/promotion evidence is now release-owned; no lane may reopen duplicate staging packets.
- #195 remains A-owned and has **no implementation** despite characterization guards; it is the next implementor packet after #191.
- #38 remains Sharing/Backend/Coordinator-owned; its Phase-A provider tests do not transfer ownership to C or D.
- #78/#82 remain A-facing queue items; #79/#83 are D cross-surface items; #81 remains B-owned. No competing packet was created.

No competing B or C packet commit was found on their published refs. Luna-A's packet tree is the only substantial staging tree; this is not permission to adopt every file (see invalid registry). Exactly one owner is recorded for every unresolved Issue in the master ledger.
