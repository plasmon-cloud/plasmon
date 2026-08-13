import { ResourceIcon } from "../visual/primitives.tsx";
import { applicationResourcePresentation } from "../visual/resource-presentation.ts";

export interface ShellIconProps {
  icon?: string;
  label: string;
}

export type ShellIconPresentation =
  | { kind: "image"; src: string }
  | { kind: "fallback"; text: string };

export function isShellImageRef(value: string | undefined): value is string {
  return !!value && /^(?:https?:|data:image\/|\/|\.\.?\/)/u.test(value);
}

export function shellIconInitials(value: string): string {
  const words = value.trim().split(/\s+/u).filter(Boolean);
  return (words.slice(0, 2).map((word) => word[0]).join("") || "P").toLocaleUpperCase();
}

export function resolveShellIconPresentation(
  icon: string | undefined,
  label: string,
  failedImageSrc: string | null,
): ShellIconPresentation {
  if (isShellImageRef(icon) && failedImageSrc !== icon) return { kind: "image", src: icon };
  const symbolic = icon && !isShellImageRef(icon) ? icon : null;
  return { kind: "fallback", text: symbolic || shellIconInitials(label) };
}

export function ShellIcon({ icon, label }: ShellIconProps) {
  const presentation = resolveShellIconPresentation(icon, label, null);
  return (
    <span className="plasmon-shell__app-icon" aria-hidden="true">
      {presentation.kind === "image" ? (
        <ResourceIcon context="start" presentation={applicationResourcePresentation(presentation.src)} />
      ) : (
        <span data-shell-icon-fallback="true">{presentation.text}</span>
      )}
    </span>
  );
}
