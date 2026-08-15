# Visual system agent instructions

## Authority

`visual/**` defines shared visual tokens, sizing, resource/application/media presentation, application-owned content-chrome presentation, overlays, fallback artwork, and wallpaper primitives. It is presentation-only.

## Rules

- Use shared semantic tokens/sizing; do not create competing numeric systems or palettes per surface.
- Native-app content chrome such as toolbar framing, common button treatment, status strips, loading/error/empty states, and generic content panels belongs here when the presentation is genuinely shared. The consuming app still owns labels, actions, state, document/media semantics, and accessibility meaning.
- Outer native-window title bars, borders, focus, geometry, and lifecycle are not Visual authority; those remain with Windowing/Process.
- Semantic resource/application classification happens before the visual layer. Do not infer product meaning from filenames or private subsystem state here.
- Preserve native/developer artwork and media aspect ratio unless a product-owned transformation explicitly says otherwise.
- Compose overlays/fallbacks without erasing the underlying resource identity.
- Consumers should reuse shared primitives instead of hard-coding parallel glyph/fallback/palette/chrome logic.
- Keep presentation behavior independent of filesystem, process, association, and Kernel authority.

Specific icon-family priorities, individual application artwork bugs, historic agent handoffs, or one-off color fixes belong in Issues/design records/tests rather than generic instructions.

## Refactor direction

Converge Desktop/FileManager/Shell/native-app presentation on this shared vocabulary. Keep semantic mapping and application behavior upstream, while reusable visual composition and common content-chrome framing remain presentation-only.

## Validation

Use component/token tests for deterministic presentation and browser/screenshot/manual review for actual image loading, layout, animation, focus, typography, and visual consistency.
