export const PLASMON_MONACO_THEME_NAME = "plasmon-active";

export interface MonacoThemeStyleReader {
  colorScheme?: string;
  getPropertyValue(name: string): string;
}

const FALLBACK = Object.freeze({
  window: "#111820",
  panel: "#17242c",
  primary: "#f5faf7",
  secondary: "#a7b7b1",
  subtle: "#7f8b9c",
  accent: "#84e3b0",
  accentHover: "#9ce9c0",
  danger: "#ff9a9f",
  warning: "#f0c878",
  success: "#84e3b0",
  focus: "#a7edc7",
});

function hex(style: MonacoThemeStyleReader, token: string, fallback: string): string {
  const value = style.getPropertyValue(token).trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}

function opaque(value: string): string {
  return value.slice(1);
}

function alpha(value: string, opacityHex: string): string {
  return `${value}${opacityHex}`;
}

/**
 * Monaco is a browser/editor adapter and cannot consume CSS custom properties
 * directly inside its internal canvas. Resolve the active shared Visual palette
 * at the host boundary and project only presentation colors into Monaco.
 */
export function plasmonMonacoThemeData(style: MonacoThemeStyleReader) {
  const window = hex(style, "--plasmon-window-background", FALLBACK.window);
  const panel = hex(style, "--plasmon-panel-elevated", FALLBACK.panel);
  const primary = hex(style, "--plasmon-text-primary", FALLBACK.primary);
  const secondary = hex(style, "--plasmon-text-secondary", FALLBACK.secondary);
  const subtle = hex(style, "--plasmon-text-subtle", FALLBACK.subtle);
  const accent = hex(style, "--plasmon-accent", FALLBACK.accent);
  const accentHover = hex(style, "--plasmon-accent-hover", FALLBACK.accentHover);
  const danger = hex(style, "--plasmon-danger", FALLBACK.danger);
  const warning = hex(style, "--plasmon-warning", FALLBACK.warning);
  const success = hex(style, "--plasmon-success", FALLBACK.success);
  const focus = hex(style, "--plasmon-focus-ring", FALLBACK.focus);
  const light = String(style.colorScheme ?? "").toLowerCase().includes("light");

  return {
    base: light ? "vs" as const : "vs-dark" as const,
    inherit: true,
    rules: [
      { token: "comment", foreground: opaque(subtle) },
      { token: "string", foreground: opaque(success) },
      { token: "number", foreground: opaque(warning) },
      { token: "keyword", foreground: opaque(accent) },
      { token: "type", foreground: opaque(accentHover) },
    ],
    colors: {
      "editor.background": window,
      "editor.foreground": primary,
      "editorGutter.background": window,
      "editorLineNumber.foreground": subtle,
      "editorLineNumber.activeForeground": secondary,
      "editorCursor.foreground": accent,
      "editor.selectionBackground": alpha(accent, "33"),
      "editor.inactiveSelectionBackground": alpha(accent, "22"),
      "editor.lineHighlightBackground": alpha(panel, "b8"),
      "editor.focusedStackFrameHighlightBackground": alpha(focus, "20"),
      "editor.findMatchBackground": alpha(warning, "40"),
      "editor.findMatchHighlightBackground": alpha(warning, "24"),
      "editorError.foreground": danger,
      "editorWarning.foreground": warning,
      "editorInfo.foreground": accent,
      "minimap.background": panel,
      "scrollbarSlider.background": alpha(accent, "28"),
      "scrollbarSlider.hoverBackground": alpha(accent, "42"),
      "scrollbarSlider.activeBackground": alpha(accent, "58"),
      focusBorder: focus,
    },
  };
}
