# Shell visual-token consumer map

This is a behavioral/presentation audit, not a demand that every literal become a global token. A value is a duplicate only when it carries the same semantic meaning across consumers.

| surface / value | current consumer | classification | accepted action / evidence |
|---|---|---|---|
| taskbar/panel background | `shell.scss` local `--plasmon-bg*`; shared `--plasmon-*` also exists | duplicate semantic value / convergence candidate | compare appearance; #111 manual review, #201 cleanup |
| taskbar height | Shell local `--plasmon-taskbar-height:56px`; shared token `52px` | unknown semantic conflict | do not normalize by source assertion; establish one accepted layout token after visual review |
| focus ring | local `--plasmon-focus`; shared `--plasmon-focus-ring` | duplicate semantic value | converge only if appearance/accessibility remains equivalent |
| border/text/accent | local aliases and shared semantic tokens | duplicate semantic values | preserve theme variant; verify contrast/focus, not exact source string |
| radius/shadow | local `--plasmon-radius-*`, `--plasmon-shadow`; shared window/panel/control tokens | local legitimate vs duplicate | map by surface semantics; no forced global radius |
| Start/Search/Tray marks | inline SVG `StartMark`, `SearchMark`, `TrayMark` in `Shell.tsx` | local primitive / future shared icon candidate | user-visible identity; consume shared system icons only after accepted asset mapping |
| taskbar app icons | `ShellIcon` fallback/image | shared Shell presentation with canonical app metadata | preserve fallback/accessibility; #190 active |
| pin icon | `PinIcon` → shared Visual `SystemIcon(pin)` | semantic shared primitive | #109 complete; do not regress to emoji |
| taskbar running/focus indicator | Shell task classes + badge | local state presentation | #72 behavior is green; #198 may relocate presentation, not alter authority |
| Search result category tabs | local Shell buttons | local legitimate interaction surface | #175/#193 geometry/adapter dependencies |
| calendar grid | local Shell calendar styles | local legitimate calendar surface using shared text/border concepts | manual visual check; no semantic token duplication assumed |
| settings controls | local Shell settings styles | local legitimate form surface | preserve durable preference authority |
| context menu | inline fixed width/padding and local panel style | local geometry/presentation; behavior deficit in #183 | browser geometry must prove source adjacency/containment; avoid magic-position claims |
| NativeWindow chrome | `windowing.scss` + inline SVG controls | Windowing-owned presentation | #199/Luna-A; not Shell ownership |
| fallback glyphs | `ShellIcon` symbolic initials and older `□/▰/↗` shortcut choices | duplicate/legacy presentation candidates | canonical resource/application presentation (#190) owns identity; no source-shape RED |
| raw runtime text | tray still says `Element running state: yes/no/unknown` | behavioral presentation defect outside #72 task buttons | preserve uncertainty; #90/#174 dependency and future Shell cleanup |

## Classification rule

- **semantic shared token:** same meaning and state across two or more surfaces;
- **local legitimate value:** geometry/appearance specific to a surface or theme;
- **duplicate semantic value:** local value repeats a shared meaning and should converge after visual proof;
- **legacy/dead:** no active consumer after migration, verified by import/use search;
- **future #201 cleanup:** deletion/consolidation after #197/#193/#194/#198/#199 migrations;
- **unknown:** requires packaged/manual comparison rather than source inspection.

No visual RED is promoted from a literal count, CSS class, or file-size assertion. The remaining #111 claim is criterion-level audit + packaged/manual visual acceptance.
