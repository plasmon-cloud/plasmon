# #124 capture failure matrix

| condition | authoritative save | preview | required result |
|---|---|---|---|
| canvas available | commits | bounded image | display |
| tainted/unavailable canvas | commits | none/fallback | warning only |
| capture throws/returns empty | commits | none/fallback | no rollback |
| preview write fails | commits | none/fallback | report independently |
| stale preview after new save | commits latest | replace or mark stale | never payload truth |
| save deleted/moved | FS policy | preview follows save identity | no orphan authority |
| runtime unavailable | no capture | fallback | save path unaffected |
| close/unmount capture pending | explicit bounded decision | cleanup | no leaked object URL |
