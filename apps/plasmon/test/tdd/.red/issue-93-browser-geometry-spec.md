# Issue #93 browser geometry specification

Classification: **BROWSER SPEC ONLY**. No active PR owns #93. Deterministic
thumbnail eligibility/object URL cleanup is already covered; this spec proves
actual rendered geometry through the installed Plasmon path.

## Production authority

`FileEntry` owns lazy thumbnail loading and cleanup through `loadImageThumbnail`;
`ResourceIcon`/`MediaThumbnail` owns resolved visual rendering; CSS/DOM owns
actual frame and image geometry. This test must not treat `object-fit: contain`
as sufficient evidence.

## Fixture matrix

Use authored SVGs through the real FileManager file input:

| Shape | Intrinsic ratio |
|---|---:|
| portrait | 40/120 |
| landscape | 120/40 |
| square | 80/80 |
| very wide | 240/30 |
| very tall | 30/240 |

For each image measure:

- thumbnail frame rectangle (`.plasmon-icon-frame--thumbnail`);
- rendered image rectangle (`.plasmon-media-thumbnail`);
- `naturalWidth`/`naturalHeight`;
- rendered width/height ratio;
- image rectangle contained within frame;
- source ratio preserved within browser rounding tolerance.

Also verify selection remains usable after thumbnail load and failed image input
falls back without leaving a broken image rectangle. The test must record
geometry, not only CSS declarations.
