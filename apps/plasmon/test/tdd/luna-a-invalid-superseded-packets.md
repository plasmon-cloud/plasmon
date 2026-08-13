# Luna-A invalid/superseded packet index

These artifacts must not be adopted by future implementors without the listed
replacement. This index records specification failures, not product behavior.

| Superseded packet/shape | Problem | Correct replacement |
|---|---|---|
| old #66 stacking gate | asserted source DOM transforms/stacking rather than actual top-level preview, hit testing, drop and cleanup | repaired #66 browser packet from `789279e`/`6eb5cc5`; active ownership means do not edit |
| old #173 vertical-list gate | treated current single-column List as target and used invalid “ArrowRight must not move” assumption | repaired compact multi-column/spatial packet; active ownership means do not edit |
| old #178 cast-based API test | invented deleted `editorLanguageForName(name, mime)` API with TypeScript cast | `issue-178-authority-map.md`, precedence/consumer maps; wait for real seam |
| old #182 test-local Favorites projection | copied expected Favorites list into test rather than exercising production Explorer/root inventory | existing production Explorer/root inventory packet; active ownership means do not edit |
| old #190 browser-health baseline | removed or ignored unrelated accepted allowances and did not preserve strict #187 baseline | existing #190 packet with scoped allowance map; active ownership means do not edit |
| stale #191 implementation-coupled variants | assumed an unmerged FileEntry architecture and asserted future seams | `filemanager-decomposition-readiness-v2.md`; finalize only after PR #204 integrates |
| conditional overflow browser assertions | passed when production fixture did not overflow, weakening #175 claim | current #175 spec requires production result-region overflow; browser still blocked |
| parser/list output treated as browser evidence | Playwright syntax/listing is not app execution | browser packets explicitly classify execution blocked/list-only |
| fake video thumbnail decoder proposal | would test invented browser/media API rather than current production seam | #94 authority/eligibility/lifecycle contracts; browser spec/refactor gap |
| speculative #92 progress model | created operation model before #65 accepted vocabulary | #92 preserve/consumption docs; wait for #65 integration |
| Shell global context-menu interceptor | violated foreign Browser/Neutron ownership and #176 boundary | Shell listener/authority audits; B's concrete #176 packet |

No production file was deleted or weakened to retire these shapes.
