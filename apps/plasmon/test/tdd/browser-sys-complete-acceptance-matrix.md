# Browser.sys complete acceptance matrix

| journey | owner/evidence | required layer |
|---|---|---|
| initial URL/direct target | `url.test.ts`, resolveBrowserTarget | Bun |
| `.url` resource | shortcut parser + URL tests | Bun/headless |
| address edit + Go/Enter | Browser form handler | RTL |
| loading/success | state + iframe onLoad | RTL/browser |
| navigation update | Process target update | headless/RTL |
| invalid scheme/URL | normalize error | Bun/RTL |
| embedded failure | iframe onError/actionable external | browser |
| external open | opener `_blank`, noopener | Bun/browser |
| sandbox/no same-origin | Browser iframe sandbox string | packaged browser/security |
| foreign keyboard/context | app chrome vs iframe | browser/#176 input |
| downloads/popups | allow-popups only; no product download manager exposed | browser boundary, no claim |
| close/reopen | Process/Window + URL target | headless/RTL |

The current Browser app exposes no native download/history tab or navigation
stack; these are not fabricated acceptance requirements.
