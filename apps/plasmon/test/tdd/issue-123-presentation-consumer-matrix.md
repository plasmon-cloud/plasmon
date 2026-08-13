# #123 presentation consumer matrix

| consumer | input | expected | owner |
|---|---|---|---|
| Desktop | stable game FsNode + artwork metadata | artwork or shared fallback | Visual/#190 |
| FileManager | same presentation model | artwork/fallback, no game policy | A/Visual |
| Search | same resource presentation | artwork/fallback, no duplicate map | Shell/Visual |
| Properties/Open With | identity metadata only | app/resource identity, not execution | A/Visual |
| shortcut | target identity dereference | target artwork + shortcut overlay | FS/Visual |

No consumer switches on game name or extension for artwork. Tests should prove
one metadata lookup and shared fallback after #190, not create Games-specific
renderers.
