# Plasmon Visual System & Theme

**Agent 11 design handoff**  
**Starting SHA:** `3dc25e00511c9070165560e324aba3cc31235a8e`  
**Primary visual reference:** `version-0.1.0-gui`  
**Architecture target:** current `apps/plasmon/src/os/*` composition  
**Status:** design specification plus a narrow shared-token proof

This document defines how Plasmon should recover the compact, dark teal/green visual identity of GUI1 without restoring GUI1's architecture. The operating-system services, filesystem model, process/runtime model, window semantics, Neutron integration, MTN/sharing contracts, and protected-resource semantics are out of scope.

The governing rule is:

> Current Plasmon architecture, GUI1 visual identity, one shared resource-icon language, native Neutron artwork preserved, and desktop-native density.

---

## 1. Executive summary

GUI1 looked more coherent primarily because it had one visual vocabulary. Desktop cells were roomy while the actual artwork stayed small; borders and selected surfaces were restrained; typography stayed compact; the taskbar was short; native application art was contained rather than cropped; and the wallpaper established a recognizable teal Plasmon identity without competing with desktop labels.

The current OS architecture is substantially stronger, but the visual implementation has fragmented. Shell, FileManager, windowing, and integration each carry overlapping or hard-coded palettes and dimensions. FileManager has blue selection and drop-target colors independent from the shell theme; its file icons are typographic placeholders; thumbnails use `object-fit: cover`; Shell uses a literal pin emoji and exposes Neutron running text in the taskbar; and the current wallpaper is an aurora treatment without GUI1's low-opacity Plasmon wordmark.

The recommended migration is not a CSS rollback. Keep current components and services, then make them consume a lightweight shared visual system:

1. semantic theme tokens;
2. a common icon canvas and icon-frame primitive;
3. original Plasmon `.sys` and file-type SVG assets;
4. direct, unmodified presentation of native `.neutron` icons;
5. a target-icon-plus-overlay shortcut primitive;
6. one aspect-preserving thumbnail primitive;
7. shared selection/focus/runtime-state rules.

The first proof is the expanded `os/integration/visual-tokens.scss`, which defines the proposed semantic palette, density, typography, and icon canvas values while retaining aliases used by current windowing/integration code.

---

## 2. GUI1 visual analysis

The strongest GUI1 characteristics come from `apps/plasmon/src/desktop.scss` on `version-0.1.0-gui`.

### Density and proportion

GUI1 used a roughly `92x90` desktop item but only a `46x46` icon frame. That relationship matters more than the exact number. The icon has visible air around it, the label is compact at roughly `11.5px`, and the whole item reads as a desktop shortcut rather than a mobile card.

The taskbar followed the same principle: `52px` overall height, approximately `40px` button targets, and `29px` app icon frames. The artwork therefore remained recognizably small and did not visually fill the taskbar.

### Restraint

GUI1 used transparent normal states, low-opacity hover fills, thin borders, and a restrained running indicator. It did not put every icon inside a large opaque tile. Rounded corners existed, but they were supporting geometry rather than the primary identity.

### Palette

The dominant visual field was dark blue/teal with a green-teal accent. Cyan appeared only as a secondary hue. Bright green was not sprayed across every surface. This created a recognizable Plasmon identity while allowing native app icons and file thumbnails to remain colorful.

### Wallpaper

The GUI1 wallpaper combined:

- a deep blue/teal base gradient;
- one subtle green radial glow;
- a second very subtle cyan/teal influence;
- large low-frequency geometric outline forms;
- a large, low-opacity Plasmon mark and `plasmon` wordmark near the lower-right.

The low-frequency artwork is important: it communicates identity without creating noise behind dense file layouts.

### Typography

GUI1 consistently declared an Inter-first UI stack and used comparatively small labels, titlebar text, metadata, and clock text. The perceived improvement is therefore a combination of typeface choice, smaller sizes, restrained weights, and tighter line-height—not just the string `Inter` in `font-family`.

### Icons

GUI1's strongest icon rule was presentation rather than icon illustration quality: source application images were kept inside a common size and used `object-fit: contain`. This prevented arbitrary intrinsic image sizes from destroying visual rhythm.

### Windows and glass

Windows used a `38px` titlebar, compact app glyph, restrained border, translucent dark body, and a substantial but soft shadow. Glass/translucency was concentrated in shell/window surfaces instead of applied to every file row.

---

## 3. Current GUI weaknesses

The current architecture should remain, but the current visual layer has several specific weaknesses.

### Duplicate theme ownership

`os/integration/visual-tokens.scss` already defines shared variables, while `os/shell/shell.scss` defines another full palette and sizing system. FileManager then introduces its own hard-coded dark blue and bright blue states. This makes visual drift inevitable.

### Density drift

The current shell has a `56px` taskbar and `44px` task buttons, plus larger flyout geometry. Those dimensions are not individually unreasonable, but together they move the UI toward touch-oriented web-app density rather than GUI1's compact desktop density.

### Competing blue selection language

FileManager uses bright blue selection, focus, rename, marquee, and drop-target colors. The shell's identity is green/teal. The result looks like two operating systems layered together.

### Placeholder resource icons

Current FileManager glyphs include `▰`, `≡`, `M↓`, `▧`, `▶`, `↗`, `◈`, and `◇`. These are useful implementation placeholders but are not a shippable desktop icon system. In particular, the text icon reproduces the user's “hamburger” complaint.

### Thumbnail cropping

`polish.scss` currently sets file thumbnails to `object-fit: cover`. That forces square crops and loses the source image's intended aspect ratio.

### Shortcut identity loss

The current visual shortcut type is represented by an arrow glyph. A shortcut should instead inherit its target's visual identity and add a small overlay.

### Runtime/pinning UI leakage

Shell currently uses a literal `📌` for pin operations, and Neutron taskbar entries can display a small running-state value. Runtime state should be communicated through the taskbar's geometry, not text such as `yes/no` or an arbitrary emoji.

### Wallpaper ownership collision

Shell owns the real desktop wallpaper, but FileManager's desktop presentation still contains its own multi-gradient desktop background. The desktop FileManager surface should become transparent so there is one wallpaper owner.

### Properties and Open With diverge

Properties and Open With use separate fallback symbols instead of the same shared icon/thumbnail presentation used on the desktop. This creates a visible inconsistency precisely where users expect identity to carry through.

### Inter is named, not demonstrated as packaged

The current source names Inter in CSS, but this audit found no bundled Inter font asset or font package in the Plasmon package dependencies. Therefore packaged Plasmon must not assume that declaring `Inter` means Inter will render.

---

## 4. Design principles

1. **Artwork breathes inside the canvas.** The desktop cell is not the icon. Artwork should occupy roughly 75–88% of its icon frame depending on shape and optical weight.
2. **Identity stays attached to the resource.** Native app art, target shortcut art, thumbnails, and file types should remain recognizable across Desktop, FileManager, Start, Search, Properties, and taskbar.
3. **State changes the frame, not the identity.** Hover, selection, focus, running, and drag/drop should normally alter background, border, indicator, shadow, or opacity rather than recoloring the icon.
4. **Desktop density wins over dashboard density.** Small labels, short rows, restrained padding, and compact controls are intentional.
5. **One accent family.** Teal/green is the primary interactive accent. Blue is allowed only as subordinate content color, not a second selection system.
6. **Glass is structural, not decorative.** Use translucency on taskbar, flyouts, titlebars, and selected elevated panels; do not glassify every file item.
7. **Native app icons are content.** Never recolor developer-provided `.neutron` icons to fit the theme.
8. **Accessibility remains explicit.** Keyboard focus must be independently visible from hover and selection; disabled state must not be confused with hidden/protected state.
9. **Protected is not disabled.** `.sys` and `.neutron` protection is primarily an operation-policy concept, not a lock badge or faded icon.
10. **Original Plasmon assets over copied OS assets.** Familiar affordances are welcome; copied Windows/macOS artwork is not.

---

## 5. Color/theme tokens

The default theme should be the refined GUI1 teal system below. These values are now represented in the shared token proof.

| Semantic token | Recommended value | Use |
|---|---:|---|
| Desktop background | `#07131a` | Base wallpaper field |
| Panel background | `rgba(18, 28, 35, 0.94)` | Shell flyouts and translucent panels |
| Panel elevated | `#17242c` | Menus/dialog surfaces |
| Window background | `#111820` | Native window content default |
| Window titlebar | `#18242b` | Titlebar base |
| Taskbar | `rgba(13, 24, 30, 0.91)` | Bottom shell |
| Border subtle | `rgba(255,255,255,0.11)` | Normal framing |
| Border strong | `rgba(255,255,255,0.18)` | Focused/elevated framing |
| Text primary | `#f5faf7` | Primary labels |
| Text secondary | `#a7b7b1` | Metadata |
| Text disabled | `#6f807a` | Truly unavailable controls |
| Accent | `#84e3b0` | Primary system accent |
| Accent hover | `#9ce9c0` | Active accent hover |
| Accent ink | `#082419` | Text on filled accent |
| Selection | `rgba(132,227,176,0.16)` | Selected resource fill |
| Selection border | `rgba(156,233,192,0.34)` | Selected resource border |
| Focus ring | `#a7edc7` | Keyboard focus |
| Danger | `#ff9a9f` | Destructive/error only |
| Warning | `#f0c878` | Warning only |
| Success | `#84e3b0` | Success status |
| Window shadow | `0 26px 70px rgba(0,0,0,.46)` plus subtle inset | Focused windows |

The theme should expose semantic variables, not component-specific arbitrary colors. Shell, Desktop, FileManager, Start, Search, dialogs, windowing, and native apps should consume the same semantic values.

A secondary theme may override semantic tokens later, but the default visual identity should remain this teal Plasmon theme.

---

## 6. Typography

### Font strategy

Preferred packaged experience:

1. explicitly bundle Inter as a local webfont only after its upstream license and redistribution requirements are recorded in Plasmon's third-party notices;
2. load it with `@font-face` from the packaged application rather than relying on network availability;
3. keep the current system fallback stack for failure and platform consistency.

Until the font is actually bundled, the product should treat the stack as “Inter if present, otherwise system UI,” not as guaranteed Inter rendering.

Recommended UI stack:

```css
Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
"Segoe UI", sans-serif
```

Recommended monospace stack:

```css
ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
"Liberation Mono", monospace
```

### Scale

| Role | Size | Weight | Line height |
|---|---:|---:|---:|
| Desktop label | `11.5px` | 500 | `1.15` |
| Caption/secondary microcopy | `10.5px` | 400–500 | `1.25` |
| Default UI | `13px` | 400–500 | `1.35` |
| Titlebar | `12px` | 600 | `1` / titlebar centered |
| Menu/row label | `12.5–13px` | 500 | `1.25` |
| Dialog heading | `18–20px` | 600 | `1.2` |
| Panel heading | `16–18px` | 600 | `1.2` |
| Monospace metadata | `12–12.5px` | 400 | `1.4` |

Prefer weights 400, 500, 600, and occasional 700. Avoid synthetic ultra-light or extra-bold typography. Do not globally force platform font smoothing; browser/OS text rendering should be evaluated in the packaged Neutron environment first.

---

## 7. Wallpaper

Shell should be the sole owner of the wallpaper. Desktop/FileManager's desktop presentation should be transparent.

Recommended composition:

```text
base: #07131a
layer 1: linear gradient #091a22 -> #09242a -> #08161d
layer 2: soft teal radial glow near upper/right
layer 3: optional cyan/teal glow at substantially lower opacity
layer 4: two very large outlined geometric forms, low contrast
layer 5: Plasmon mark + wordmark at lower/right, 10–14% opacity
```

The exact GUI1 geometry can be adapted from `.pl-wallpaper-glow`, `.pl-wallpaper-wordmark`, and `.pl-mark`. The forms should scale with viewport size and remain low-frequency. They should not animate by default.

The wordmark must stay visible enough to establish identity on an empty desktop but disappear perceptually behind a dense icon layout. Desktop labels must retain adequate contrast over every wallpaper region.

---

## 8. Plasmon logo/wordmark recommendation

Use the GUI1 rotated geometric mark plus lowercase `plasmon` wordmark as the primary shell/wallpaper identity direction.

The current/legacy package `public/static/icon.svg` ring-and-center-dot icon is visually compatible with the palette, but it should not silently replace the GUI1 geometric identity. A later identity cleanup should reconcile the package icon, shell Start mark, wallpaper mark, and product wordmark into one small SVG asset family.

Recommended wordmark treatment:

- lowercase `plasmon`;
- medium weight, approximately 520–560 where the font supports it;
- tight tracking around `-0.05em` for the large wallpaper treatment;
- no glow or neon effects;
- wallpaper opacity `0.10–0.14`;
- bright full-opacity wordmark only in explicit branding contexts, not persistent chrome.

For MVP, the GUI1 CSS geometry is safe to adapt as an internal Plasmon-owned visual reference while a canonical SVG is prepared.

---

## 9. Icon canvas/sizing system

The icon system separates **cell**, **frame**, and **artwork**. Source artwork should never be allowed to define layout dimensions.

| Context | Cell/row | Icon frame | Max artwork |
|---|---:|---:|---:|
| Desktop | `92x90px` | `48px` | `42px` |
| FileManager grid | approx. `96–104px` cell | `44px` | `38px` |
| FileManager list/details | `32–36px` row | `26px` | `22px` |
| Start | `40–44px` row | `32px` | `28px` |
| Search result | `40–44px` row | `30px` | `26px` |
| Taskbar | `38–40px` button | `30px` | `26px` |
| Window titlebar | `38px` titlebar | `18px` | `16px` |
| Properties hero | — | `56px` | `46px` |
| Context menu | `28–32px` row | `20px` | `16px` |

### Optical sizing

Max artwork is a ceiling, not a mandate. Circular marks and sparse line icons may need 1–2px additional optical size; dense square native icons may need 1–2px less. The shared primitive should support a small per-asset optical inset but should not allow arbitrary component-specific sizing.

### Frames

Application icons and thumbnails may use a subtle common frame when useful. File/folder vectors do not need a rounded rectangle behind every icon. The shared frame should be low contrast and should never overpower native artwork.

---

## 10. Folder icon direction

Create an original Plasmon folder SVG with an immediately recognizable folder silhouette:

- broad folder body;
- visible upper tab;
- modest perspective/depth only if it survives at `22px`;
- dark teal body with a lighter teal top plane/edge;
- subtle neutral outline for contrast against wallpaper and windows.

Do not use the current `▰` glyph and do not require the Windows yellow-folder convention.

Recommended states:

- **closed/default:** base SVG;
- **open:** optional later variation for an actively browsed directory;
- **selected:** outer resource selection frame, not a recolored folder;
- **drop target:** outer accent border/glow, optionally open-folder variant if available.

For MVP, one high-quality closed folder asset plus shared selection/drop states is sufficient.

---

## 11. Text/Markdown icon direction

### Text

Replace `≡` with a real document silhouette. Use a vertically oriented page, one small folded corner or top treatment, and two or three short interior text strokes. The page silhouette must remain visible at list size so the lines read as content inside a document rather than a standalone hamburger menu.

### Markdown

Use the same document family so Markdown clearly belongs to text documents. Distinguish it with a small `MD` inset/badge or a simple markdown-derived mark inside the page. Avoid `M↓`; it reads as an action rather than a file type.

Do not encode semantic state using arbitrary file colors. Type color can be mildly different, but silhouette and interior mark should do most of the recognition work.

---

## 12. `.sys` icon family

Plasmon should own a coherent original SVG family for system applications. Use one stroke/shape grammar, a dark neutral/teal base, and one restrained accent. Avoid letters as the primary identity.

Recommended concepts:

| App | Direction |
|---|---|
| `FileManager.sys` | Folder with a small inset pane/list cue |
| `Settings.sys` | Clean gear/cog with simple center |
| `Start.sys` | Compact Plasmon geometric mark / launcher motif |
| `Search.sys` | Magnifier with Plasmon-proportioned stroke |
| `Photos.sys` | Photo frame / mountain-and-sun or stacked photos |
| `Browser.sys` | Globe/compass/navigation mark |
| `RecycleBin.sys` | Recognizable waste/recycle container; optional empty/full variants later |
| `.Properties.sys` | Document with sliders/details cue; intentionally subtle |

Build the family on one internal design grid, for example 24 logical units with approximately 1.6–1.8 unit strokes where appropriate. Export SVGs with consistent viewBoxes and transparent padding.

`.Properties.sys` being hidden does not justify a lower-quality icon; it appears in windows, Open With, diagnostics, and management surfaces.

---

## 13. `.neutron` native icon presentation

The native icon is the application's identity and takes precedence over Plasmon fallback artwork.

Rules:

- Agent 8 resolves/discovers/caches the native icon source.
- Agent 11 defines only the presentation primitive.
- Render the source unchanged.
- Never apply monochrome recoloring, accent masks, hue rotation, or theme tinting.
- Preserve transparency.
- Use fixed Plasmon frame dimensions with `object-fit: contain` or equivalent.
- Keep aspect ratio.
- If the source has unusual intrinsic padding, use optical inset metadata only when necessary; do not crop it to compensate.
- If loading fails, fall back to a neutral generated application placeholder without changing the resource label or behavior.

A subtle shared frame may be used behind native icons, especially on the desktop, but it should be neutral enough that colorful developer artwork remains dominant.

---

## 14. Generic file-type strategy

Do not create hundreds of MIME-specific icons for MVP. Use a small original family with strong silhouettes and a type-specific interior cue.

| Type | Presentation |
|---|---|
| Generic file | Neutral page/document |
| Text/source | Text document; source may add small code brackets later |
| Markdown | Text family + `MD` cue |
| Image | Thumbnail first; image glyph fallback |
| Video | Thumbnail first when available; film/play glyph fallback |
| Audio | Audio waveform/note in file silhouette |
| Archive | Archive box/zipper cue |
| Game/ROM | Cartridge/controller-inspired document cue |
| DOS bundle | Small terminal/window or disk/package cue |
| Shortcut | Target's normal icon plus shortcut overlay |
| Atom | Original Plasmon Atom mark, distinct from generic app icon |

The family should share stroke width, corner treatment, and baseline. File-type accent colors should remain subordinate to semantic recognition.

---

## 15. Shortcut overlay

A shortcut is **target identity + shortcut modifier**, not its own primary icon.

Design an original small overlay inspired by familiar desktop conventions without copying Microsoft's artwork:

- lower-left placement by default;
- small rounded or shield-like backing plate;
- dark translucent backing plus light border so it survives both light and dark source art;
- simple diagonal outgoing/turning arrow;
- approximately `12–14px` on desktop/grid icons and `8–10px` on list/search-size icons;
- never cover the source icon's visual center.

Examples:

- shortcut to `FileManager.sys` = FileManager icon + overlay;
- shortcut to `Mail.neutron` = Mail's native icon + overlay;
- shortcut to `/Apps` = folder icon + overlay;
- shortcut to Doom = game/target icon + overlay;
- URL shortcut = browser/site identity when known + overlay, otherwise browser/link fallback + overlay.

The current standalone `↗` shortcut glyph should become only a last-resort unresolved-target cue, not the normal shortcut presentation.

---

## 16. Thumbnails

Create one shared `MediaThumbnail` presentation used by Desktop, FileManager, Search, Properties, and later media pickers.

### Core rule

```css
object-fit: contain;
```

Never crop an image merely to fill a square icon slot.

### Frame

- fixed context-specific frame from the icon canvas system;
- neutral dark matte behind the content;
- very subtle border to define transparent images;
- centered content;
- preserve aspect ratio and transparency;
- no excessive radius on the source itself; frame may use the common icon-frame radius.

Portrait, landscape, transparent PNG, SVG, and GIF should therefore all look intentional.

The current `object-fit: cover` in `polish.scss` should be replaced during Agent 5 integration.

### Properties

Properties should consume the same thumbnail/icon primitive at its larger `56/46px` presentation rather than owning another glyph system.

### Video

When a video thumbnail is available, treat it exactly like an image thumbnail and optionally add a small translucent play affordance. When unavailable or unsupported, use the shared video file icon. Media decoding/frame extraction is outside Agent 11 ownership.

---

## 17. Hidden-resource presentation

When hidden resources are shown, make them visually subordinate but readable.

Recommended treatment:

```text
icon/art opacity: ~0.58
label opacity: ~0.70
saturation: ~0.65
```

Do not make the item fully disabled, strike it out, or reduce opacity so far that the filename cannot be read. Hover, selection, and keyboard focus should temporarily restore enough contrast to satisfy interaction clarity.

Leading-dot semantics and the decision of what is hidden belong to Agent 10/filesystem semantics; this section defines appearance only.

---

## 18. Desktop states

| State | Treatment |
|---|---|
| Normal | Transparent item; normal icon and label |
| Hover | Approx. 5–7% light surface + subtle 1px border |
| Selected | Teal selection fill + selection border; no giant opaque card |
| Keyboard focus | Independent 2px focus ring or clearly stronger border; visible whether selected or not |
| Active/open | Do not badge ordinary files; application runtime state belongs primarily to taskbar |
| Dragging | Approx. 0.85 opacity, slightly stronger shadow, preserve icon identity |
| Drop target | Accent border + low-opacity glow/fill; folder may optionally use open variant |
| Disabled | Only for genuinely unavailable actions/resources; use disabled token |
| Hidden | Hidden-resource treatment, not disabled treatment |

Do not add a permanent selected checkmark bubble to desktop items. Selection is already communicated by the selection frame and should remain visually lightweight.

Desktop labels should default to one line with ellipsis. When selected or renaming, allowing additional lines is reasonable as long as the cell does not permanently become a large card.

---

## 19. FileManager states

FileManager must use the same resource visual primitives as Desktop.

### Grid

Keep grid density close to current/GUI1 dimensions but use the shared `44/38px` icon frame/art. Selection should use the teal semantic tokens rather than the current bright blue palette.

### List/details

Rows should remain `32–36px` high where possible. Icon frames are `26px`, artwork approximately `22px`. Metadata stays secondary and compact. Avoid large vertical padding.

### Hover/selection/focus

Use the same state hierarchy as Desktop:

- hover = subtle neutral surface;
- selected = accent-tinted surface + border;
- keyboard focus = explicit focus ring independent of selection;
- drag target = accent edge/glow;
- disabled = only true unavailable state.

Rename fields may use the focus accent without introducing another blue color family.

---

## 20. Start/Search visual model

Start and Search should look like two modes of one shell system.

### Panel

- `10–12px` radius;
- dark translucent panel background;
- restrained border and one panel shadow;
- approximately `560–620px` default width on desktop, responsive downward;
- `12–14px` interior padding rather than dashboard-scale `18–24px` padding.

### Search field

Compact field, approximately `38–40px` high, with the shared Search system icon. Use accent focus edge/ring only while focused.

### Rows

- target height approximately `40–44px`;
- shared `ResourceIcon`/thumbnail primitive;
- primary label 12.5–13px;
- secondary metadata 10.5–11.5px;
- no separate Search-only icon grammar;
- no oversized app cards for normal result lists.

### Resource identity

Folders, native Plasmon apps, Neutron apps, files, thumbnails, shortcuts, Atoms, and hidden resources must look the same in Search as they do elsewhere, scaled only to the Search context.

The filesystem behavior of Start remains unchanged; this document changes presentation only.

---

## 21. Taskbar model

GUI1 is the primary density reference.

Recommended dimensions:

- taskbar height: `52px`;
- task buttons: `38–40px`;
- gaps: `2–3px`;
- app icon frame: `30px`;
- native artwork: max `26px`;
- Start mark: approximately `26–28px` visual size;
- system/tray icons: `18–20px`;
- clock: `10.5–11px`, two compact lines if date is shown.

### State language

- **Pinned, not running:** icon is simply present; no runtime line.
- **Running, not active:** short 2–3px accent indicator under icon.
- **Active/focused:** subtle button surface plus a brighter/longer running indicator.
- **Launching:** runtime indicator pulses or sweeps; icon itself does not flash red or become disabled.
- **Error:** transient shell error UI, not the same geometry as launching.

Do not render literal `Running: yes`, `Running: no`, or a `yes/no` badge in normal taskbar presentation.

### Context menu

Use a small original monochrome pin glyph aligned to the same context-menu icon column as other actions. Pin/unpin should not be red because it is not destructive.

---

## 22. Pin/running/active state distinctions

These concepts must remain orthogonal.

| Concept | Meaning | Visual signal |
|---|---|---|
| Pinned | Persistent taskbar preference | Presence in taskbar while not running; no badge required |
| Running | Process/Element has runtime presence | Short accent line |
| Active | Currently focused/foreground | Subtle button background + stronger running line |
| Launching | Start requested, runtime not ready | Animated/pulsing line |
| Selected | UI item chosen in a list/desktop | Selection fill/border; unrelated to runtime |
| Error | Launch/action failed | Error toast/banner/status; danger color |

The pin glyph belongs in menus/settings where the action is performed, not as a permanent red badge on every pinned item.

---

## 23. Window chrome

Keep the real current window manager. Apply only appearance.

### Normal focused window

- `10px` radius;
- `38px` titlebar;
- `18px` icon frame / `16px` art;
- dark translucent/elevated titlebar;
- strong but soft shadow;
- subtle strong border;
- title at `12px`, weight 600.

### Unfocused

Reduce shadow strength and title/icon prominence slightly. Do not make the entire window disabled or drastically transparent.

### Maximized

Use edge-appropriate radius (`0` when flush to viewport; at most a few pixels if the window manager deliberately preserves an inset). This must follow current geometry semantics rather than reintroducing GUI1 window logic.

### Controls

Keep familiar minimize/maximize/close geometry and compact targets around `40–42px` wide by titlebar height. Close hover may use danger red; normal controls remain neutral.

### Modal/dialog

Use elevated panel/window tokens, approximately `10px` radius, strong border, and a dim backdrop. Avoid multiple nested faux titlebars inside a real native window.

---

## 24. Dialog/system-app styling

System dialogs and `.sys` apps should consume the same theme and primitives instead of creating local chrome.

Recommended shared building blocks:

- `SystemSurface` / semantic background tokens;
- `ResourceIcon` / `MediaThumbnail`;
- compact form controls;
- consistent primary/secondary/destructive buttons;
- shared menu row and context-menu icon columns;
- common heading/metadata typography.

### Properties

Correct hierarchy once its launch/title issue is fixed elsewhere:

1. one window titlebar owned by windowing;
2. Properties content begins with large resource icon/thumbnail and editable name;
3. compact key/value details beneath;
4. “Opens with” consumes the actual application icon through the shared app icon primitive;
5. no second application-title presentation inside the content.

### Open With

List rows should show each handler's actual native/system application icon. Replace `⚛`/`◆` placeholders once the shared icon plumbing is available.

---

## 25. Version-display recommendation

**Recommendation: do not show application versions in everyday Desktop, Start, Search, or taskbar labels.**

Versions are useful when the user is managing or diagnosing software, but they add visual noise during ordinary launching and navigation. Show them in:

- Properties;
- installed-app/settings management;
- uninstall/update interfaces;
- detailed application information;
- troubleshooting/diagnostics.

GUI1's small version metadata demonstrated that versions can be visually unobtrusive, but the better product hierarchy is to omit them from normal labels rather than spend density on information rarely needed at launch time.

This remains a documented recommendation, not a frozen filesystem/application contract.

---

## 26. Implementation primitives/tokens

Keep the visual system lightweight. No Material UI or similarly large design-system dependency is justified.

Recommended primitives:

### `ResourceIcon`

Receives semantic resource presentation plus context size. Chooses the correct file-type/system/native/thumbnail/shortcut composition without owning resource semantics.

### `IconFrame`

Normalizes source dimensions, background/frame, optical inset, aspect ratio, and context sizes.

### `NativeAppIcon`

Thin specialization that presents Agent 8's resolved `.neutron` icon unchanged with `contain` behavior and a neutral fallback.

### `SystemIcon`

Renders original Plasmon SVG system assets at the context's standard stroke/size.

### `FileTypeIcon`

Maps an already-classified visual file type to an original Plasmon SVG. It must not redefine filesystem semantics.

### `ShortcutOverlay`

Composes on top of an existing `ResourceIcon` without replacing the base icon.

### `MediaThumbnail`

Owns aspect-preserving fit, matte/background, transparency treatment, image failure fallback, and optional media overlay.

### `SelectableResource`

A CSS/state primitive rather than a heavyweight component where possible. Provides shared normal/hover/selected/focus/drag/drop states.

### `RuntimeIndicator`

Small taskbar-only visual primitive for running/active/launching distinctions.

### Theme tokens

`os/integration/visual-tokens.scss` should be the semantic source of truth. Shell/FileManager/native app style files may expose component aliases but should not recreate independent colors and global dimensions.

---

## 27. Asset/licensing plan

### Existing Plasmon assets

Plasmon-owned GUI1 CSS geometry and repository assets may be adapted internally, subject to the repository's own licensing and project ownership.

### Windows/macOS

Use them only as interaction/proportion references. Do not ship copied Windows or macOS icons, shortcut badges, folder art, or system symbols.

### daedalOS

Use daedalOS as a behavioral/layout reference for desktop sizing, shortcut overlays, thumbnails, and familiar filesystem presentation. Do not import its artwork merely because it looks familiar. If any source asset or code is later proposed for reuse, verify its exact upstream license and attribution obligations before integration.

### External icon libraries

No external icon library is required for this MVP. Original Plasmon `.sys`, folder, file-type, shortcut, and Atom SVGs will produce a more coherent identity and avoid mixing families. If the team later chooses an open-source icon base, select one library, pin the version, verify the upstream license, preserve required notices, and customize consistently rather than mixing multiple sets.

### Inter

Do not add an untracked font binary. If Inter is bundled later, include the chosen upstream license/notice in the package and ensure the font actually ships inside the Neutron package. Until then, preserve a robust system fallback.

### Native Neutron icons

These are application-provided content resolved by Agent 8. Plasmon does not take ownership of, recolor, or replace them.

---

## 28. Exact GUI1 assets/code worth adapting

### `apps/plasmon/src/desktop.scss`

Adapt the following visual ideas/numerical relationships into current components:

- `.pl-os` teal/green palette direction;
- `.pl-desktop-surface` layered teal wallpaper base;
- `.pl-wallpaper-glow*` low-frequency geometry;
- `.pl-wallpaper-wordmark` lower-right identity treatment;
- `.pl-mark` geometric Plasmon mark;
- `.pl-desktop-icons` density and spacing;
- `.pl-desktop-icon` approximately `92x90` cell;
- `.pl-desktop-icon__glyph` approximately `46x46` artwork frame concept;
- desktop `11.5px` label scale;
- subtle hover border/container treatment;
- image `object-fit: contain` rule;
- `.pl-window` translucent dark window treatment;
- `38px` titlebar density;
- `52px` taskbar and roughly `40px` launcher targets;
- approximately `29px` taskbar app icon presentation;
- the short running indicator and launching pulse distinction.

### `apps/plasmon/src/desktop-overrides.scss`

The restrained `5px` control radii and approximately `10px` dialog radius are useful density references. Do not restore the file as a global override layer merely for historical fidelity.

### `apps/plasmon/src/style.scss`

Keep the Inter-first/system fallback typography direction. Do not reuse its earlier dashboard/sidebar layout as the OS shell.

### `apps/plasmon/src/DesktopShell.tsx`

Useful concepts only:

- wallpaper mark/glow markup;
- native image containment/fallback philosophy;
- compact desktop/taskbar composition as a visual reference.

### `apps/plasmon/public/static/icon.svg`

Its dark background and green accent remain compatible with the theme, but the ring icon should be treated as a related package icon, not as proof that the GUI1 wallpaper geometric mark should be discarded.

---

## 29. Exact GUI1 code that should **not** be restored

Do not restore:

- `DesktopShell.tsx` as the active shell architecture;
- its local demo window state and demo applications;
- mock Atom lists or mock runtime state;
- its private window/focus/minimize/maximize implementation;
- old platform snapshot/preview state as OS truth;
- hard-coded conventional `static/icon.svg` probing once Agent 8's resolver is responsible for icon discovery;
- single-letter/symbol fallback icons as the finished system icon family;
- version subtitles under ordinary desktop application labels;
- the old `.pl-os` component/state ownership model;
- old Start/control-center mock application structures;
- the dashboard/sidebar `.plasmon-shell` layout from legacy `style.scss`;
- any GUI1 code that bypasses current filesystem, process, association, window, Shell, or Neutron contracts.

The visual system is a translation of GUI1's design principles into current architecture, not a component rollback.

---

## 30. Migration plan from current visual implementation

### Stage 0 — shared token proof — Agent 11 — complete on this branch

Expand `visual-tokens.scss` into the semantic palette/density/icon-canvas vocabulary while retaining current aliases. No broad component restyle.

### Stage 1 — Shell identity

Agent 6:

- make `shell.scss` consume shared tokens rather than own a second palette;
- restore GUI1-like wallpaper and wordmark;
- move taskbar to compact dimensions;
- remove literal runtime text badges;
- replace pin emoji with shared system pin icon;
- apply shared row/icon sizing in Start/Search.

Agent 11 supplies shared wallpaper/logo/icon assets and token adjustments.

### Stage 2 — Desktop/FileManager resource presentation

Agent 5:

- make desktop FileManager background transparent;
- replace local blue selection/focus/drop colors with semantic tokens;
- consume `ResourceIcon`/`MediaThumbnail`/shortcut overlay;
- switch thumbnails from `cover` to `contain`;
- remove persistent selection check bubble if no accessibility requirement depends on it;
- retain current selection, drag, rename, clipboard, and filesystem behavior.

### Stage 3 — icon assets and Neutron identity

Agent 11 produces original `.sys`, folder, text/Markdown, generic file-type, shortcut overlay, and Atom assets plus shared presentation primitives.

Agent 8 continues to own native `.neutron` discovery/resolution/caching only.

Agents 5 and 6 consume Agent 8's native icon source through the Agent 11 presentation primitive.

### Stage 4 — native apps, windows, dialogs

Agent 7 adopts shared tokens/primitives in native applications. Windowing consumes shared titlebar/window tokens without changing behavior. Properties/Open With adopt shared resource/app icon presentation.

### Stage 5 — polish and validation

- optical icon sizing review at 100%, 125%, 150%, and high-DPI rendering;
- crowded desktop and sparse desktop wallpaper validation;
- keyboard focus pass;
- transparent image/SVG/GIF thumbnail pass;
- varied native `.neutron` icon aspect ratio pass;
- reduced-motion pass;
- packaged font verification.

---

## 31. Work split by implementation owner

### Agent 11 — shared visual system

Own:

- semantic theme tokens;
- wallpaper/logo/wordmark assets;
- original `.sys` icon family;
- original folder/text/Markdown/generic file assets;
- shared icon canvas and `IconFrame`/`ResourceIcon` presentation;
- thumbnail presentation primitive;
- shortcut overlay primitive;
- shared selection/focus visual spec;
- visual documentation and asset/license inventory.

Do not own filesystem semantics or Neutron icon discovery.

### Agent 5 — Desktop/FileManager

Apply:

- shared file/folder icons;
- shared thumbnail sizing/contain behavior;
- shortcut overlays;
- desktop/grid/list selection and focus states;
- visual rename layout;
- transparent desktop surface over Shell wallpaper.

Do not change resource semantics as part of styling.

### Agent 6 — Shell

Apply:

- default wallpaper/wordmark;
- compact taskbar;
- Start/Search shared resource visuals;
- pin glyph and alignment;
- pinned/running/active/launching distinctions;
- shell flyout surfaces and density.

Do not change process/window semantics.

### Agent 7 — native Plasmon applications

Consume:

- shared tokens;
- shared forms/menu typography where applicable;
- shared file/resource icons where apps display filesystem content;
- native window chrome supplied by windowing rather than app-specific faux chrome.

Do not create an unrelated per-app theme.

### Agent 8 — Neutron icons

Own only discovery, resolution, validation, and caching of native `.neutron` icon sources. Do not recolor, replace, or cosmetically normalize developer artwork beyond safe source handling.

### Agent 10 — filesystem semantics

Define what `.sys`, `.neutron`, shortcut, hidden, protected, directory, Atom, and related resource semantics mean. Agent 11 adapts visuals if those semantics change.

---

## 32. MVP versus later polish

### MVP implementation packages

| Package | Desired | Size | Primary owner(s) | Notes |
|---|---|---|---|---|
| Default shared theme identity/token adoption | **MUST** | Medium | 11 + 5/6/7 | Remove competing local palette ownership |
| GUI1-like wallpaper + logo/wordmark | **MUST** | Small | 11 + 6 | Shell owns wallpaper |
| Shared icon canvas/primitives | **MUST** | Medium | 11 | Foundation for all resource surfaces |
| Better desktop/grid/list icon sizing | **MUST** | Small | 11 + 5 | Use context sizes in section 9 |
| New folder icon | **MUST** | Small | 11 + 5 | Original Plasmon SVG |
| New text/Markdown icon | **MUST** | Small | 11 + 5 | Replace hamburger/action-like glyphs |
| Proper target-preserving shortcut overlay | **MUST** | Medium | 11 + 5/6 | Shared composition |
| Preserve native `.neutron` icons | **MUST** | Small | 8 + 11 + 6 | Agent 8 source; Agent 11 presentation |
| Shared aspect-preserving thumbnails | **MUST** | Small | 11 + 5 | Replace `cover` with `contain` |
| `.sys` icon family | **HIGH** | Medium | 11 | Required for finished OS feel |
| Taskbar pin/running/active/launching cleanup | **HIGH** | Medium | 6 + 11 | Remove emoji/runtime text |
| Start/Search icon unification | **HIGH** | Medium | 6 + 11 | Same `ResourceIcon` system |
| Desktop/FileManager state unification | **HIGH** | Medium | 5 + 11 | Teal selection/focus/drop |
| Packaged Inter decision/implementation | **HIGH** | Small–Medium | 11/build owner | Must verify packaging/license, not assume |
| Window/dialog visual convergence | **NORMAL** | Medium | window owner + 7/11 | Appearance only |
| Hidden-resource presentation | **NORMAL** | Small | 5 + 11 | Depends on Agent 10 semantics |
| Audio/archive/game/DOS fallback icons | **NORMAL** | Medium | 11 | Small reusable family |
| Polished vector pin/menu glyphs | **NORMAL** | Small | 11 + 6 | No emoji |
| Video frame extraction | **LATER** | Big | media implementation owner | Agent 11 only specifies thumbnail appearance |
| Open/animated folder variants | **LATER** | Small | 11 + 5 | Nice-to-have, not required for recognition |
| Extended high-DPI optical tuning | **LATER** | Medium | 11 | After complete asset family exists |

### MVP acceptance summary

The visual MVP is complete when a normal user can move between Desktop, FileManager, Start, Search, taskbar, Properties, and native windows and perceive one OS:

- the GUI1-derived teal identity is unmistakable;
- wallpaper/wordmark is present but quiet;
- icons are compact with visible breathing room;
- folder and text documents are immediately recognizable;
- native Neutron icons remain native;
- shortcuts preserve target identity;
- thumbnails never crop just to fill a square;
- selection/focus states are consistent;
- taskbar state is understandable without runtime text;
- ordinary UI does not show application versions.

### Later polish

Later work may add richer video thumbnails, open/full Recycle Bin variants, more file families, per-theme wallpaper variants, optical asset overrides, and additional animations. None of that should delay the MUST visual-system migration.

---

## Final architectural guardrail

This design intentionally changes no frozen contract and no OS architecture. It does not alter filesystem semantics, process/runtime behavior, window-manager behavior, Neutron ownership, MTN/sharing, or Kernel source. Current components remain the implementation targets; only their visual vocabulary is being unified.