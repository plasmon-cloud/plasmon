import { ResourceIcon } from "../visual/primitives.tsx";
import { applicationResourcePresentation } from "../visual/resource-presentation.ts";
import type { IconContext } from "../visual/sizing.ts";

export interface ShellIconProps {
  icon?: string;
  label: string;
  shortcut?: boolean;
  context?: Extract<IconContext, "start" | "search" | "taskbar">;
}

/** Shell is now only a surface adapter for the shared Visual presentation primitive. */
export function ShellIcon({ icon, shortcut = false, context = "start" }: ShellIconProps) {
  return (
    <span className="plasmon-shell__app-icon" aria-hidden="true">
      <ResourceIcon
        context={context}
        shortcut={shortcut}
        presentation={applicationResourcePresentation(icon)}
      />
    </span>
  );
}
