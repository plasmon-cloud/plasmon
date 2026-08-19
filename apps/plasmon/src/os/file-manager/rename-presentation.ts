import type { FileEntryPresentation } from "./file-entry-state.ts";

export interface InlineRenamePresentation {
  readonly rows: 1;
  readonly wrap: "soft" | "off";
  readonly autoGrow: boolean;
  readonly maxHeight: string;
  readonly desktopIdealWidthPx: number | null;
  readonly gridInlineInsetPx: number | null;
}

const TILED_MAX_HEIGHT = "calc(10em + 8px)";
const SINGLE_LINE_HEIGHT = "calc(1.25em + 8px)";

export function inlineRenamePresentation(
  presentation: FileEntryPresentation,
): InlineRenamePresentation {
  if (presentation === "desktop") {
    return {
      rows: 1,
      wrap: "soft",
      autoGrow: true,
      maxHeight: TILED_MAX_HEIGHT,
      desktopIdealWidthPx: 112,
      gridInlineInsetPx: null,
    };
  }

  if (presentation === "grid") {
    return {
      rows: 1,
      wrap: "soft",
      autoGrow: true,
      maxHeight: TILED_MAX_HEIGHT,
      desktopIdealWidthPx: null,
      gridInlineInsetPx: 6,
    };
  }

  return {
    rows: 1,
    wrap: "off",
    autoGrow: false,
    maxHeight: SINGLE_LINE_HEIGHT,
    desktopIdealWidthPx: null,
    gridInlineInsetPx: null,
  };
}

export function inlineRenameStyleVariables(
  presentation: InlineRenamePresentation,
): Record<string, string> {
  const variables: Record<string, string> = {
    "--fm-rename-max-height": presentation.maxHeight,
  };

  if (presentation.desktopIdealWidthPx !== null) {
    variables["--fm-desktop-rename-ideal-width"] = `${presentation.desktopIdealWidthPx}px`;
  }

  if (presentation.gridInlineInsetPx !== null) {
    variables["--fm-grid-rename-inline-inset"] = `${presentation.gridInlineInsetPx}px`;
    variables["--fm-grid-rename-total-inset"] = `${presentation.gridInlineInsetPx * 2}px`;
  }

  return variables;
}
