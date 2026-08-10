import { useState } from "react";

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

/** Pure presentation decision used by the component and focused tests. */
export function resolveShellIconPresentation(
  icon: string | undefined,
  label: string,
  failedImageSrc: string | null,
): ShellIconPresentation {
  if (isShellImageRef(icon) && failedImageSrc !== icon) return { kind: "image", src: icon };
  const symbolic = icon && !isShellImageRef(icon) ? icon : null;
  return { kind: "fallback", text: symbolic || shellIconInitials(label) };
}

/**
 * Fixed-size Shell application icon with a clean fallback for missing/404
 * Neutron icon resources. Failing images never remove the surrounding label or
 * button semantics because only this visual child swaps to initials.
 */
export function ShellIcon({ icon, label }: ShellIconProps) {
  const [failedImageSrc, setFailedImageSrc] = useState<string | null>(null);
  const presentation = resolveShellIconPresentation(icon, label, failedImageSrc);
  return (
    <span className="plasmon-shell__app-icon" aria-hidden="true">
      {presentation.kind === "image" ? (
        <img
          src={presentation.src}
          alt=""
          draggable={false}
          width={34}
          height={34}
          onError={() => setFailedImageSrc(presentation.src)}
        />
      ) : (
        <span data-shell-icon-fallback="true">{presentation.text}</span>
      )}
    </span>
  );
}
