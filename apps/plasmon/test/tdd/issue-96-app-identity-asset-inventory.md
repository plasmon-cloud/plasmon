# #96 application identity asset inventory (post-#190)

Audit base: PR #211 head `b66081630d6edc57f913b07cde7beabdf02bdefe`.

| app | canonical metadata at #211 | packaged candidate asset | #190 consumer status | disposition |
|---|---|---|---|---|
| Text Editor | generated `data:image/svg+xml` in `content-apps.ts` | `public/static/plasmon/icons/text.svg` exists but is not referenced by metadata | shared seam ready | **FULL/CORE RED** |
| Markdown | generated `data:image/svg+xml` in `content-apps.ts` | `public/static/plasmon/icons/markdown.svg` exists but is not referenced by metadata | shared seam ready | **FULL/CORE RED** |
| Photos | generated `data:image/svg+xml` in `content-apps.ts` | `public/static/plasmon/icons/photos.svg` exists but is not referenced by metadata | shared seam ready | **FULL/CORE RED** |
| Video Player | generated `data:image/svg+xml` in `content-apps.ts` | `public/static/plasmon/icons/video.svg` exists but is not referenced by metadata | shared seam ready | **FULL/CORE RED** |
| Browser | generated `data:image/svg+xml` in `content-apps.ts` | `public/static/plasmon/icons/browser.svg` exists but is not referenced by metadata | shared seam ready | **FULL/CORE RED** |
| Settings | generated `data:image/svg+xml` in `content-apps.ts` | `public/static/plasmon/icons/settings.svg` exists but is not referenced by metadata | shared seam ready | **FULL/CORE RED** |
| Explorer | `SYSTEM_ICON_ASSETS["file-manager"]` | shared packaged SVG | migrated through shared seam | characterize / not #96 core |
| Properties | `SYSTEM_ICON_ASSETS.properties` | shared packaged SVG | migrated through shared seam | characterize / not #96 core |
| Recycle Bin | `SYSTEM_ICON_ASSETS["recycle-bin"]` | shared packaged SVG | migrated through shared seam | characterize / not #96 core |
| js-dos | inline `DOS` glyph | runtime asset exists | runtime-only; #48/#202/#121 boundary | excluded |
| EmulatorJS | inline controller glyph | runtime asset exists | runtime-only; #48/#202/#121 boundary | excluded |

#190 owns the shared `ResourceIcon`/resolver/consumer and fallback architecture.
#96 owns only first-party user-launchable application identity references and
packaged offline asset metadata. It must not create a second icon map, prescribe
artwork pixels, alter IDs/associations, or make accessibility labels depend on
decorative pixels.
