import { useEffect, useState, type RefObject } from "react";
import type { AssociationRegistry, FsNode, FsService } from "../contracts/index.ts";
import { readResourcePreviewMetadata } from "../fs/resourcePreview.ts";
import type { ResourceIconPresentation } from "../visual/index.ts";
import {
  fallbackFileResourcePresentation,
  fileVisualKind,
  tryResolveFileResourcePresentation,
  type FileVisualKind,
} from "./file-icons.ts";
import {
  canLoadImageThumbnail,
  loadImageThumbnail,
  loadResourcePreviewThumbnail,
  type LoadedImageThumbnail,
} from "./thumbnail.ts";

export interface FileEntryResolvedPresentation {
  visualKind: FileVisualKind;
  iconPresentation: ResourceIconPresentation;
  shortcut: boolean;
}

/**
 * React/browser lifecycle adapter for the existing canonical FileManager
 * presentation resolver and image-thumbnail loader. It owns no resource
 * classification table and never opens or mutates a resource.
 */
export function useFileEntryResolvedPresentation(
  fs: FsService,
  node: FsNode,
  associations: AssociationRegistry | undefined,
  entryRef: RefObject<HTMLDivElement | null>,
): FileEntryResolvedPresentation {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
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

  useEffect(() => {
    let active = true;
    let observer: IntersectionObserver | null = null;
    let loaded: LoadedImageThumbnail | null = null;
    const hasReferencedPreview = readResourcePreviewMetadata(node) !== null;
    const canLoadOwnImage = canLoadImageThumbnail(node);
    if (!hasReferencedPreview && !canLoadOwnImage) {
      setThumbnailUrl(null);
      return undefined;
    }

    const load = () => {
      void (async () => {
        const thumbnail = hasReferencedPreview
          ? await loadResourcePreviewThumbnail(fs, node)
          : null;
        return thumbnail ?? (canLoadOwnImage ? loadImageThumbnail(fs, node) : null);
      })()
        .then((thumbnail) => {
          if (!thumbnail) {
            if (active) setThumbnailUrl(null);
            return;
          }
          if (!active) {
            thumbnail.revoke();
            return;
          }
          loaded?.revoke();
          loaded = thumbnail;
          setThumbnailUrl(thumbnail.url);
        })
        .catch(() => {
          if (active) setThumbnailUrl(null);
        });
    };

    const element = entryRef.current;
    if (typeof IntersectionObserver === "undefined" || !element) {
      load();
    } else {
      observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer?.disconnect();
        observer = null;
        load();
      }, { rootMargin: "96px" });
      observer.observe(element);
    }

    return () => {
      active = false;
      observer?.disconnect();
      loaded?.revoke();
    };
  }, [fs, node.contentHash, node.id, node.metadata, node.mime, node.modifiedAt, node.name, node.size, entryRef]);

  return {
    visualKind: fileVisualKind(node),
    iconPresentation: thumbnailUrl
      ? { kind: "thumbnail", src: thumbnailUrl, mediaKind: "image" }
      : resourcePresentation.presentation,
    shortcut: !thumbnailUrl && resourcePresentation.shortcut,
  };
}
