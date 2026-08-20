import type { FileEntryPresentation } from "./file-entry-state.ts";

export interface InlineRenamePresentation {
  readonly rows: 1;
  readonly wrap: "soft" | "off";
  readonly autoGrow: boolean;
  readonly maxHeight: string;
  readonly minWidthPx: number | null;
  readonly desktopMaxWidthPx: number | null;
  readonly gridInlineInsetPx: number | null;
}

const TILED_MAX_HEIGHT = "calc(10em + 8px)";
const SINGLE_LINE_HEIGHT = "calc(1.25em + 8px)";
const TILED_MIN_WIDTH_PX = 36;
const DESKTOP_MAX_WIDTH_PX = 90;

export function inlineRenamePresentation(
  presentation: FileEntryPresentation,
): InlineRenamePresentation {
  if (presentation === "desktop") {
    return {
      rows: 1,
      wrap: "soft",
      autoGrow: true,
      maxHeight: TILED_MAX_HEIGHT,
      minWidthPx: TILED_MIN_WIDTH_PX,
      desktopMaxWidthPx: DESKTOP_MAX_WIDTH_PX,
      gridInlineInsetPx: null,
    };
  }

  if (presentation === "grid") {
    return {
      rows: 1,
      wrap: "soft",
      autoGrow: true,
      maxHeight: TILED_MAX_HEIGHT,
      minWidthPx: TILED_MIN_WIDTH_PX,
      desktopMaxWidthPx: null,
      gridInlineInsetPx: 6,
    };
  }

  return {
    rows: 1,
    wrap: "off",
    autoGrow: false,
    maxHeight: SINGLE_LINE_HEIGHT,
    minWidthPx: null,
    desktopMaxWidthPx: null,
    gridInlineInsetPx: null,
  };
}

export function boundedInlineRenameWidth(
  textWidthPx: number,
  horizontalChromePx: number,
  minWidthPx: number,
  maxWidthPx: number,
): number {
  const minimum = Math.max(0, minWidthPx);
  const maximum = Math.max(minimum, maxWidthPx);
  const natural = Math.ceil(Math.max(0, textWidthPx) + Math.max(0, horizontalChromePx));
  return Math.min(maximum, Math.max(minimum, natural));
}

export function inlineRenameStyleVariables(
  presentation: InlineRenamePresentation,
): Record<string, string> {
  const variables: Record<string, string> = {
    "--fm-rename-max-height": presentation.maxHeight,
  };

  if (presentation.minWidthPx !== null) {
    variables["--fm-rename-min-width"] = `${presentation.minWidthPx}px`;
  }

  if (presentation.desktopMaxWidthPx !== null) {
    variables["--fm-desktop-rename-max-width"] = `${presentation.desktopMaxWidthPx}px`;
  }

  if (presentation.gridInlineInsetPx !== null) {
    variables["--fm-grid-rename-inline-inset"] = `${presentation.gridInlineInsetPx}px`;
    variables["--fm-grid-rename-total-inset"] = `${presentation.gridInlineInsetPx * 2}px`;
  }

  return variables;
}
