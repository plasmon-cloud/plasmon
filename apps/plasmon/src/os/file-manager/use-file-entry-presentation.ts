import { useEffect, useState, type RefObject } from "react";
import type { AssociationRegistry, FsNode, FsService } from "../contracts/index.ts";
import { useResourceThumbnail } from "../use-resource-thumbnail.ts";
import type { ResourceIconPresentation } from "../visual/index.ts";
import {
  fallbackFileResourcePresentation,
  fileVisualKind,
  tryResolveFileResourcePresentation,
  type FileVisualKind,
} from "./file-icons.ts";

export interface FileEntryResolvedPresentation {
  visualKind: FileVisualKind;
  iconPresentation: ResourceIconPresentation;
  shortcut: boolean;
}

/**
 * React/browser lifecycle adapter for the existing canonical FileManager
 * presentation resolver and shared resource-thumbnail loader. It owns no
 * resource classification table and never opens or mutates a resource.
 */
export function useFileEntryResolvedPresentation(
  fs: FsService,
  node: FsNode,
  associations: AssociationRegistry | undefined,
  entryRef: RefObject<HTMLDivElement | null>,
): FileEntryResolvedPresentation {
  const thumbnailUrl = useResourceThumbnail(fs, node, entryRef);
  const [resourcePresentation, setResourcePresentation] = useState(
    () => fallbackFileResourcePresentation(node, associations),
  );

  useEffect(() => {
    let active = true;
    // FileEntry is NodeId-keyed. Preserve its last resolved presentation while
    // authoritative FsNode snapshots re-resolve. If asynchronous shortcut
    // enrichment is temporarily unavailable, retaining the last-known artwork
    // is more truthful than publishing a generic fallback and then replacing it
    // again on the next successful refresh.
    void tryResolveFileResourcePresentation(fs, node, associations)
      .then((resolved) => {
        if (active && resolved) setResourcePresentation(resolved);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [associations, fs, node]);

  return {
    visualKind: fileVisualKind(node),
    iconPresentation: thumbnailUrl
      ? { kind: "thumbnail", src: thumbnailUrl, mediaKind: "image" }
      : resourcePresentation.presentation,
    shortcut: resourcePresentation.shortcut,
  };
}
