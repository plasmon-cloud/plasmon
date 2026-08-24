import { useEffect, useState, type RefObject } from "react";
import type { FsNode, FsService } from "./contracts/index.ts";
import { readResourcePreviewMetadata } from "./fs/resourcePreview.ts";
import {
  canLoadImageThumbnail,
  imageThumbnailMime,
  loadResourceThumbnail,
  type LoadedImageThumbnail,
} from "./resource-thumbnail.ts";

interface ThumbnailState {
  fs: FsService;
  elementRef: RefObject<HTMLElement | null>;
  sourceKey: string;
  url: string;
}

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
  const preview = node ? readResourcePreviewMetadata(node) : null;
  const ownImageMime = node ? imageThumbnailMime(node) : null;
  const canLoadOwnImage = node ? canLoadImageThumbnail(node) : false;
  const sourceKey = node
    ? JSON.stringify([
        node.id,
        node.name,
        node.size,
        node.modifiedAt,
        node.contentHash,
        preview?.nodeId ?? null,
        preview?.mime ?? null,
        preview?.byteSize ?? null,
        ownImageMime,
      ])
    : null;
  const [thumbnail, setThumbnail] = useState<ThumbnailState | null>(null);

  useEffect(() => {
    let active = true;
    let observer: IntersectionObserver | null = null;
    let loaded: LoadedImageThumbnail | null = null;
    if (!node || sourceKey === null) {
      setThumbnail(null);
      return undefined;
    }

    const hasReferencedPreview = preview !== null;
    if (!hasReferencedPreview && !canLoadOwnImage) {
      setThumbnail(null);
      return undefined;
    }

    const load = () => {
      void loadResourceThumbnail(fs, node)
        .then((nextThumbnail) => {
          if (!nextThumbnail) {
            if (active) setThumbnail(null);
            return;
          }
          if (!active) {
            nextThumbnail.revoke();
            return;
          }
          loaded?.revoke();
          loaded = nextThumbnail;
          setThumbnail({ fs, elementRef, sourceKey, url: nextThumbnail.url });
        })
        .catch(() => {
          if (active) setThumbnail(null);
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
  }, [fs, elementRef, sourceKey]);

  return thumbnail
    && thumbnail.fs === fs
    && thumbnail.elementRef === elementRef
    && thumbnail.sourceKey === sourceKey
    ? thumbnail.url
    : null;
}
