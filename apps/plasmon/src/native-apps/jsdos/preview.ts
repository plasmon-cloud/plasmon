import { RESOURCE_PREVIEW_MAX_BYTES } from "../../os/fs/resourcePreview.ts";
import type { JsDosProgressPreview } from "./progress.ts";

export const JS_DOS_PREVIEW_MAX_WIDTH = 320;
export const JS_DOS_PREVIEW_MAX_HEIGHT = 200;
export const JS_DOS_PREVIEW_CAPTURE_TIMEOUT_MS = 750;

export interface PreviewDimensions {
  width: number;
  height: number;
}

export function boundedPreviewDimensions(
  width: number,
  height: number,
  maxWidth = JS_DOS_PREVIEW_MAX_WIDTH,
  maxHeight = JS_DOS_PREVIEW_MAX_HEIGHT,
): PreviewDimensions | null {
  if (![width, height, maxWidth, maxHeight].every((value) => Number.isFinite(value) && value > 0)) return null;
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function canvasPng(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(blob);
    };
    const timer = setTimeout(() => finish(null), JS_DOS_PREVIEW_CAPTURE_TIMEOUT_MS);
    try {
      canvas.toBlob((blob) => finish(blob), "image/png");
    } catch {
      finish(null);
    }
  });
}

/**
 * Capture a bounded presentation snapshot from a live js-dos canvas. Failure is
 * intentionally represented as null so save correctness never depends on
 * screenshot support, canvas origin cleanliness, or image encoding.
 */
export async function captureJsDosPreview(container: HTMLElement): Promise<JsDosProgressPreview | null> {
  const source = container.querySelector("canvas");
  if (!(source instanceof HTMLCanvasElement) || source.width <= 0 || source.height <= 0) return null;
  const base = boundedPreviewDimensions(source.width, source.height);
  if (!base) return null;

  for (const factor of [1, 0.75, 0.5]) {
    const width = Math.max(1, Math.round(base.width * factor));
    const height = Math.max(1, Math.round(base.height * factor));
    const output = document.createElement("canvas");
    output.width = width;
    output.height = height;
    const context = output.getContext("2d");
    if (!context) return null;
    try {
      context.drawImage(source, 0, 0, width, height);
    } catch {
      return null;
    }
    const blob = await canvasPng(output);
    if (!blob || blob.size <= 0 || blob.size > RESOURCE_PREVIEW_MAX_BYTES) continue;
    return {
      bytes: new Uint8Array(await blob.arrayBuffer()),
      mime: "image/png",
      width,
      height,
    };
  }

  return null;
}
