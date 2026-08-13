# r2 RED packet inventory v2

Audited all packet-bearing paths on the latest published A/B/C refs after the checkpoint. Exact manifest command:

```sh
for ref in origin/tdd/r2/luna-a-desktop origin/tdd/r2/luna-b-shell origin/tdd/r2/luna-c-apps; do
  git ls-tree -r --name-only "$ref" | grep -E '(^|/)\.red/|\.red\.(test|ui|spec)|\.red\.md$'
done
```

Result: **148 packet/artifact files** (A 139, B 8, C 1), covering **44 issue IDs**. The artifact tree contains both executable gates and non-executable characterization/authority/readiness documents; `.red` is never treated as permanent release discovery.

## Issue-group disposition

| issue IDs | packet shape found | independent disposition |
|---|---|---|
| #43, #177 | Windowing/browser pointer or repeated placement contracts; B has executable #177, A has pointer contract | lower manager guards are useful; browser pointer continuity remains BROWSER SPEC ONLY; no stale implementation claim |
| #44, #108, #110, #115 | closure/audit/docs plus A gates | #44/#110 promoted/core green; #108 lower model green but packaged Back proof missing; #115 characterization/authority docs, no structural RED |
| #51, #65 | executable A primitive/UI gates | final A packet is strong; active PRs #210/#208 adopted weaker UI slices; **STALE PACKET PROMOTED / PARTIAL RED PROMOTION GAP** |
| #52, #189 | presentation/classifier matrices and #189 executable gate | #189 promoted by PR207; #52 waits #190 installed presentation promotion |
| #63, #91 | B executable RTL/headless gates | valid core REDs; no implementation PR; permanent destinations named in B ledger |
| #66, #86, #93, #94, #95, #171, #173, #175, #176 | browser specs/geometry or authority docs | browser-only where real geometry/media/event loading matters; #94 has a genuine missing thumbnail production seam; no parse/list success counted |
| #92 | operation model/consumption docs | intentionally waits #65; no speculative second state model |
| #109, #118 | presentation map/truth table | #109 green; #118 valid headless RED with B destination |
| #172, #174 | composed/headless gates and closure docs | #172 valid only after integrated #192; #174 is a valid core gate but not promoted |
| #178 | authority/precedence/consumer/closure docs | classifier contract promoted through #189; old cast gate quarantined |
| #182 | executable core + RTL packet | **INVALID** test-local Favorites policy; do not consume |
| #183, #184, #185 | B executable UI/headless gates | valid core REDs awaiting implementations; no active PR |
| #186 | reconciliation doc only | permanent packaged persistence exists in PR209/release; stale `.red` recon is evidence, not a gate |
| #190, #191 | A executable deterministic/browser gates | active implementation fences; PR #211/#204 branches are destinations but not integrated |
| #192, #195 | A executable headless/structural behavior gates | #192 promoted via PR205; #195 valid characterization/future decomposition gate |
| #193, #194, #196, #201 | readiness/state/cleanup docs | future architecture packets, not RED; dependencies and permanent destinations are documented |
| #67 | Monaco browser contract doc | packaged browser boundary; no headless substitute |
| #25/#26 | Luna-D `.red/issue-25-26.red.test.ts` | valid source/build cleanup RED; current release fails removal criteria |
| #179 | C executable document-state RED | valid core RED; C owns promotion |

## Non-issue artifact classes

The remaining files are authority maps, preservation matrices, failure-state matrices, consumer maps, browser-health allowance maps, dependency graphs, duplication audits, readiness/state-machine docs, and packet-quality audits. They do not assert a product RED and must not be promoted merely because they reside under `.red`. They are retained as implementor evidence and indexed by the A/B/C quality ledgers.

## Invalid registry cross-check

The v2 tree contains the known invalid classes: old #182 policy packet, old #178 cast/API shape, old #66 source/CSS stacking shape, superseded #191 implementation-coupled guards, stale #190 health baselines, conditional #175 overflow assertions, speculative #92 model, and fake #94 video-decoder proposals. `r2-invalid-packet-registry.md` plus `luna-a-invalid-superseded-packets.md` are the quarantine authorities. No B/C invalid packet beyond the listed issue groups was found.

## Permanent destination rule

For every executable row above, the promotion ledger must identify an ordinary `src/**.test.*`, `apps/plasmon/test/**`, or repository `test/e2e/**` destination. If no implementation exists, the row remains waiting; it is not green because a `.red` test parses. This inventory found no valid executable RED with an unknown owner: the unresolved ownership assignments are #78/#82→A, #79/#83/#89→C, #81→B, #25/#26/#46/#100/#107→D, and #38→Sharing/Backend Agent 9.
