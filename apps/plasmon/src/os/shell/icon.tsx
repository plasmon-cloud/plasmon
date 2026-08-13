import type { ResourceIconPresentation } from "../visual/primitives.tsx";
import { ResourceIcon } from "../visual/primitives.tsx";
import type { IconContext } from "../visual/sizing.ts";

export interface ShellIconProps {
  presentation: ResourceIconPresentation;
  context: Extract<IconContext, "start" | "search" | "taskbar">;
  shortcut?: boolean;
}

/**
 * Shell adapter for the shared Visual resource primitive. Shell supplies an
 * already-resolved presentation and retains only surface/context rendering.
 */
export function ShellIcon({ presentation, context, shortcut = false }: ShellIconProps) {
  return (
    <span className="plasmon-shell__app-icon" aria-hidden="true">
      <ResourceIcon context={context} presentation={presentation} shortcut={shortcut} />
    </span>
  );
}
