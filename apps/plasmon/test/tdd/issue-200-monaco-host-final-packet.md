# #200 Monaco shared browser-runtime host — Luna-C final packet

**Disposition: FINAL PACKET READY.** No implementation is included. This packet
reconciles #67, #89, #113, #114, #189, and the existing document/session/save/
dirty-close authorities against integrated `origin/release/0.1.0-r2`.

## Refactor boundary

```text
FsNode / NodeId / MIME metadata
  -> #189 ResourceClassification
  -> Text/Markdown app policy (language, title, commands, preview)
  -> shared Monaco browser-runtime host (#200)
  -> Monaco model/editor/Worker browser lifecycle

DocumentSession / FsService / Process / Windowing / DocumentCloseModel
  remain outside the host and remain authoritative.
```

The host may own Monaco import, editor model lifecycle, worker bootstrap,
readiness/error state, and browser disposal. It must not own filesystem bytes,
NodeId identity, save/autosave, conflict detection, dirty-close negotiation,
Process teardown, Markdown sanitization, or Markdown preview semantics.

Text and Markdown may pass different language, model-key, label, read-only, and
app-command inputs. They must not share a live Monaco model merely because they
show the same semantic document or must create duplicate worker environments.

## Accepted evidence and current implementation

### #189 classification

- `ResourceClassification` is the canonical source for extension/MIME/content
  kind/language policy.
- Text currently consumes `editorLanguageForResource(name, mime)`; the explicit
  MIME path must remain stronger than filename guessing.
- Markdown's Markdown language choice is app policy and must not move document
  identity or persistence into the host.
- #200 must consume classification output, not duplicate extension/MIME tables.

### Model ownership (Bun/headless)

`editorModel.ts` already provides the deterministic lower seam:

- `editorModelUri(modelKey, instanceId)` gives every live surface a distinct
  URI, including two surfaces showing one NodeId.
- `createEditorSurfaceModelOwner` owns exactly the model it created and disposes
  it idempotently.
- `syncEditorModelValue` avoids resetting a Monaco model when the saved value is
  unchanged.
- Existing tests cover distinct live models and exact disposal isolation.

The semantic document key is not the Monaco model ownership key. A model URI is
not a filesystem identity and must never become the save key.

### Worker/path policy (Bun/headless)

`monacoEnvironment.ts` currently provides deterministic label-to-worker mapping:

- `json` -> `json.worker.js`;
- CSS-family labels -> `css.worker.js`;
- HTML-family labels -> `html.worker.js`;
- JavaScript/TypeScript -> `ts.worker.js`;
- all other labels -> `editor.worker.js`.

`installMonacoEnvironment` installs one `MonacoEnvironment.getWorker` adapter
and constructs module-relative Worker URLs. #89 owns the accepted canonical
Program Files/runtime path and legacy-path retirement; #200 must consume that
accepted route rather than hard-code a competing path.

Package structural tests prove worker inputs/outputs exist. They do **not** prove
that a browser constructs the Worker, that it communicates, or that a Firefox
opaque-origin Worker starts.

### Document/session authority (Bun/headless)

`DocumentSession` remains the source of truth for:

- stable NodeId target;
- UTF-8 bytes and stable reads;
- dirty state, autosave, save/reopen, Save As, conflicts, and failures;
- rename/move-insensitive content conflict handling;
- persistence through `FsService`.

`DocumentCloseModel` remains the shared Text/Markdown decision model. Process
owns the close request; Windowing owns window state; Save/Discard/Cancel resolve
or cancel the same Process request. #179's autosave policy remains independent
of Monaco lifecycle.

The host must receive current value/language/read-only inputs and report editor
changes/cursor/readiness back to the app adapter. It must not call filesystem
persistence directly or flush on unmount as a substitute for DocumentSession
policy.

## Browser/package acceptance

A visible editor shell or `data-editor-ready="true"` alone is insufficient.
The installed acceptance must prove all of the following with the actual
packaged archive:

1. **Real Monaco construction:** Text and Markdown create the real Monaco model
   and editor, not merely the host container.
2. **Worker construction and communication:** the browser observes the expected
   Worker requests/creation and successful language-service communication for
   representative labels, including worker failure visibility.
3. **Canonical packaged path:** requested worker/runtime assets resolve through
   the accepted #89 Program Files/package transport path; no legacy duplicate
   route or unexpected first-party 404 is hidden by a fallback.
4. **Chromium and Firefox:** both installed browsers are exercised. Firefox's
   opaque/partitioned origin must not produce the historical Worker security
   failure; Chromium must not pass only because it tolerates a different origin.
5. **Sandbox/CSP boundary:** the installed Neutron iframe retains its actual
   sandbox/origin/CSP policy. Do not grant broad same-origin or worker
   capabilities merely to make Monaco start.
6. **Readiness truth:** readiness requires real Monaco model/editor creation,
   the expected worker health evidence, and no unexpected page/console/runtime
   errors. A DOM marker is only a diagnostic signal.
7. **Lifecycle:** two simultaneous Text/Markdown surfaces have isolated live
   models; close/dispose removes only the owning model and worker resources;
   reopen restores bytes through DocumentSession; switching target/language
   does not retain stale model state.
8. **App-specific behavior:** Text title/status/commands and Markdown
   formatter/preview remain app-owned acceptance (#113/#114). The host must not
   silently claim those behaviors as readiness.

## Existing evidence / gaps

- #67 packaged edit/save/reopen journey exists, but real Worker handshake and
  Firefox opaque-origin proof remain required.
- #89 has deterministic route/package RED evidence; installed canonical path
  and legacy retirement remain required.
- #113 has confirmed missing title/language/command/minimap behavior. Its
  attempted RTL route has category-A shared Testing gap (`CSS.escape` absent in
  Happy DOM); do not repair it in this packet.
- #114 has confirmed missing formatter/command behavior and the same category-A
  RTL gap. Formatter/provider policy remains Markdown-owned.
- Existing document, save, conflict, close, model-ownership, and language tests
  are the Bun authority and must remain green.
- Existing `test/e2e/plasmon-monaco-packaged.spec.ts` proves a useful edit/save/
  reopen path but must not be treated as complete Worker/origin proof until the
  checks above are observed.

## Security and failure rules

- Worker failure is visible and bounded; no silent fallback to a fake editor.
- Monaco/browser failure does not corrupt or replace the FsService document.
- A stale async Monaco import cannot mutate a disposed surface or another
  surface's model.
- The host never weakens Neutron sandbox/CSP/origin policy.
- No localStorage, IndexedDB, OPFS, runtime-private storage, or Worker memory is
  a document/save authority.
- No second Text/Markdown host, worker route, model registry, or language table
  remains after migration.

## Final acceptance classification

**#200 final packet ready; implementation remains Luna-A-owned.**

- Bun/headless: model identity, worker-label/path policy, #189 language policy,
  DocumentSession, FsService persistence, Process/Windowing close negotiation.
- RTL: only semantic non-engine host wiring once the category-A Testing gap is
  repaired; do not simulate Monaco readiness.
- Playwright/package: real Monaco, Workers, communication, opaque origins,
  sandbox/CSP, packaged paths, readiness, and lifecycle.
