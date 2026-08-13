# #123 artwork fallback state table

| state | execution | presentation | error visibility |
|---|---|---|---|
| valid bounded local artwork | unchanged | artwork | none |
| absent metadata | unchanged | canonical generic game/file art | no error required |
| invalid URL/scheme | unchanged | canonical fallback | diagnostic may be recorded, not remote fetch |
| wrong MIME/oversized | unchanged | fallback | explicit bounded policy |
| read failure | unchanged | fallback | no blank/broken image |
| renamed/moved game | unchanged | same stable metadata | no path orphan |
| shortcut target missing | open fails canonically | fallback | Properties/OpenService error |
