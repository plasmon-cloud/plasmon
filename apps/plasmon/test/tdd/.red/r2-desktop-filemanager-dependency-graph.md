# r2 Desktop/FileManager dependency graph

This graph distinguishes implementation, consumer, packet, and closure
relationships. It is not branch-stacking instructions.

```text
#189 ──hard implementation──> #190 consumers
  │                           └──soft consumer──> #52
  ├──test-packet──> #178
  ├──test-packet──> #174
  ├──consumer prerequisite──> #193 Search
  └──consumer prerequisite──> #194 Start

#171 ──no dependency / parallel──> #190
#190 ──no dependency / parallel──> Monaco / js-dos / EmulatorJS authorities

#191 ──hard implementation──> #195 adapter decomposition evidence
#195 ──hard implementation──> #196 view-strategy reconstruction
#195/#196 ──soft product dependency──> #173 List acceptance
#173 ──behavior packet / may run in parallel──> #196
#189/#190 ──soft consumer preference──> #195/#196

#65 ──hard implementation──> #92 operation-state reuse
#44 ──hard consumer dependency──> #51 Send to Desktop

#192 ──closure relationship──> #172 restore collision
#45 ──no dependency / parallel──> #172 Trash restore UI

#176 ──consumer relationship──> Shell/FileManager/native-app context adapters
#176 ──no authority dependency──> Browser/foreign Neutron iframe content

#169 ──hard implementation──> #194 Start reconstruction
#182 ──soft consumer/inventory prerequisite──> #194
#174/#189/#190 ──soft consumer prerequisites──> #193/#194

#186 ──browser-boundary / parallel──> all domain refactors
#201 ──closure/cleanup after──> completed #189/#190/#191/#192/#193/#194/#195/#196
```

## Edge ledger

| Edge | Classification | Practical consequence |
|---|---|---|
| #189 -> #190 | HARD IMPLEMENTATION DEPENDENCY for consumer migration | presentation consumers need real canonical classification; package asset fix remains separate |
| #190 -> #52 | SOFT CONSUMER PREFERENCE | #52 can consume shared presentation incrementally; do not make icon/type maps in FileManager |
| #191 -> #195 | HARD IMPLEMENTATION DEPENDENCY | #195 responsibility map should inspect surviving FileEntry seam after #191 integration |
| #195 -> #196 | HARD IMPLEMENTATION DEPENDENCY | do not freeze final view strategy API before adapter decomposition settles |
| #195/#196 -> #173 | SOFT PRODUCT / TEST DEPENDENCY | List behavior packet can run now; implementation architecture waits for #195/#196 |
| #65 -> #92 | HARD IMPLEMENTATION DEPENDENCY | one accepted operation-state vocabulary; #92 currently WAIT FOR #65 |
| #44 -> #51 | HARD CONSUMER DEPENDENCY | Send to Desktop delegates canonical shortcut primitive |
| #192 -> #172 | CLOSURE RELATIONSHIP | #192 placement proves collision; Trash identity evidence remains outside #192 |
| #189 -> #178/#174 | TEST-PACKET DEPENDENCY | update consumer gates to real classifier result after #189 integration |
| #190 -> #52 | SOFT CONSUMER PREFERENCE | convergence, not semantic authority transfer |
| #190 / #171 | NO DEPENDENCY / MAY RUN IN PARALLEL | Plasmon-owned asset roots and installed Element icon resolver stay separate |
| #176 -> surface adapters | SOFT CONSUMER RELATIONSHIP | requires a narrow event policy seam, not a global interceptor |
| #169 -> #194 | HARD IMPLEMENTATION DEPENDENCY | durable Start reconciliation must leave React render lifecycle |
| #186 -> domain work | NO DEPENDENCY / MAY RUN IN PARALLEL | browser persistence evidence is a separate origin/profile boundary |
| #201 -> migrations | CLOSURE RELATIONSHIP | cleanup only after consumers and tests prove replacement |

## Current implementation order

**Ready in parallel:** #178, #174, #173, #182 packet implementation; #171
resolver characterization; #86/#110 browser verification when session returns;
#186 investigation; #176 seam design; #190 package correction after #189 API
review.

**Waiting:** #92 for #65 integration; #195 refresh for #191 integration; #196
final packet for #195 implementation; #172 closure for #192 release integration;
#201 cleanup for accepted migrations.

**Do not serialize unnecessarily:** #173 behavior does not require #195 to
produce a RED packet; #171 does not wait for #190; #186 does not wait for
filesystem semantic refactors; #176 does not own command semantics.
