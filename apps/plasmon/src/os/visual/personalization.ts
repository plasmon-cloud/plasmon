export const VISUAL_SYSTEM_COLOR_ROLE_IDS = [
  "desktop",
  "window",
  "titlebar",
  "panel",
  "raised-surface",
  "taskbar",
  "control",
  "primary-text",
  "secondary-text",
  "accent",
  "border",
] as const;

export type VisualSystemColorRoleId = (typeof VISUAL_SYSTEM_COLOR_ROLE_IDS)[number];
export type VisualSystemColorOverrides = Partial<Record<VisualSystemColorRoleId, string>>;
export type VisualSystemBasePalette = Partial<Record<VisualSystemColorRoleId, string>>;

export const VISUAL_SYSTEM_COLOR_ROLES = Object.freeze({
  desktop: { label: "Desktop / base surface", cssVariable: "--plasmon-desktop-background" },
  window: { label: "Window surface", cssVariable: "--plasmon-window-background" },
  titlebar: { label: "Title bar", cssVariable: "--plasmon-window-titlebar" },
  panel: { label: "Panel surface", cssVariable: "--plasmon-panel-background" },
  "raised-surface": { label: "Raised / menu surface", cssVariable: "--plasmon-panel-elevated" },
  taskbar: { label: "Taskbar / Shell surface", cssVariable: "--plasmon-taskbar-background" },
  control: { label: "Control surface", cssVariable: "--plasmon-control-background" },
  "primary-text": { label: "Primary text", cssVariable: "--plasmon-text-primary" },
  "secondary-text": { label: "Secondary text", cssVariable: "--plasmon-text-secondary" },
  accent: { label: "Accent / selection / focus", cssVariable: "--plasmon-accent" },
  border: { label: "Borders / separators", cssVariable: "--plasmon-border-strong" },
} satisfies Readonly<Record<VisualSystemColorRoleId, { label: string; cssVariable: string }>>);

export const VISUAL_ICON_SET_IDS = ["plasmon"] as const;
export type VisualIconSetId = (typeof VISUAL_ICON_SET_IDS)[number];
export const DEFAULT_VISUAL_ICON_SET_ID: VisualIconSetId = "plasmon";
export const VISUAL_ICON_SET_LABELS = Object.freeze({
  plasmon: "Plasmon",
} satisfies Readonly<Record<VisualIconSetId, string>>);

export const VISUAL_ICON_COLOR_SLOT_IDS = [
  "primary",
  "secondary",
  "accent",
  "outline",
  "highlight",
] as const;
export type VisualIconColorSlotId = (typeof VISUAL_ICON_COLOR_SLOT_IDS)[number];
export type VisualIconPalette = Readonly<Record<VisualIconColorSlotId, string>>;

export const VISUAL_ICON_COLOR_SLOT_LABELS = Object.freeze({
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  outline: "Outline",
  highlight: "Highlight",
} satisfies Readonly<Record<VisualIconColorSlotId, string>>);

const GRAPHITE_ICON_PALETTE: VisualIconPalette = Object.freeze({
  primary: "#2c3137",
  secondary: "#747b84",
  accent: "#62c5e8",
  outline: "#a4adb6",
  highlight: "#f3f5f7",
});

const ICON_THEME_PALETTES = Object.freeze({
  "plasmon-graphite": GRAPHITE_ICON_PALETTE,
  "plasmon-verdant": Object.freeze({
    primary: "#17373a",
    secondary: "#63c6ca",
    accent: "#84e3b0",
    outline: "#91d9ba",
    highlight: "#d7f7e6",
  }),
  "plasmon-midnight": Object.freeze({
    primary: "#30264f",
    secondary: "#8070d8",
    accent: "#b9abff",
    outline: "#cabfff",
    highlight: "#eeeaff",
  }),
  "plasmon-ember": Object.freeze({
    primary: "#49301c",
    secondary: "#d57b34",
    accent: "#ffb454",
    outline: "#efad69",
    highlight: "#ffe2b6",
  }),
  "plasmon-glacier": Object.freeze({
    primary: "#c7e0e9",
    secondary: "#4ca0bb",
    accent: "#087ea4",
    outline: "#397c91",
    highlight: "#ffffff",
  }),
  "plasmon-rosewood": Object.freeze({
    primary: "#542238",
    secondary: "#c45e7d",
    accent: "#ff8faa",
    outline: "#ef91a9",
    highlight: "#ffe1e9",
  }),
} satisfies Readonly<Record<string, VisualIconPalette>>);

export type VisualCssVariableStyle = Readonly<Record<string, string>>;

const SYSTEM_PROJECTION_VARIABLES = [
  "--plasmon-desktop-background",
  "--plasmon-window-background",
  "--plasmon-window-titlebar",
  "--plasmon-panel-background",
  "--plasmon-panel-elevated",
  "--plasmon-taskbar-background",
  "--plasmon-control-background",
  "--plasmon-text-primary",
  "--plasmon-text-secondary",
  "--plasmon-accent",
  "--plasmon-accent-hover",
  "--plasmon-focus-ring",
  "--plasmon-selection-border",
  "--plasmon-selection",
  "--plasmon-border-strong",
  "--plasmon-border-subtle",
] as const;

const ICON_PROJECTION_VARIABLES = [
  "--plasmon-icon-primary",
  "--plasmon-icon-secondary",
  "--plasmon-icon-accent",
  "--plasmon-icon-outline",
  "--plasmon-icon-highlight",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeVisualColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(trimmed);
  if (short) {
    return `#${[...short[1]].map((digit) => `${digit}${digit}`).join("")}`.toLowerCase();
  }
  if (!/^#[0-9a-f]{6}$/i.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

export function cssColorToOpaqueHex(value: string | undefined): string | null {
  if (!value) return null;
  const normalized = normalizeVisualColor(value);
  if (normalized) return normalized;
  const match = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)$/i.exec(value.trim());
  if (!match) return null;
  const channels = match.slice(1, 4).map((channel) => Number(channel));
  if (channels.some((channel) => !Number.isInteger(channel) || channel < 0 || channel > 255)) return null;
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function normalizeSystemColorOverrides(value: unknown): VisualSystemColorOverrides {
  if (!isRecord(value)) return {};
  const result: VisualSystemColorOverrides = {};
  for (const roleId of VISUAL_SYSTEM_COLOR_ROLE_IDS) {
    const color = normalizeVisualColor(value[roleId]);
    if (color) result[roleId] = color;
  }
  return result;
}

export function normalizeVisualIconPalette(value: unknown): VisualIconPalette | null {
  if (!isRecord(value)) return null;
  const result = {} as Record<VisualIconColorSlotId, string>;
  for (const slotId of VISUAL_ICON_COLOR_SLOT_IDS) {
    const color = normalizeVisualColor(value[slotId]);
    if (!color) return null;
    result[slotId] = color;
  }
  return Object.freeze(result);
}

export function isVisualIconSetId(value: unknown): value is VisualIconSetId {
  return typeof value === "string" && (VISUAL_ICON_SET_IDS as readonly string[]).includes(value);
}

export function iconPaletteForTheme(themeId: string): VisualIconPalette {
  return ICON_THEME_PALETTES[themeId] ?? GRAPHITE_ICON_PALETTE;
}

export function iconPaletteCssVariables(palette: VisualIconPalette): VisualCssVariableStyle {
  return {
    "--plasmon-icon-primary": palette.primary,
    "--plasmon-icon-secondary": palette.secondary,
    "--plasmon-icon-accent": palette.accent,
    "--plasmon-icon-outline": palette.outline,
    "--plasmon-icon-highlight": palette.highlight,
  };
}

export function systemColorOverrideCssVariables(overrides: VisualSystemColorOverrides): VisualCssVariableStyle {
  const style: Record<string, string> = {};
  for (const roleId of VISUAL_SYSTEM_COLOR_ROLE_IDS) {
    const color = normalizeVisualColor(overrides[roleId]);
    if (!color) continue;
    const { cssVariable } = VISUAL_SYSTEM_COLOR_ROLES[roleId];
    style[cssVariable] = color;
    if (roleId === "accent") {
      style["--plasmon-accent-hover"] = color;
      style["--plasmon-focus-ring"] = color;
      style["--plasmon-selection-border"] = color;
      style["--plasmon-selection"] = `color-mix(in srgb, ${color} 18%, transparent)`;
    } else if (roleId === "border") {
      style["--plasmon-border-subtle"] = `color-mix(in srgb, ${color} 62%, transparent)`;
    }
  }
  return style;
}

export function visualPersonalizationCssVariables(
  systemOverrides: VisualSystemColorOverrides,
  iconPalette: VisualIconPalette,
): VisualCssVariableStyle {
  return {
    ...systemColorOverrideCssVariables(systemOverrides),
    ...iconPaletteCssVariables(iconPalette),
  };
}

export function readSystemBasePalette(element: Element): VisualSystemBasePalette {
  if (typeof getComputedStyle !== "function") return {};
  const computed = getComputedStyle(element);
  const result: VisualSystemBasePalette = {};
  for (const roleId of VISUAL_SYSTEM_COLOR_ROLE_IDS) {
    const value = computed.getPropertyValue(VISUAL_SYSTEM_COLOR_ROLES[roleId].cssVariable).trim();
    if (value) result[roleId] = value;
  }
  return result;
}

export function isSystemPaletteCustom(
  basePalette: VisualSystemBasePalette,
  overrides: VisualSystemColorOverrides,
): boolean {
  for (const roleId of VISUAL_SYSTEM_COLOR_ROLE_IDS) {
    const override = normalizeVisualColor(overrides[roleId]);
    if (!override) continue;
    const base = normalizeVisualColor(basePalette[roleId]);
    if (!base || base !== override) return true;
  }
  return false;
}

export function applyVisualCssVariables(
  element: HTMLElement,
  variables: VisualCssVariableStyle,
): () => void {
  const previous = new Map<string, string>();
  for (const [name, value] of Object.entries(variables)) {
    previous.set(name, element.style.getPropertyValue(name));
    element.style.setProperty(name, value);
  }
  return () => {
    for (const [name, value] of previous) {
      if (value) element.style.setProperty(name, value);
      else element.style.removeProperty(name);
    }
  };
}

export function projectVisualPersonalizationToDocument(
  systemOverrides: VisualSystemColorOverrides,
  iconPalette: VisualIconPalette,
): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  for (const variable of SYSTEM_PROJECTION_VARIABLES) root.style.removeProperty(variable);
  for (const variable of ICON_PROJECTION_VARIABLES) root.style.removeProperty(variable);

  const normalizedOverrides = normalizeSystemColorOverrides(systemOverrides);
  const systemVariables = systemColorOverrideCssVariables(normalizedOverrides);
  for (const [name, value] of Object.entries(systemVariables)) root.style.setProperty(name, value);
  const activeRoles = VISUAL_SYSTEM_COLOR_ROLE_IDS.filter((roleId) => normalizedOverrides[roleId]);
  if (activeRoles.length > 0) root.setAttribute("data-plasmon-system-overrides", activeRoles.join(" "));
  else root.removeAttribute("data-plasmon-system-overrides");

  const iconVariables = iconPaletteCssVariables(iconPalette);
  for (const [name, value] of Object.entries(iconVariables)) root.style.setProperty(name, value);
  root.setAttribute("data-plasmon-icon-palette-projected", "true");
}