# Issue #93 — preserve image thumbnail aspect ratio

## Disposition

**ALREADY GREEN (deterministic/runtime path).** Current FileEntry image
thumbnails consume `ResourceIcon`/`MediaThumbnail`; the shared Visual stylesheet
uses `object-fit: contain`, and visual component tests assert the contain
contract. The older `.fm-entry__thumbnail { object-fit: cover }` selector is a
legacy/dead selector not used by the current FileEntry rendering path; no
source-shape RED is manufactured.

## Preserved behavior

- Image bytes, MIME inference, lazy loading, object URL cleanup, and fallback
  remain FileManager/thumbnail responsibilities.
- Shared Visual owns thumbnail framing and containment.
- Portrait, landscape, and square artwork fit within bounded icon frames without
  distortion; exact pixels are not frozen.

## Existing evidence

`src/os/file-manager/thumbnail.ts`, `file-icons.test.ts`,
`src/os/visual/presentation.ts`, `visual.components.test.tsx`, and
`visual/visual.scss` provide the lowest truthful deterministic guards. A human
visual review may still inspect representative artwork, but no missing
architecture-independent behavior remains on this branch.
