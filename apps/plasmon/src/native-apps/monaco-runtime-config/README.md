# Monaco runtime configuration

This directory owns the shared native-application configuration schema consumed by Text and Markdown. It is separate from `shared/monaco`, which remains a browser/editor adapter and does not own filesystem persistence.

Monaco exposes one validated user-editable runtime configuration file through the canonical Plasmon filesystem:

```text
/System/Program Files/MonacoEditor/config.json
```

The runtime owns the schema and effective settings. The filesystem owns durable file identity, bytes, persistence, and change invalidation. Packaged Monaco worker/library bytes remain immutable package-authoritative runtime resources; this configuration file is not a replacement source tree or alternate execution authority.

## Schema

The current schema is `plasmon.monaco-runtime-config-v1`:

```json
{
  "schema": "plasmon.monaco-runtime-config-v1",
  "editor": {
    "minimap": {
      "enabled": true
    }
  }
}
```

`editor.minimap.enabled` defaults to `true`. Text and Markdown consume the same effective setting, and their Minimap toolbar controls write this same durable file rather than maintaining independent application-local preference state.

The reader preserves user-authored bytes. Unknown properties are ignored by the current effective reader and are not removed merely because the runtime does not recognize them. A recognized property with an invalid value falls back to that property's canonical default and emits one bounded Monaco-runtime-config diagnostic without rewriting the file.

Malformed JSON is also non-destructive. During one running Plasmon session, the runtime keeps the last-known-good effective snapshot. On a cold start with no valid snapshot, canonical defaults are used. `restoreDefaults()` is the explicit operation that replaces the file with the canonical default document.

## Reconciliation and observation

The protected `/System/Program Files/MonacoEditor` parent is reconciled by Filesystem. Monaco uses the privileged Program Files create-if-missing seam to ensure `config.json` exists, but the file itself is intentionally ordinary user-writable content so FileManager/Text saves flow through normal `FsService.write` persistence.

Filesystem `created`, `changed`, `moved`, `removed`, and `reset` events are invalidation signals only. `MonacoRuntimeConfigService` re-resolves and re-reads the authoritative file after relevant invalidation and publishes one immutable effective snapshot to all consumers. It does not poll and does not create per-property watchers.

A missing live config is recreated from the canonical default document. Ordinary reconciliation of an existing file never replaces its bytes.

## Live editor behavior

`MonacoEditorHost` keeps model creation keyed independently from runtime option updates. A minimap change is applied to the mounted Monaco editor through `editor.updateOptions(...)`; it does not create a new model. Text/Markdown document ownership, dirty state, unsaved text, cursor/selection, undo history, Save/Save As, and Process close negotiation remain outside runtime configuration.

The browser acceptance for this contract edits `config.json` through real Explorer/Text UI and proves `true -> false -> true` changes the rendered minimap on an already-open document while the document model URI, unsaved content, dirty state, and selection remain intact.

## Boundary with packaged runtime assets

Do not make `editor.worker.js`, dedicated language-service workers, Monaco libraries, or browser transport mirrors writable through this configuration mechanism. Package-tier worker inventory and transport remain packaging concerns, and heavyweight runtime delivery remains separately owned architecture.

Direct user replacement of executable runtime source is unsupported. A future developer override/overlay would require explicit provenance, security, reload, integrity, and upgrade-layering semantics; it must not emerge accidentally from the config-file seam.

## Future runtime candidates

The reusable idea is intentionally small: a runtime may own a validated config file beneath its canonical Program Files subtree and subscribe to normal filesystem invalidation. Runtimes retain independent schemas.

For js-dos, later user-facing candidates may include bounded presentation/input behavior such as kiosk, mouse capture, or deliberate startup behavior where Product semantics permit. Do not expose `autoSave` merely because js-dos accepts it if that would bypass Plasmon's filesystem-backed save/lifecycle authority.

For EmulatorJS, language/automatic-language preferences are plausible later candidates. Do not expose `gameUrl`, packaged `dataRoot`, core selection, or storage/database/security flags merely because they exist in launch configuration; those remain runtime/authority decisions unless a separate Product contract makes them configurable.

## Testing boundary

Keep parser/default/fallback behavior, reconciliation, filesystem persistence, event-driven reload, subscription fanout, unknown-property preservation, and in-place option updates in deterministic Bun/headless tests. Use one bounded packaged-browser acceptance only for the actual rendered Monaco minimap and browser editor-session preservation boundary.
