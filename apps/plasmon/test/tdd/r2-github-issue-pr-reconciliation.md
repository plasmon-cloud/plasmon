# r2 GitHub Issue/PR reconciliation

Snapshot: 2026-08-14, live GitHub API; release target `origin/release/0.1.0-r2` = `82f176a6f11a163197a270a6c2275dde0f95a2e9`. Post-merge PR ancestry was refreshed live; all tracked Issues remain open unless explicitly noted. “Merged” below means the PR merge commit is an ancestor of the observed release, verified with `git merge-base --is-ancestor` / release log; it does not mean acceptance is complete.

## Direct implementation state

| Issue | PR(s) found | state / release relation | reconciliation flag |
|---|---|---|---|
| #25 | #142 | merged, ancestor | OPEN BUT IMPLEMENTED; closure acceptance not checked |
| #26 | none | no implementation | NO IMPLEMENTATION |
| #38 | #39, #104, #160 | merged, ancestor | OPEN BUT IMPLEMENTED; blocked label remains |
| #43 | #75 | merged, ancestor | OPEN BUT IMPLEMENTED |
| #44 | #149 | merged, ancestor | OPEN BUT IMPLEMENTED |
| #46 | #84, #104, #163 | merged, ancestor | OPEN BUT IMPLEMENTED; capability boundary remains |
| #51 | #210 | merged `f3459881` ancestor | OPEN BUT IMPLEMENTED; promotion accepted and release-owned |
| #58 | #101, #104 | merged, ancestor | OPEN BUT IMPLEMENTED |
| #61 | none | no implementation | NO IMPLEMENTATION |
| #63 | none | no implementation | NO IMPLEMENTATION |
| #64 | #103 | merged, ancestor | OPEN BUT IMPLEMENTED |
| #65 | #208 | merged `2b6984e9` ancestor | OPEN BUT IMPLEMENTED; promotion accepted and release-owned |
| #66 | none | no implementation | NO IMPLEMENTATION |
| #67 | #131, #188 | merged, ancestor | OPEN BUT IMPLEMENTED; packaged evidence remains |
| #72 | #139 | merged, ancestor | OPEN BUT IMPLEMENTED |
| #78 | none | no implementation | NO IMPLEMENTATION; blocked label |
| #79 | none | no implementation | NO IMPLEMENTATION |
| #81 | none | no implementation | NO IMPLEMENTATION; blocked label |
| #82 | #133 | merged, ancestor | OPEN BUT IMPLEMENTED |
| #83 | none | no implementation | NO IMPLEMENTATION; blocked label |
| #86 | none | no implementation | NO IMPLEMENTATION |
| #87 | #148 | merged, ancestor | OPEN BUT IMPLEMENTED |
| #89 | #131 | merged, ancestor | OPEN BUT IMPLEMENTED; packaged worker proof remains |
| #91 | none | no implementation | NO IMPLEMENTATION |
| #92 | none | no implementation | NO IMPLEMENTATION |
| #93 | none | no implementation | NO IMPLEMENTATION |
| #94 | none | no implementation | NO IMPLEMENTATION |
| #95 | #159 | merged, ancestor | OPEN BUT IMPLEMENTED |
| #96 | none | no implementation | NO IMPLEMENTATION |
| #100 | none | no implementation | NO IMPLEMENTATION |
| #107 | #152 | merged, ancestor | OPEN BUT IMPLEMENTED; needs verification label |
| #109 | #150 | merged, ancestor | OPEN BUT IMPLEMENTED; needs verification label |
| #110 | #151 | merged, ancestor | OPEN BUT IMPLEMENTED; needs verification label |
| #111 | #150 | merged, ancestor | OPEN BUT IMPLEMENTED; broader target not proven |
| #112 | none | no implementation | NO IMPLEMENTATION |
| #113 | #131 | merged, ancestor | OPEN BUT IMPLEMENTED; browser parity remains |
| #114 | #131 | merged, ancestor | OPEN BUT IMPLEMENTED; command acceptance remains |
| #115 | none | no implementation | NO IMPLEMENTATION |
| #117 | #146 | merged, ancestor | OPEN BUT IMPLEMENTED |
| #118 | none | no implementation | NO IMPLEMENTATION |
| #119 | none | no implementation | NO IMPLEMENTATION |
| #121 | #163 | merged, ancestor | OPEN BUT IMPLEMENTED |
| #123 | none | no implementation | NO IMPLEMENTATION |
| #124 | none | no implementation | NO IMPLEMENTATION; blocked label |
| #155 | #156, #158 | merged, ancestor | OPEN BUT IMPLEMENTED; superseded by #181 |
| #167 | #168, #188 | merged, ancestor | OPEN BUT IMPLEMENTED |
| #169 | none | no implementation | NO IMPLEMENTATION |
| #170 | #206 | merged, ancestor | OPEN BUT IMPLEMENTED |
| #171 | none | no implementation | NO IMPLEMENTATION |
| #172 | #205 (related behavior) | merged, ancestor | OPEN BUT IMPLEMENTED; direct closure link absent |
| #173 | #212 | merged `3399a873` ancestor | OPEN BUT IMPLEMENTED; packaged List evidence exists |
| #174 | none | no implementation | NO IMPLEMENTATION |
| #175 | #188 (smoke allowance) | merged related smoke only | MERGED BUT TEST PROMOTION INCOMPLETE |
| #176 | none | no implementation | NO IMPLEMENTATION |
| #177 | none | no implementation | NO IMPLEMENTATION |
| #178 | none | no implementation | NO IMPLEMENTATION |
| #179 | none | no implementation | NO IMPLEMENTATION |
| #180 | none | no implementation | NO IMPLEMENTATION |
| #181 | none | no implementation | NO IMPLEMENTATION |
| #182 | none | no implementation | NO IMPLEMENTATION; known invalid packet |
| #183 | none | no implementation | NO IMPLEMENTATION |
| #184 | none | no implementation | DEFERRED / CANONICAL ISSUE OUTSIDE MILESTONE |
| #185 | none | no implementation | DEFERRED / CANONICAL ISSUE OUTSIDE MILESTONE |
| #186 | #209 | merged `f4ac3b4c` ancestor | OPEN BUT IMPLEMENTED; durable proof exists |
| #187 | #188 | merged `3467309` ancestor | OPEN BUT IMPLEMENTED; allowance retirement remains |
| #189 | #207 | merged `e259d15` ancestor | OPEN BUT IMPLEMENTED |
| #190 | #211 | merged `c982d531` ancestor | OPEN BUT IMPLEMENTED; browser asset evidence green, allowance retirement pending |
| #191 | #204 | merged `82f176a6` ancestor | OPEN BUT IMPLEMENTED; packaged FileEntry evidence green |
| #192 | #205 | merged `51cd761` ancestor | OPEN BUT IMPLEMENTED |
| #193 | none | no implementation | NO IMPLEMENTATION |
| #194 | none | no implementation | NO IMPLEMENTATION |
| #195 | none | no implementation | NO IMPLEMENTATION |
| #196 | none | no implementation | NO IMPLEMENTATION |
| #197 | none | no implementation | NO IMPLEMENTATION |
| #198 | none | no implementation | NO IMPLEMENTATION |
| #199 | none | no implementation | NO IMPLEMENTATION |
| #200 | #188 (guard reference only) | related guard merged, Issue unimplemented | MERGED BUT TEST PROMOTION INCOMPLETE |
| #201 | none | no implementation | NO IMPLEMENTATION |
| #202 | #188/#209 (allowance/reference only) | related tests merged, Issue unimplemented | MERGED BUT TEST PROMOTION INCOMPLETE |

## Discrepancies for Coordinator

1. **OPEN BUT IMPLEMENTED:** at minimum #25, #38, #43, #44, #46, #58, #64, #67, #72, #82, #87, #89, #95, #107, #109, #110, #111, #113, #117, #121, #155, #167, #170, #172, #186, #187, #189, #192. GitHub closure is not performed by this audit.
2. **ACTIVE PR:** no target PR remains active among the audited merge set. Do not reopen stale RED packets; next implementation is #195.
3. **CLOSED WITHOUT ACCEPTANCE EVIDENCE:** none of the 79 inventory Issues was closed at snapshot; this flag is therefore zero, but several merged/open Issues still lack full acceptance.
4. **MERGED BUT TEST PROMOTION INCOMPLETE:** #175, #200, #202 (shared smoke/allowance evidence is not implementation acceptance); #190's focused asset proof is green but old-root health allowance retirement remains.
5. **CANONICAL ISSUE MISSING:** no missing Issue number was found for the queue or milestone inventory. #155 is explicitly retained as a superseded predecessor rather than dropped.
6. GitHub labels `blocked` and `needs-verification` are not proof of a current dependency graph; see `r2-final-red-gate-dependency-graph.md`.
