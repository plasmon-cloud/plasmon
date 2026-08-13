# #64 save corruption/compatibility matrix

| condition | original game launch | saved progress | user-visible result | permanent layer |
|---|---|---|---|---|
| no save | succeeds | none | normal start | Bun/headless |
| compatible valid save | succeeds | restore | ready with restored state | browser + FS |
| missing save bytes | succeeds | none | deterministic missing-save notice or silent normal start per Issue | Bun |
| checksum/parse corrupt | succeeds | reject | warning, no crash/no overwrite | Bun |
| runtime id mismatch | succeeds | reject | incompatible-save warning | Bun |
| schema/version mismatch | succeeds | migration or reject | explicit compatibility result | Bun |
| save write failure | remains running/close policy | no false clean | error and dirty/pending decision | Bun |
| save read failure | original remains launchable | no false restore | warning | Bun |
| source rename/move | succeeds | same NodeId save | restore remains associated | headless |
| source delete/permanent trash | policy-specific | no orphan authority | deterministic cleanup/fallback | headless |
