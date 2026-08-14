# Plasmon shared visual foundation

`visual/**` is the shared presentation-only foundation for Plasmon OS surfaces. It provides semantic sizing, reusable icon/media/resource presentation, overlays, artwork/fallback composition, and wallpaper primitives.

It does not decide filesystem protection, hidden state, application/runtime identity, association matching, shortcut execution, or Neutron ownership. Callers resolve semantics first and pass presentation information into this layer.

## Main pieces

- `assets.ts` — shared Plasmon-owned visual assets/fallback references. Plasmon-owned references are package-relative so the same artwork resolves beneath the installed application mount rather than the Kernel/root asset namespace.
- `primitives.tsx` — reusable resource/application/icon/media primitives.
- `presentation.ts` — low-level presentation composition/types.
- `resource-presentation.ts` — canonical mapping from an already-produced filesystem/application classification or native handler identity into `ResourceIconPresentation`. It never classifies resources, resolves shortcuts, chooses handlers, or reads installation/filesystem state.
- `sizing.ts` — shared context sizing.
- `wallpaper.tsx` — wallpaper presentation.
- `visual.scss` plus shared integration tokens — common presentation rules.

The intended flow is:

```text
authoritative filesystem/application metadata
  -> ResourcePolicy classification / native handler identity
  -> visual/resource-presentation.ts
  -> ResourceIconPresentation
  -> ResourceIcon with a semantic surface context
```

Native/developer artwork and media should preserve aspect ratio/identity unless the product explicitly owns the artwork transformation. Shared overlays should compose with the underlying resource identity rather than replacing it. A surface may resolve target metadata needed for a shortcut, but shortcut execution remains outside Visual.

## Refactor direction

Eliminate per-surface hard-coded glyph, sizing, fallback, and palette systems. Desktop, FileManager, Start/Search, taskbar, Properties, and native apps should converge on shared presentation primitives while semantic classification remains upstream.

If a new visual category is needed, define a semantic presentation capability rather than making this layer inspect filenames or OS internals. Keep numeric density/sizing choices centralized in shared tokens.

Visual design should take inspiration from mature desktop conventions while maintaining a distinct Plasmon identity and consistent behavior across surfaces.

## Testing

Use fast tests for presentation mapping, sizing tokens, fallback composition, and pure/component behavior. Installed/package-relative resource addressing requires packaged-browser coverage because a standalone preview cannot prove the Neutron application mount. Use real-browser or screenshot/manual review for image loading, aspect ratio, layout, focus states, animation, typography, and cross-surface visual consistency. Unit snapshots alone are not visual acceptance.
