# Search current-behavior matrix

Refresh: integrated `origin/release/0.1.0-r2` at `82f176a6`. No open PR owns
#193 or #175. #174 and #190 are integrated dependencies; this document does
not alter their authorities.

| Journey/behavior | Canonical source | Shell transient state | Search projection state | Classification dependency | Presentation dependency | Activation authority | Existing evidence | Missing evidence |
|---|---|---|---|---|---|---|---|---|
| open Search | taskbar `toggleFlyout("search")` | `flyout` | none initially | none | Shell panel CSS | none | Shell/RTL smoke | focused surface RTL |
| close Search | taskbar toggle, Escape, outside pointer | `flyout` | query/results remain in React state until next open | none | panel hit boundary | none | `shouldDismissShellFlyout` tests | explicit query reset/preserve characterization |
| click-away | document capture pointer listener | `flyout`, `contextMenu` | no projection mutation | none | `[data-shell-flyout]` ownership | none | interactions tests | composed RTL |
| Escape | window keydown | closes context/flyout | search request canceled | none | focus return unspecified | none | Shell source + interaction tests | focus destination |
| query entry | Search input | `searchQuery` | `LatestSearchController`, debounce, AbortController | Search filesystem/classifier | result title/subtitle/icon | none | `LatestSearchController` tests | RTL user-event query/race |
| empty query | `searchShell` with blank query | busy/result state | filesystem traversal still returns app/projection/file results; directories only when query | `classifyResource` for apps | Shell result rows | activation per result | shell/search tests | accepted empty-result semantics |
| populated query | `searchShell` matching terms | query/busy/error | native + Element + FS/projection results then limits | classifier + local media fallback | Shell result rows | `activateSearchFilesystemResult`, OpenService, Process, Neutron | search tests | uniqueness corpus across all kinds |
| zero results | filter result list | query/tab | empty paragraph if not busy | category matching | empty copy | none | source only | RTL |
| error | Fs root/list failure or open failure | `searchError`/`actionError` | warnings and error strings | FsService | alert region | open authority catches | headless search warning tests | rendered error journey |
| Apps | `SearchTab="apps"` | `searchTab` | category filter | native definitions, Elements, `.neutron` projection, shortcuts | `searchApplicationIcon`, ShellIcon | native Process/OpenService, Neutron bridge, shortcut activation | search projection + activation tests | no duplicate aliases corpus |
| Documents | category filter | `searchTab` | directory/file results | ordinary classifier | subtitle MIME/fallback | filesystem opener | shell tests | explicit type consistency |
| Media | category filter | `searchTab` | file results categorized by MIME prefix or `MEDIA_EXTENSIONS` | currently duplicate media suffix policy | ShellIcon | association/open authority | shell tests | canonical #178 result |
| Atoms | category filter | `searchTab` | atom metadata or `.atom` suffix | atom semantic kind/metadata | subtitle atom title/type | filesystem opener/atom route | search tests | sparse/empty category geometry |
| keyboard result navigation | `.plasmon-shell__results` keydown | activeElement + list query | no projection change | none | button focus | Enter invokes button/open callback | `focusRelative` source only | RTL Arrow/Home/End/Enter |
| pointer activation | result button click | `busyId`, flyout | no new state | result kind | button/icon | `openService`, Process, Neutron, filesystem activation | activation tests | RTL composed surface |
| focus movement | autoFocus input, result focus | browser DOM | none | none | panel focus | none | source only | RTL/browser focus evidence |
| category switch | tab click | `searchTab` | filters existing batch only | result category | geometry currently content-dependent | none | filter function | #175 measured browser geometry |
| query preservation/reset | `searchQuery` dependency and flyout close | React state remains after close; query not explicitly cleared | request canceled/restarted | none | input value | none | source inspection | accepted policy characterization |
| running app | Element `running` / Process state | snapshots in Shell | Element runtime label; native process records | no classifier for runtime | taskbar/Search label | canonical Process/Neutron bridge | taskbar/search tests | Search-specific running representation |
| native `.sys` | managed system app or direct FS result | none | current integrated Search de-duplicates direct native and canonical `.sys` identity | `classifyResource` metadata | shared #190 presentation | activation dispatcher | #174 closure + projection tests | #193 focused surface consumption |
| `.neutron` | validated `NEUTRON_APP_MIME` metadata | Elements snapshot + FS projection | projection merged by `elementId` when Element exists | #189 classifier | Element icon/name overlay | Neutron bridge/filesystem activation | projection tests | one-result identity after dependencies |
| ordinary file | FsService traversal | none | `node:<id>` FileSearchResult | currently MIME/suffix category | `fileSubtitle`, ShellIcon fallback | filesystem opener/association | search tests | cross-surface type fact |
| shortcut | `parseStartShortcut` metadata | none | `shortcut:<node.id>` app result | target semantics | `shortcutPresentation` | `activateSearchFilesystemResult` | activation tests | duplicate target alias rules |

## Conclusion

The Search projection model is deterministic below React for cancellation,
limits, invalidation, activation, and integrated #174/#189/#190 source semantics.
The #193 packet can characterize these semantics without asserting a component
shape; only #175 geometry remains a separate browser acceptance dependency.
