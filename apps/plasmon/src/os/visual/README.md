# Plasmon shared visual foundation

`visual/**` is the shared presentation-only foundation for Plasmon OS surfaces. It provides semantic sizing, reusable icon/media/resource presentation, application-owned content-chrome presentation, overlays, artwork/fallback composition, and wallpaper primitives.

It does not decide filesystem protection, hidden state, application/runtime identity, association matching, shortcut execution, Neutron ownership, application behavior, or native-window lifecycle/geometry. Callers resolve semantics first and pass presentation information into this layer.

## Main pieces

- `assets.ts` — shared Plasmon-owned visual assets/fallback references. Plasmon-owned references are package-relative so the same artwork resolves beneath the installed application mount rather than the Kernel/root asset namespace.
- `primitives.tsx` — reusable resource/application/icon/media primitives.
- `native-app-chrome.tsx` — small presentation-only primitives for application content inside native windows: shared content surface, toolbar framing, common button treatment, status strip, loading/error/empty-state framing, and generic content panels.
- `presentation.ts` — low-level presentation composition/types.
- `resource-presentation.ts` — canonical mapping from an already-produced filesystem/application classification or native handler identity into `ResourceIconPresentation`. It never classifies resources, resolves shortcuts, chooses handlers, or reads installation/filesystem state.
- `sizing.ts` — shared context sizing.
- `wallpaper.tsx` — wallpaper presentation.
- `visual.scss` plus shared integration tokens — common presentation rules driven by the `--plasmon-*` semantic token vocabulary.

The resource-presentation flow is:

```text
authoritative filesystem/application metadata
  -> ResourcePolicy classification / native handler identity
  -> visual/resource-presentation.ts
  -> ResourceIconPresentation
  -> ResourceIcon with a semantic surface context
```

Native/developer artwork and media should preserve aspect ratio/identity unless the product explicitly owns the artwork transformation. Shared overlays should compose with the underlying resource identity rather than replacing it. A surface may resolve target metadata needed for a shortcut, but shortcut execution remains outside Visual.

## Native-app content chrome

The shared content-chrome primitives style the application-owned area **inside** a Plasmon native window. They deliberately do not implement another native-window frame or generic application controller.

Consumers keep ownership of their semantic structure and behavior:

- applications choose toolbar controls, labels, ordering, actions, state, and accessible roles;
- editors keep document/session/Monaco semantics;
- media apps keep playback, canvas, navigation, and fullscreen semantics;
- system/utility apps keep their own settings/resource operations;
- Process and Windowing continue to own lifecycle and outer-window mechanics.

Visual supplies only the demonstrated common presentation: semantic token consumption, toolbar/button framing, status strips, loading/error/empty states, and generic content panels. App-specific media canvases, editor inputs/badges, and other domain presentation may remain local when they do not have demonstrated shared meaning.

## Refactor direction

Eliminate per-surface hard-coded glyph, sizing, fallback, palette, and duplicated content-chrome systems. Desktop, FileManager, Start/Search, taskbar, Properties, and native apps should converge on shared presentation primitives while semantic classification and application behavior remain upstream.

If a new visual category is needed, define a semantic presentation capability rather than making this layer inspect filenames or OS internals. Keep numeric density/sizing choices centralized in shared tokens. Add native-app chrome primitives only after more than one application demonstrates the common presentation need; do not grow a generic app template.

Visual design should take inspiration from mature desktop conventions while maintaining a distinct Plasmon identity and consistent behavior across surfaces.

## Testing

Use fast tests for presentation mapping, sizing tokens, fallback composition, and pure/component behavior. Use RTL/component tests when the claim is that a real native application consumes shared content-chrome presentation. Installed/package-relative resource addressing requires packaged-browser coverage because a standalone preview cannot prove the Neutron application mount. Use real-browser or screenshot/manual review for image loading, aspect ratio, layout, focus states, animation, typography, and cross-surface visual consistency. Unit snapshots alone are not visual acceptance.
