# Native-app focused visual evidence plan

| state | region | semantic reason | geometry invariant | screenshot value/flake |
|---|---|---|---|---|
| Text ready | native content root/editor/status | editor chrome/identity | controls/status within window | useful; font/Worker flake |
| Markdown split | editor+preview root | pane semantics | both panes contained | useful; narrow widths flaky |
| Photos fallback expanded | Photos root/image/restore | #180 workspace contract | image/control contained | high value; policy/browser flake |
| Video ready/error | player region/status | media failure clarity | player/error contained | moderate codec flake |
| Browser chrome | toolbar + iframe boundary | app/foreign ownership | address/control contained | moderate external site flake |
| Review populated | Review content/card/history | #170 readability | no horizontal overflow | high; theme/font flake |
| runtime loading/ready/error | status/canvas/iframe | honest runtime state | contained canvas/status | high; WASM/audio flake |

Use bounded region screenshots only alongside semantic assertions and health
ledger. Do not create broad golden-image infrastructure.
