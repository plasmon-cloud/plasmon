import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import {
  deriveShellThemePresentationState,
  effectiveShellIconPalette,
  effectiveShellWallpaper,
  SHELL_APPEARANCE_MODES,
  SHELL_THEME_IDS,
  SHELL_THEME_LABELS,
  SHELL_WALLPAPER_IDS,
  SHELL_WALLPAPER_LABELS,
  type ShellPreferences,
} from "../../os/shell/preferences.ts";
import {
  cssColorToOpaqueHex,
  iconPaletteForTheme,
  normalizeVisualColor,
  readSystemBasePalette,
  systemColorOverrideCssVariables,
  VISUAL_ICON_COLOR_SLOT_IDS,
  VISUAL_ICON_COLOR_SLOT_LABELS,
  VISUAL_ICON_SET_LABELS,
  VISUAL_SYSTEM_COLOR_ROLE_IDS,
  VISUAL_SYSTEM_COLOR_ROLES,
  type VisualIconColorSlotId,
  type VisualSystemBasePalette,
  type VisualSystemColorRoleId,
} from "../../os/visual/personalization.ts";
import { NativeAppButton } from "../../os/visual/index.ts";

export interface PersonalizationPanelProps {
  preferences: ShellPreferences;
  ready: boolean;
  error: string | null;
  onUpdate: (patch: Partial<ShellPreferences>) => void;
}

interface ColorEditorProps {
  label: string;
  value: string;
  disabled: boolean;
  onCommit: (value: string) => void;
}

function ColorEditor({ label, value, disabled, onCommit }: ColorEditorProps) {
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setDraft(value);
    setInvalid(false);
  }, [value]);

  const commit = (): void => {
    const normalized = normalizeVisualColor(draft);
    if (!normalized) {
      setDraft(value);
      setInvalid(true);
      return;
    }
    setDraft(normalized);
    setInvalid(false);
    onCommit(normalized);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commit();
  };

  return (
    <div style={styles.colorEditor}>
      <label style={styles.colorLabel}>
        <span>{label}</span>
        <span style={styles.colorInputs}>
          <input
            type="color"
            aria-label={`${label} color picker`}
            value={value}
            disabled={disabled}
            onChange={(event) => onCommit(event.currentTarget.value)}
          />
          <input
            type="text"
            aria-label={`${label} hex value`}
            aria-invalid={invalid || undefined}
            value={draft}
            disabled={disabled}
            inputMode="text"
            spellCheck={false}
            style={styles.hexInput}
            onChange={(event) => {
              setDraft(event.currentTarget.value);
              setInvalid(false);
            }}
            onBlur={commit}
            onKeyDown={onKeyDown}
          />
        </span>
      </label>
      {invalid ? <span role="alert" style={styles.validation}>Use a hex color such as #62c5e8.</span> : null}
    </div>
  );
}

function systemRoleInputColor(
  roleId: VisualSystemColorRoleId,
  preferences: ShellPreferences,
  basePalette: VisualSystemBasePalette,
): string {
  return normalizeVisualColor(preferences.systemColorOverrides[roleId])
    ?? cssColorToOpaqueHex(basePalette[roleId])
    ?? "#000000";
}

export function PersonalizationPanel({ preferences, ready, error, onUpdate }: PersonalizationPanelProps) {
  const paletteProbeRef = useRef<HTMLDivElement>(null);
  const [basePalette, setBasePalette] = useState<VisualSystemBasePalette>({});

  useLayoutEffect(() => {
    const probe = paletteProbeRef.current;
    if (!probe) return;
    setBasePalette(readSystemBasePalette(probe));
  }, [preferences.appearanceMode, preferences.themeId]);

  const themePresentation = deriveShellThemePresentationState(preferences, basePalette);
  const themeLabel = SHELL_THEME_LABELS[preferences.themeId];
  const iconPalette = effectiveShellIconPalette(preferences);

  const updateSystemColor = (roleId: VisualSystemColorRoleId, value: string): void => {
    const normalized = normalizeVisualColor(value);
    if (!normalized) return;
    const next = { ...preferences.systemColorOverrides };
    const canonicalBase = normalizeVisualColor(basePalette[roleId]);
    if (canonicalBase === normalized) delete next[roleId];
    else next[roleId] = normalized;
    onUpdate({ systemColorOverrides: next });
  };

  const updateIconColor = (slotId: VisualIconColorSlotId, value: string): void => {
    if (preferences.iconPalette.mode !== "custom") return;
    const normalized = normalizeVisualColor(value);
    if (!normalized) return;
    onUpdate({
      iconPalette: {
        mode: "custom",
        colors: { ...preferences.iconPalette.colors, [slotId]: normalized },
      },
    });
  };

  return (
    <>
      <div
        ref={paletteProbeRef}
        className="plasmon-shell"
        data-plasmon-theme={preferences.themeId}
        data-plasmon-appearance={preferences.appearanceMode}
        data-plasmon-palette-probe="true"
        aria-hidden="true"
        style={styles.paletteProbe}
      />

      <h3 style={styles.sectionHeading}>Theme</h3>
      <p role="status" style={styles.stateText}>
        {themePresentation.kind === "custom"
          ? `System colors: Custom · Base preset: ${themeLabel}`
          : `System colors: ${themeLabel}`}
      </p>
      <div style={styles.optionGrid}>
        {SHELL_THEME_IDS.map((themeId) => (
          <NativeAppButton
            key={themeId}
            type="button"
            disabled={!ready}
            aria-pressed={preferences.themeId === themeId && themePresentation.kind === "preset"}
            onClick={() => onUpdate({ themeId })}
          >
            {SHELL_THEME_LABELS[themeId]}
          </NativeAppButton>
        ))}
      </div>

      <h3 style={styles.sectionHeading}>Appearance mode</h3>
      <div style={styles.optionGrid}>
        {SHELL_APPEARANCE_MODES.map((appearanceMode) => (
          <NativeAppButton
            key={appearanceMode}
            type="button"
            disabled={!ready}
            aria-pressed={preferences.appearanceMode === appearanceMode}
            onClick={() => onUpdate({ appearanceMode })}
          >
            {appearanceMode === "dark" ? "Dark" : "Light"}
          </NativeAppButton>
        ))}
      </div>

      <h3 style={styles.sectionHeading}>System & window colors</h3>
      <p style={styles.helpText}>
        Edit only shared semantic roles. Custom is derived from these overrides; wallpaper and icon choices remain independent.
      </p>
      <div style={styles.colorGrid}>
        {VISUAL_SYSTEM_COLOR_ROLE_IDS.map((roleId) => (
          <ColorEditor
            key={roleId}
            label={VISUAL_SYSTEM_COLOR_ROLES[roleId].label}
            value={systemRoleInputColor(roleId, preferences, basePalette)}
            disabled={!ready}
            onCommit={(value) => updateSystemColor(roleId, value)}
          />
        ))}
      </div>
      <NativeAppButton
        type="button"
        disabled={!ready || Object.keys(preferences.systemColorOverrides).length === 0}
        onClick={() => onUpdate({ systemColorOverrides: {} })}
      >
        Reset colors to {themeLabel}
      </NativeAppButton>

      <div
        className="plasmon-shell"
        data-plasmon-theme={preferences.themeId}
        data-plasmon-appearance={preferences.appearanceMode}
        aria-label="System color preview"
        role="img"
        style={{
          ...styles.preview,
          ...(systemColorOverrideCssVariables(preferences.systemColorOverrides) as CSSProperties),
        }}
      >
        <div style={styles.previewTitlebar}>Window title</div>
        <div style={styles.previewBody}>
          <div style={styles.previewPanel}>Panel</div>
          <button type="button" tabIndex={-1} style={styles.previewControl}>Control</button>
          <strong>Primary text</strong>
          <span style={styles.previewSecondary}>Secondary text</span>
          <span style={styles.previewAccent}>Accent</span>
        </div>
      </div>

      <h3 style={styles.sectionHeading}>Icons</h3>
      <label style={styles.controlRow}>
        Icon set
        <select aria-label="Icon set" value={preferences.iconSetId} disabled style={styles.select}>
          <option value="plasmon">{VISUAL_ICON_SET_LABELS.plasmon}</option>
        </select>
      </label>
      <p style={styles.helpText}>R3 ships one complete Plasmon-owned icon set. Global icon frames remain owned by #390.</p>
      <div style={styles.optionGrid}>
        <NativeAppButton
          type="button"
          disabled={!ready}
          aria-label="Follow theme icon colors"
          aria-pressed={preferences.iconPalette.mode === "follow-theme"}
          onClick={() => onUpdate({ iconPalette: { mode: "follow-theme" } })}
        >
          Follow theme
        </NativeAppButton>
        <NativeAppButton
          type="button"
          disabled={!ready}
          aria-pressed={preferences.iconPalette.mode === "custom"}
          onClick={() => onUpdate({
            iconPalette: preferences.iconPalette.mode === "custom"
              ? preferences.iconPalette
              : { mode: "custom", colors: { ...iconPaletteForTheme(preferences.themeId) } },
          })}
        >
          Custom icons
        </NativeAppButton>
      </div>
      {preferences.iconPalette.mode === "custom" ? (
        <>
          <div style={styles.colorGrid}>
            {VISUAL_ICON_COLOR_SLOT_IDS.map((slotId) => (
              <ColorEditor
                key={slotId}
                label={`${VISUAL_ICON_COLOR_SLOT_LABELS[slotId]} icon color`}
                value={preferences.iconPalette.mode === "custom" ? preferences.iconPalette.colors[slotId] : iconPalette[slotId]}
                disabled={!ready}
                onCommit={(value) => updateIconColor(slotId, value)}
              />
            ))}
          </div>
          <NativeAppButton
            type="button"
            disabled={!ready}
            onClick={() => onUpdate({ iconPalette: { mode: "follow-theme" } })}
          >
            Use theme colors
          </NativeAppButton>
        </>
      ) : null}

      <h3 style={styles.sectionHeading}>Wallpaper</h3>
      <div style={styles.optionGrid}>
        <NativeAppButton
          type="button"
          disabled={!ready || preferences.wallpaper.mode === "follow-theme"}
          aria-pressed={preferences.wallpaper.mode === "follow-theme"}
          onClick={() => onUpdate({ wallpaper: { mode: "follow-theme" } })}
        >
          Follow theme
        </NativeAppButton>
        {SHELL_WALLPAPER_IDS.map((wallpaperId) => (
          <NativeAppButton
            key={wallpaperId}
            type="button"
            disabled={!ready || effectiveShellWallpaper(preferences.themeId, preferences.wallpaper) === wallpaperId}
            aria-pressed={preferences.wallpaper.mode === "pinned" && preferences.wallpaper.id === wallpaperId}
            onClick={() => onUpdate({ wallpaper: { mode: "pinned", id: wallpaperId } })}
          >
            {SHELL_WALLPAPER_LABELS[wallpaperId]}
          </NativeAppButton>
        ))}
      </div>

      <h3 style={styles.sectionHeading}>Desktop overlay</h3>
      <NativeAppButton
        type="button"
        disabled={!ready}
        aria-label="Show Plasmon watermark"
        aria-pressed={preferences.showBrandWatermark !== false}
        onClick={() => onUpdate({ showBrandWatermark: preferences.showBrandWatermark === false })}
      >
        Plasmon watermark: {preferences.showBrandWatermark !== false ? "On" : "Off"}
      </NativeAppButton>
      <p style={styles.helpText}>The Plasmon SVG watermark is layered over every wallpaper and can be hidden independently.</p>
      {error ? <p role="alert">Appearance settings could not be saved: {error}</p> : null}
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  sectionHeading: {
    margin: "14px 0 8px",
    color: "var(--plasmon-text-primary)",
    fontSize: 14,
  },
  optionGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  stateText: {
    margin: "0 0 8px",
    color: "var(--plasmon-text-secondary)",
  },
  helpText: {
    margin: "6px 0 10px",
    color: "var(--plasmon-text-secondary)",
    fontSize: 13,
  },
  colorGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 8,
    marginBottom: 10,
  },
  colorEditor: {
    minWidth: 0,
  },
  colorLabel: {
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
    gap: 8,
    color: "var(--plasmon-text-primary)",
    fontSize: 12,
    fontWeight: 600,
  },
  colorInputs: {
    alignItems: "center",
    display: "flex",
    gap: 6,
  },
  hexInput: {
    width: 88,
    minHeight: 30,
    border: "1px solid var(--plasmon-border-strong)",
    borderRadius: "var(--plasmon-radius-control)",
    background: "var(--plasmon-window-background)",
    color: "var(--plasmon-text-primary)",
    padding: "4px 6px",
    fontFamily: "var(--plasmon-font-mono)",
  },
  validation: {
    display: "block",
    marginTop: 3,
    color: "var(--plasmon-danger)",
    fontSize: 11,
  },
  paletteProbe: {
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    visibility: "hidden",
    pointerEvents: "none",
  },
  preview: {
    position: "relative",
    height: "auto",
    minHeight: 128,
    margin: "12px 0",
    border: "1px solid var(--plasmon-border-strong)",
    borderRadius: "var(--plasmon-radius-panel)",
    overflow: "hidden",
    background: "var(--plasmon-window-background)",
    color: "var(--plasmon-text-primary)",
    userSelect: "none",
  },
  previewTitlebar: {
    padding: "8px 10px",
    background: "var(--plasmon-window-titlebar)",
    borderBottom: "1px solid var(--plasmon-border-subtle)",
    fontWeight: 700,
  },
  previewBody: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    padding: 10,
    background: "var(--plasmon-window-background)",
  },
  previewPanel: {
    padding: "7px 9px",
    background: "var(--plasmon-panel-background)",
    border: "1px solid var(--plasmon-border-subtle)",
  },
  previewControl: {
    minHeight: 30,
    padding: "5px 8px",
    background: "var(--plasmon-control-background)",
    border: "1px solid var(--plasmon-border-strong)",
    color: "var(--plasmon-text-primary)",
  },
  previewSecondary: {
    color: "var(--plasmon-text-secondary)",
  },
  previewAccent: {
    color: "var(--plasmon-accent)",
    fontWeight: 700,
  },
  controlRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginTop: 10,
    color: "var(--plasmon-text-primary)",
    fontWeight: 600,
  },
  select: {
    minWidth: 150,
    minHeight: 32,
    padding: "5px 28px 5px 8px",
    border: "1px solid var(--plasmon-border-strong)",
    borderRadius: "var(--plasmon-radius-control)",
    background: "var(--plasmon-window-background)",
    color: "var(--plasmon-text-primary)",
    font: "var(--plasmon-font-size-ui)/1.2 var(--plasmon-font-ui)",
  },
};