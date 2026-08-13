# #100 release dependency metadata audit

Snapshot: live GraphQL query 2026-08-13 against `plasmon-cloud/plasmon`; no GitHub metadata was mutated by Luna-D.

## Mechanical query result

GraphQL `Issue.blockedBy` / `Issue.blocking` over all open repository Issues returned exactly one native relationship:

| dependent | blocked by | state | interpretation |
|---|---|---|---|
| #90 | #49 | #90 open, #49 closed | stale native dependency; #90 should be re-evaluated, not treated as blocked |

The REST `/issues/<n>/dependencies` route is unavailable (404), but the GraphQL schema exposes `addBlockedBy` and `removeBlockedBy` mutations. Therefore this is not a missing API capability; it is an unperformed metadata migration and a Coordinator-authority task.

## Current exceptional `blocked` labels

Live label query found: #38, #78, #81, #83, #124, #125, #127, and unrelated Kernel #56. The label is justified only for:

- #38: stale Sharing source/reconciliation plus backend/package/documentation acceptance and Agent 9 ownership;
- #124: dependency on the not-yet-defined #64 save representation;
- #125/#127: deliberate MTN/live-sharing release boundary;
- #56: unrelated Kernel CI issue.

For #78/#81/#83 the only stated prerequisites are canonical Issues (#31/#44/#51, #72, #48), so the generic label should become native dependencies once the Coordinator confirms direction. #78 additionally waits on active #51; #81 waits on #72 (already implemented); #83 waits on #48 (still open). #100 itself is not an implementation dependency.

## Stale prose relationships

The Issue #100 body lists #42<-#41, #61<-#32, #63<-#62, #67<-#33, #70<-#31/#32, #77<-#40/#45, #78<-#31/#44/#51, #79<-#41/#42, #81<-#72, #82<-#57, #83<-#48, #87<-#32, #88<-#32, #89<-#57, #90<-#49. Current state requires:

- #41/#42/#62/#31/#32/#40/#57/#49 are closed; these must not leave dependents falsely ineligible.
- #45 and #48 remain open; #77 is closed and #83 genuinely waits on #48.
- #51 is active implementation; #78 must remain waiting until its accepted consumer is integrated.
- #72 is implemented but open; #81 can be queued after coordinator accepts its promotion evidence.
- #82 is deterministic and should be A-owned, not blocked on an old #57 implementation Issue unless a specific missing contract remains.
- #89's #57 prerequisite is closed; its actual remaining dependency is #67/#200 packaged Monaco path coordination, not a blocked label.

## Corrective action / disposition

**CHARACTERIZATION READY — METADATA AUDIT COMPLETE; COORDINATOR MUTATION REQUIRED.** The audit has a deterministic evidence destination (this document plus a repeatable GraphQL query), but cannot claim the Issue complete until native relationships/labels/prose are actually reconciled by the authorized Coordinator. No production or Issue state was changed. Queue #100 remains claimed by Luna-D until Coordinator applies and verifies metadata changes.
