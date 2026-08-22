import { useEffect, useState, type RefObject } from "react";
import type { AssociationRegistry, FsNode, FsService } from "../contracts/index.ts";
import { readResourcePreviewMetadata } from "../fs/resourcePreview.ts";
import type { ResourceIconPresentation } from "../visual/index.ts";
import {
  fallbackFileResourcePresentation,
  fileVisualKind,
  resolveFileResourcePresentation,
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
  const [thumbnail, setThumbnail] = useState<LoadedImageThumbnail | null>(null);
  const [resourcePresentation, setResourcePresentation] = useState(
    () => fallbackFileResourcePresentation(node, associations),
  );

  useEffect(() => {
    let active = true;
    const fallback = fallbackFileResourcePresentation(node, associations);
    // FileEntry is NodeId-keyed. Preserve its last resolved presentation while
    // authoritative FsNode snapshots re-resolve instead of flashing back to the
    // generic shortcut fallback and cancelling an in-flight packaged icon load.
    void resolveFileResourcePresentation(fs, node, associations)
      .then((resolved) => {
        if (active) setResourcePresentation(resolved);
      })
      .catch(() => {
        if (active) setResourcePresentation(fallback);
      });
    return () => { active = false; };
  }, [associations, fs, node]);

  useEffect(() => {
    let active = true;
    let observer: IntersectionObserver | null = null;
    const hasReferencedPreview = readResourcePreviewMetadata(node) !== null;
    const canLoadOwnImage = canLoadImageThumbnail(node);
    if (!hasReferencedPreview && !canLoadOwnImage) {
      setThumbnail(null);
      return undefined;
    }

    const load = () => {
      void (async () => {
        const loaded = hasReferencedPreview
          ? await loadResourcePreviewThumbnail(fs, node)
          : null;
        return loaded ?? (canLoadOwnImage ? loadImageThumbnail(fs, node) : null);
      })()
        .then((loaded) => {
          if (!loaded) {
            if (active) setThumbnail(null);
            return;
          }
          if (!active) {
            loaded.revoke();
            return;
          }
          // Keep the previous lease alive until React commits this replacement.
          // Revoking it in this loading effect's cleanup can leave a still-rendered
          // <img> pointing at a revoked blob URL while FsNode snapshots re-resolve.
          setThumbnail(loaded);
        })
        .catch(() => {
          if (active) setThumbnail(null);
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
    };
  }, [fs, node.contentHash, node.id, node.metadata, node.mime, node.modifiedAt, node.name, node.size, entryRef]);

  // The rendered thumbnail owns its object URL. Cleanup therefore follows a
  // replacement/removal commit instead of racing ahead of the <img> lifecycle.
  useEffect(() => {
    if (!thumbnail) return;
    return thumbnail.revoke;
  }, [thumbnail]);

  return {
    visualKind: fileVisualKind(node),
    iconPresentation: thumbnail
      ? { kind: "thumbnail", src: thumbnail.url, mediaKind: "image" }
      : resourcePresentation.presentation,
    shortcut: !thumbnail && resourcePresentation.shortcut,
  };
}
