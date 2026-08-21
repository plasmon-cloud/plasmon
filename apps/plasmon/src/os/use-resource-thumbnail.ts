import { useEffect, useState, type RefObject } from "react";
import type { FsNode, FsService } from "./contracts/index.ts";
import { readResourcePreviewMetadata } from "./fs/resourcePreview.ts";
import {
  canLoadImageThumbnail,
  loadResourceThumbnail,
  type LoadedImageThumbnail,
} from "./resource-thumbnail.ts";

/**
 * Browser lifecycle adapter for bounded filesystem thumbnails. The loader owns
 * no classification policy beyond the canonical filesystem classifier and the
 * returned object URL is revoked on replacement or unmount.
 */
export function useResourceThumbnail(
  fs: FsService,
  node: FsNode | null,
  elementRef: RefObject<HTMLElement | null>,
): string | null {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let observer: IntersectionObserver | null = null;
    let loaded: LoadedImageThumbnail | null = null;
    if (!node) {
      setThumbnailUrl(null);
      return undefined;
    }

    const hasReferencedPreview = readResourcePreviewMetadata(node) !== null;
    const canLoadOwnImage = canLoadImageThumbnail(node);
    if (!hasReferencedPreview && !canLoadOwnImage) {
      setThumbnailUrl(null);
      return undefined;
    }

    const load = () => {
      void loadResourceThumbnail(fs, node)
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

    const element = elementRef.current;
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
  }, [
    fs,
    node?.contentHash,
    node?.id,
    node?.metadata,
    node?.mime,
    node?.modifiedAt,
    node?.name,
    node?.size,
    elementRef,
  ]);

  return thumbnailUrl;
}
