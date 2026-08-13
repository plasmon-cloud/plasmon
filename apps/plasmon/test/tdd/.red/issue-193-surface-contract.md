# Issue #193 — future Search surface contract

This is an authority and observable contract, not an implementation-shape
requirement. Finalize dependency-sensitive result types after #174/#190 and
accepted #189 integration.

## Input contract

```text
canonical search result source + query + selected category
+ loading/error/warning/truncation observations
+ activation commands
-> one rendered Search surface
```

Inputs must carry stable result identity, title/subtitle, category, canonical
resource/application identity, presentation data or a Visual resolver input,
and an activation command/route owned by the canonical authority. The surface
must not derive execution semantics from title, extension, icon, or category
label.

## Observable states

| State | Required behavior | Lowest layer |
|---|---|---|
| closed | no Search surface; closing does not mutate durable FS/process state | RTL/controller |
| opening/loading | input and category controls have documented focus; status is exposed | RTL |
| populated | result buttons have stable accessible names and category semantics; Enter/pointer activate | RTL |
| empty | stable empty message in result region; frame does not collapse | RTL + #175 browser |
| warning/truncated | bounded warning is visible without claiming failure; results remain usable | Bun + RTL |
| error | visible alert, no stale result activation unless accepted policy says retain it | Bun + RTL |
| activating | chosen item exposes busy/disabled state only for that item or accepted command scope | RTL |
| closed after activation | canonical activation completes or visible error remains; flyout dismissal follows accepted policy | RTL/composed |

## Interaction contract

- Search taskbar button toggles Search and closes another shell flyout.
- Escape closes the active Search/context surface according to shell-global policy.
- Outside pointer closes Search but does not close a foreign Browser/Neutron
  surface.
- Category selection changes projection only, not canonical search source.
- Arrow/Home/End navigation traverses visible result buttons; Enter activates the
  focused result through its route.
- Query cancellation prevents stale result commits.
- Focus behavior is characterized before extraction; no implicit focus claim is
  accepted merely because an input has `autoFocus`.

## Dependency gates

- #174: exactly one accepted native `.sys` projection/identity policy.
- #189: canonical classification/type result vocabulary.
- #190: shared Visual identity/fallback and packaged asset health.
- #175: measured stable geometry/internal scroll acceptance.
- #187: strict browser-health baseline and scoped allowances.
