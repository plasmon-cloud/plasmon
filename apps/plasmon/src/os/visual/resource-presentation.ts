import type { ResourceClassification } from "../fs/resourcePolicy.ts";
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

export function isImageResourceReference(value: string | null | undefined): value is string {
  return !!value && /^(?:https?:|data:image\/|\/|\.\.?\/)/u.test(value);
}

export function applicationResourcePresentation(src?: string | null): ResourceIconPresentation {
  return { kind: "application", src: isImageResourceReference(src) ? src : null };
}

/** Visual identity for an already-authoritative native handler. */
export function nativeHandlerResourcePresentation(
  handlerId: string,
  registeredIcon?: string | null,
): ResourceIconPresentation {
  if (isImageResourceReference(registeredIcon)) return applicationResourcePresentation(registeredIcon);
  return NATIVE_PRESENTATION_BY_HANDLER[handlerId] ?? applicationResourcePresentation();
}

/**
 * Maps an already-produced #189 classification to the shared Visual vocabulary.
 * This module never classifies resources, reads filesystem state, resolves
 * shortcuts, selects handlers, or inspects installation state.
 */
export function resourcePresentationForClassification(
  classification: ResourceClassification,
  options: { nativeIcon?: string | null } = {},
): ResourceIconPresentation {
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
