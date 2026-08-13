# Monaco live-model ownership corpus

| scenario | current contract/evidence | permanent destination |
|---|---|---|
| Text A + Text B | `createEditorSurfaceModelOwner` distinct URI test | Bun + packaged composed editor |
| Markdown C | same host surface with `:markdown` model key | Bun/RTL/package |
| edit/save A | DocumentSession keyed by A NodeId | Bun/package |
| B unchanged | model owners exact-dispose isolation | Bun |
| close A | A editor/model/session disposal only | browser lifecycle |
| close Markdown | C teardown does not affect A/B | browser lifecycle |
| Worker environment remains valid | package Worker health | #67/#200 browser |
| reopen/language rename | setModelLanguage + classifier dependency | Bun/browser |

Required proof must observe distinct live model ownership and actual browser
lifecycle; a shared global model registry or visible shell is insufficient.
