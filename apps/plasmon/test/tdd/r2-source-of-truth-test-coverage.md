# r2 source-of-truth regression coverage

| invariant | permanent guard | layer | missing / status |
|---|---|---|---|
| stable NodeId | fs, refactor, Trash, FileManager tests; #186 browser | Bun/headless/browser | covered |
| FsService authority | fs/bootstrap/protected/command tests | Bun | covered |
| AssociationRegistry/OpenService | association + cross-surface tests | Bun/headless | covered |
| `.sys` canonical native resources | bootstrap/refactor/Search projection | Bun | covered; #174 future surface not fully promoted |
| `.neutron` is projection, not installation authority | Review integration/refactor guards | Bun/headless/package | covered |
| NativeApplicationRegistry is not second inventory | bootstrap/Search/Start tests | Bun | covered |
| Process != application != Window | process/window/refactor guards | Bun/RTL | covered |
| Windowing geometry authority | WindowManager/snap/layout tests | Bun | exact browser geometry remains #175/#191 |
| `/System/Start Menu` authority | shell gate3/activation/migration tests | Bun | covered |
| Trash authority | Trash lifecycle and fs tests | Bun/headless | covered |
| visual presentation != classification | #189 consumer + Visual tests | Bun | covered |
| classifier != open policy | classifier and association/open tests | Bun | covered |
| no localStorage durable shadow state | storage-security and preference tests | Bun | covered |
| opaque origin/sandbox preserved | packaged smoke/health and Monaco/js-dos specialist specs | browser/package | execution/allowances remain for #67/#200/#202 |

The table intentionally distinguishes adjacent coverage from Issue-specific promotion. A green shared authority test does not close a browser or adapter acceptance automatically.
