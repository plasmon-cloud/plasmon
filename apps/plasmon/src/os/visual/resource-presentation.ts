import type { ResourceArtworkMetadata } from "../fs/resourceArtwork.ts";
import type { ResourceClassification } from "../fs/resourcePolicy.ts";
import {
  FILE_TYPE_ICON_ASSETS,
  SYSTEM_ICON_ASSETS,
  type FileTypeIconName,
  type SystemIconName,
} from "./assets.ts";
import type { ResourceIconPresentation } from "./primitives.tsx";

const FILE_PRESENTATION_BY_CONTENT: Readonly<Record<ResourceClassification["type"]["contentKind"], ResourceIconPresentation>> = Object.freeze({
  text: { kind: "file-type", icon: "text" },
  source: { kind: "file-type", icon: "text" },
  markdown: { kind: "file-type", icon: "markdown" },
  image: { kind: "file-type", icon: "image" },
  audio: { kind: "file-type", icon: "audio" },
  video: { kind: "file-type", icon: "video" },
  unknown: { kind: "file-type", icon: "file" },
});

const NATIVE_PRESENTATION_BY_HANDLER: Readonly<Record<string, ResourceIconPresentation>> = Object.freeze({
  "native:explorer": { kind: "system", icon: "file-manager" },
  "native:settings": { kind: "system", icon: "settings" },
  "native:photos": { kind: "system", icon: "photos" },
  "native:browser": { kind: "system", icon: "browser" },
  "native:properties": { kind: "system", icon: "properties" },
  "native:start": { kind: "system", icon: "start" },
  "native:search": { kind: "system", icon: "search" },
  "native:recycle-bin": { kind: "system", icon: "recycle-bin" },
  "native:text": { kind: "file-type", icon: "text" },
  "native:markdown": { kind: "file-type", icon: "markdown" },
  "native:video": { kind: "file-type", icon: "video" },
});

const SYSTEM_PRESENTATION_BY_ASSET = new Map<string, ResourceIconPresentation>(
  (Object.entries(SYSTEM_ICON_ASSETS) as Array<[SystemIconName, string]>).map(
    ([icon, src]) => [src, { kind: "system", icon }],
  ),
);
const FILE_PRESENTATION_BY_ASSET = new Map<string, ResourceIconPresentation>(
  (Object.entries(FILE_TYPE_ICON_ASSETS) as Array<[FileTypeIconName, string]>).map(
    ([icon, src]) => [src, { kind: "file-type", icon }],
  ),
);

export function isImageResourceReference(value: string | null | undefined): value is string {
  return !!value && /^(?:https?:|data:image\/|\/|\.\.?\/|[^/:?#]+\/)/u.test(value);
}

/**
 * Recognize only exact canonical Plasmon asset references. Arbitrary application
 * and .neutron icon URLs are deliberately not inferred as owned artwork.
 */
export function plasmonOwnedAssetPresentation(src?: string | null): ResourceIconPresentation | null {
  if (!src) return null;
  return SYSTEM_PRESENTATION_BY_ASSET.get(src) ?? FILE_PRESENTATION_BY_ASSET.get(src) ?? null;
}

export function applicationResourcePresentation(src?: string | null): ResourceIconPresentation {
  return { kind: "application", src: isImageResourceReference(src) ? src : null };
}

/**
 * Visual identity for an already-authoritative native handler.
 *
 * Known Plasmon first-party handlers intentionally resolve to owned semantic
 * artwork even when their registry metadata still contains a legacy packaged
 * SVG path. Treating that path as an arbitrary application image would render
 * it through <img>, isolating its hard-coded SVG colors from the Shell theme.
 * Unknown/native-extension handlers retain their registered authored image.
 */
export function nativeHandlerResourcePresentation(
  handlerId: string,
  registeredIcon?: string | null,
): ResourceIconPresentation {
  const owned = NATIVE_PRESENTATION_BY_HANDLER[handlerId];
  if (owned) return owned;
  if (isImageResourceReference(registeredIcon)) return applicationResourcePresentation(registeredIcon);
  return applicationResourcePresentation();
}

export interface ResourcePresentationOptions {
  nativeIcon?: string | null;
  artwork?: ResourceArtworkMetadata | null;
}

/**
 * Maps already-produced resource semantics and validated presentation metadata
 * to the shared Visual vocabulary. This module never reads filesystem state,
 * classifies resources, resolves shortcuts, selects handlers, or inspects
 * installation state.
 */
export function resourcePresentationForClassification(
  classification: ResourceClassification,
  options: ResourcePresentationOptions = {},
): ResourceIconPresentation {
  if (classification.kind === "ordinary-file" && options.artwork) {
    return { kind: "thumbnail", src: options.artwork.src, mediaKind: "image" };
  }

  switch (classification.kind) {
    case "directory":
      return { kind: "file-type", icon: "folder" };
    case "atom":
      return { kind: "file-type", icon: "atom" };
    case "system-app":
      return classification.systemApp
        ? nativeHandlerResourcePresentation(classification.systemApp.handlerId, options.nativeIcon)
        : applicationResourcePresentation(options.nativeIcon);
    case "neutron-app":
      return applicationResourcePresentation(classification.neutronApp?.icon);
    case "shortcut":
      return { kind: "file-type", icon: "file" };
    case "ordinary-file":
      return FILE_PRESENTATION_BY_CONTENT[classification.type.contentKind];
  }
}
