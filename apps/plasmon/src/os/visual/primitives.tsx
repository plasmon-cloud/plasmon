import { useState, type CSSProperties, type ReactNode } from "react";
import { type FileTypeIconName, type SystemIconName } from "./assets.ts";
import { OwnedFileTypeIcon, OwnedShortcutOverlay, OwnedSystemIcon } from "./owned-icon-art.tsx";
import { ICON_IMAGE_OBJECT_FIT, THUMBNAIL_OBJECT_FIT, resolveImagePresentation } from "./presentation.ts";
import { iconContextCssVariables, type IconContext } from "./sizing.ts";

export type IconFrameVariant = "standard" | "bare" | "thumbnail";

export interface IconFrameProps {
  context: IconContext;
  children: ReactNode;
  overlay?: ReactNode | undefined;
  className?: string | undefined;
  variant?: IconFrameVariant | undefined;
}

export function IconFrame({ context, children, overlay, className, variant = "standard" }: IconFrameProps) {
  const style = iconContextCssVariables(context) as unknown as CSSProperties;
  return (
    <span
      className={`plasmon-icon-frame plasmon-icon-frame--${variant}${className ? ` ${className}` : ""}`}
      data-icon-context={context}
      style={style}
      aria-hidden="true"
    >
      <span className="plasmon-icon-frame__art">{children}</span>
      {overlay}
    </span>
  );
}

export interface SystemIconProps {
  icon: SystemIconName;
  className?: string | undefined;
}

/** Plasmon-owned system artwork is inline SVG so inherited theme tokens reach its fills/strokes. */
export function SystemIcon({ icon, className }: SystemIconProps) {
  return <OwnedSystemIcon icon={icon} className={className} />;
}

export interface PinIconProps {
  pinned: boolean;
  className?: string | undefined;
}

/** Shared pin/unpin presentation; callers keep ownership of pin semantics and accessible labels. */
export function PinIcon({ pinned, className }: PinIconProps) {
  return (
    <span
      className={`plasmon-pin-icon${pinned ? " is-pinned" : ""}${className ? ` ${className}` : ""}`}
      data-pin-state={pinned ? "pinned" : "unpinned"}
      aria-hidden="true"
    >
      <SystemIcon icon="pin" />
      <span className="plasmon-pin-icon__state" />
    </span>
  );
}

export interface FileTypeIconProps {
  icon: FileTypeIconName;
  className?: string | undefined;
}

/** Plasmon-owned file-type artwork is inline SVG so inherited theme tokens reach its fills/strokes. */
export function FileTypeIcon({ icon, className }: FileTypeIconProps) {
  return <OwnedFileTypeIcon icon={icon} className={className} />;
}

export interface NativeAppIconProps {
  src?: string | null | undefined;
  fallback?: ReactNode | undefined;
  className?: string | undefined;
}

export function NativeAppIcon({ src, fallback = <SystemIcon icon="application" />, className }: NativeAppIconProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const presentation = resolveImagePresentation(src, failedSrc);
  if (presentation.kind === "fallback") return <>{fallback}</>;
  return (
    <img
      className={`plasmon-icon-art plasmon-native-app-icon${className ? ` ${className}` : ""}`}
      src={presentation.src}
      alt=""
      draggable={false}
      style={{ objectFit: ICON_IMAGE_OBJECT_FIT }}
      onError={() => setFailedSrc(presentation.src)}
    />
  );
}

export interface ShortcutOverlayProps {
  className?: string | undefined;
}

export function ShortcutOverlay({ className }: ShortcutOverlayProps) {
  return (
    <span className={`plasmon-shortcut-overlay${className ? ` ${className}` : ""}`} aria-hidden="true">
      <OwnedShortcutOverlay className="plasmon-icon-art" />
    </span>
  );
}

export type MediaThumbnailKind = "image" | "video";

export interface MediaThumbnailProps {
  src?: string | null | undefined;
  mediaKind?: MediaThumbnailKind | undefined;
  fallback?: ReactNode | undefined;
  className?: string | undefined;
}

export function MediaThumbnail({
  src,
  mediaKind = "image",
  fallback,
  className,
}: MediaThumbnailProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const presentation = resolveImagePresentation(src, failedSrc);
  const resolvedFallback = fallback ?? <FileTypeIcon icon={mediaKind} />;
  if (presentation.kind === "fallback") return <>{resolvedFallback}</>;
  return (
    <img
      className={`plasmon-icon-art plasmon-media-thumbnail${className ? ` ${className}` : ""}`}
      src={presentation.src}
      alt=""
      draggable={false}
      style={{ objectFit: THUMBNAIL_OBJECT_FIT }}
      onError={() => setFailedSrc(presentation.src)}
    />
  );
}

export type ResourceIconPresentation =
  | { kind: "system"; icon: SystemIconName }
  | { kind: "file-type"; icon: FileTypeIconName }
  | { kind: "application"; src?: string | null | undefined; fallback?: ReactNode | undefined }
  | { kind: "native"; src?: string | null | undefined; fallback?: ReactNode | undefined }
  | { kind: "thumbnail"; src?: string | null | undefined; mediaKind?: MediaThumbnailKind | undefined; fallback?: ReactNode | undefined }
  | { kind: "custom"; content: ReactNode };

export interface ResourceIconProps {
  context: IconContext;
  presentation: ResourceIconPresentation;
  shortcut?: boolean | undefined;
  className?: string | undefined;
  frameVariant?: IconFrameVariant | undefined;
}

function defaultFrameVariant(presentation: ResourceIconPresentation): IconFrameVariant {
  if (presentation.kind === "file-type" || presentation.kind === "system") return "bare";
  if (presentation.kind === "thumbnail") return "thumbnail";
  return "standard";
}

function ResourceArtwork({ presentation }: { presentation: ResourceIconPresentation }) {
  switch (presentation.kind) {
    case "system":
      return <SystemIcon icon={presentation.icon} />;
    case "file-type":
      return <FileTypeIcon icon={presentation.icon} />;
    case "application":
    case "native":
      return <NativeAppIcon src={presentation.src} fallback={presentation.fallback} />;
    case "thumbnail":
      return <MediaThumbnail src={presentation.src} mediaKind={presentation.mediaKind} fallback={presentation.fallback} />;
    case "custom":
      return <span className="plasmon-custom-icon">{presentation.content}</span>;
  }
}

/**
 * ResourceIcon intentionally consumes resolved presentation information only.
 * It does not inspect FsNode names, extensions, protection, hidden state,
 * .sys/.neutron suffixes, shortcut targets, or any other filesystem semantics.
 */
export function ResourceIcon({
  context,
  presentation,
  shortcut = false,
  className,
  frameVariant = defaultFrameVariant(presentation),
}: ResourceIconProps) {
  return (
    <IconFrame
      context={context}
      variant={frameVariant}
      className={className}
      overlay={shortcut ? <ShortcutOverlay /> : null}
    >
      <ResourceArtwork presentation={presentation} />
    </IconFrame>
  );
}
