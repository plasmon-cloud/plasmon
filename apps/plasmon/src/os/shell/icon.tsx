import { ResourceIcon, type ResourceIconPresentation } from "../visual/primitives.tsx";
import {
  applicationResourcePresentation,
  plasmonOwnedAssetPresentation,
} from "../visual/resource-presentation.ts";
import type { IconContext } from "../visual/sizing.ts";

export interface ShellIconProps {
  icon?: string | ResourceIconPresentation;
  label: string;
  shortcut?: boolean;
  context?: Extract<IconContext, "start" | "search" | "taskbar">;
}

/** Shell is now only a surface adapter for the shared Visual presentation primitive. */
export function ShellIcon({ icon, shortcut = false, context = "start" }: ShellIconProps) {
  const presentation = typeof icon === "object" && icon !== null
    ? icon
    : plasmonOwnedAssetPresentation(icon) ?? applicationResourcePresentation(icon);
  return (
    <span className="plasmon-shell__app-icon" aria-hidden="true">
      <ResourceIcon
        context={context}
        shortcut={shortcut}
        presentation={presentation}
      />
    </span>
  );
}
