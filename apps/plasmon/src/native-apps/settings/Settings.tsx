import { useEffect, useState, type CSSProperties, type ChangeEvent } from "react";
import type {
  AssociationRegistry,
  FsService,
  OpenTarget,
  ProcessController,
  ProcessId,
} from "../../os/contracts/index.ts";
import {
  DIAGNOSTIC_LEVELS,
  type DiagnosticLevel,
  type DiagnosticSettings,
  type DiagnosticSettingsStore,
} from "../../os/diagnostics/index.ts";
import type { HiddenVisibilityPreferenceStore } from "../../os/hiddenVisibility.ts";
import {
  effectiveShellWallpaper,
  SHELL_APPEARANCE_MODES,
  SHELL_THEME_IDS,
  SHELL_THEME_LABELS,
  SHELL_WALLPAPER_IDS,
  SHELL_WALLPAPER_LABELS,
  type ShellPreferencesAuthority,
} from "../../os/shell/preferences.ts";
import { NativeAppContentSurface, NativeAppPanel } from "../../os/visual/index.ts";
import {
  formatBytes,
  settingsFeatureAvailability,
  summarizeStorage,
  type StorageSummary,
} from "./model.ts";

export interface SettingsDependencies {
  associations?: AssociationRegistry;
  getThemeName?: () => string;
  setThemeName?: (theme: string) => void;
  getTaskbarMode?: () => string;
  setTaskbarMode?: (mode: string) => void;
  hiddenVisibility?: HiddenVisibilityPreferenceStore;
  shellPreferences?: ShellPreferencesAuthority;
  diagnosticSettings?: DiagnosticSettingsStore;
}

export interface SettingsHostProps {
  processId: ProcessId;
  target: OpenTarget;
  fs: FsService;
  process: ProcessController;
}

export function createSettingsComponent(dependencies: SettingsDependencies = {}) {
  return function Settings({ processId, fs, process }: SettingsHostProps) {
    const [storage, setStorage] = useState<StorageSummary | null>(null);
    const [alwaysShowHiddenFiles, setAlwaysShowHiddenFiles] = useState(
      () => dependencies.hiddenVisibility?.getSnapshot().alwaysShowHiddenFiles ?? false,
    );
    const [hiddenVisibilityReady, setHiddenVisibilityReady] = useState(!dependencies.hiddenVisibility);
    const [hiddenVisibilityError, setHiddenVisibilityError] = useState<string | null>(null);
    const [shellSnapshot, setShellSnapshot] = useState(
      () => dependencies.shellPreferences?.getSnapshot() ?? null,
    );
    const [shellPreferencesReady, setShellPreferencesReady] = useState(
      () => dependencies.shellPreferences?.isReady() ?? false,
    );
    const [shellPreferencesError, setShellPreferencesError] = useState<string | null>(null);
    const [diagnosticSettings, setDiagnosticSettings] = useState<DiagnosticSettings | null>(
      () => dependencies.diagnosticSettings?.getSnapshot() ?? null,
    );
    const [diagnosticSettingsReady, setDiagnosticSettingsReady] = useState(!dependencies.diagnosticSettings);
    const [diagnosticSettingsError, setDiagnosticSettingsError] = useState<string | null>(null);

    useEffect(() => {
      process.setTitle(processId, "Settings");
      void summarizeStorage(fs).then(setStorage);
    }, [fs, process, processId]);

    useEffect(() => {
      const store = dependencies.hiddenVisibility;
      if (!store) return undefined;
      let active = true;
      const unsubscribe = store.subscribe((preferences) => {
        if (active) setAlwaysShowHiddenFiles(preferences.alwaysShowHiddenFiles);
      });
      void store.load()
        .then((preferences) => {
          if (!active) return;
          setAlwaysShowHiddenFiles(preferences.alwaysShowHiddenFiles);
          setHiddenVisibilityReady(true);
          setHiddenVisibilityError(null);
        })
        .catch((cause: unknown) => {
          if (!active) return;
          setHiddenVisibilityReady(true);
          setHiddenVisibilityError(cause instanceof Error ? cause.message : String(cause));
        });
      return () => {
        active = false;
        unsubscribe();
      };
    }, []);

    useEffect(() => {
      const authority = dependencies.shellPreferences;
      if (!authority) return undefined;
      setShellSnapshot(authority.getSnapshot());
      setShellPreferencesReady(authority.isReady());
      return authority.subscribe((next, ready) => {
        setShellSnapshot(next);
        setShellPreferencesReady(ready);
      });
    }, [dependencies.shellPreferences]);

    useEffect(() => {
      const store = dependencies.diagnosticSettings;
      if (!store) return undefined;
      let active = true;
      const unsubscribe = store.subscribe((settings) => {
        if (active) setDiagnosticSettings(settings);
      });
      void store.load()
        .then((settings) => {
          if (!active) return;
          setDiagnosticSettings(settings);
          setDiagnosticSettingsReady(true);
          setDiagnosticSettingsError(null);
        })
        .catch((cause: unknown) => {
          if (!active) return;
          setDiagnosticSettingsReady(true);
          setDiagnosticSettingsError(cause instanceof Error ? cause.message : String(cause));
        });
      return () => {
        active = false;
        unsubscribe();
      };
    }, []);

    const updateShellPreferences = (patch: Partial<Exclude<typeof shellSnapshot, null>>) => {
      const authority = dependencies.shellPreferences;
      if (!authority || !shellSnapshot || !shellPreferencesReady) return;
      setShellPreferencesError(null);
      void authority.save({ ...shellSnapshot, ...patch }).then((outcome) => {
        if (!outcome.saved) {
          setShellPreferencesError(outcome.error instanceof Error ? outcome.error.message : String(outcome.error));
        }
      }).catch((cause: unknown) => {
        setShellPreferencesError(cause instanceof Error ? cause.message : String(cause));
      });
    };

    const theme = dependencies.getThemeName?.();
    const taskbar = dependencies.getTaskbarMode?.();
    const remoteReportingAvailable = dependencies.diagnosticSettings?.getCapabilities().remoteReporting ?? false;

    const saveDiagnosticSetting = (
      optimistic: DiagnosticSettings,
      operation: Promise<void>,
    ): void => {
      const store = dependencies.diagnosticSettings;
      if (!store) return;
      setDiagnosticSettings(optimistic);
      setDiagnosticSettingsError(null);
      void operation.catch((cause: unknown) => {
        setDiagnosticSettings(store.getSnapshot());
        setDiagnosticSettingsError(cause instanceof Error ? cause.message : String(cause));
      });
    };

    return (
      <NativeAppContentSurface style={styles.root} aria-label="Settings">
        <h1 style={styles.heading}>Settings</h1>

        <NativeAppPanel style={styles.card} aria-labelledby="storage-heading">
          <h2 id="storage-heading" style={styles.subheading}>Storage</h2>
          {!storage ? (
            <p>Calculating local storage…</p>
          ) : storage.unavailableReason ? (
            <p role="status">Storage summary unavailable: {storage.unavailableReason}</p>
          ) : (
            <p>{storage.files} files · {storage.directories} folders · {formatBytes(storage.bytes)} logical file data</p>
          )}
        </NativeAppPanel>

        <NativeAppPanel style={styles.card} aria-labelledby="files-heading">
          <h2 id="files-heading" style={styles.subheading}>Files & Explorer</h2>
          {dependencies.hiddenVisibility ? (
            <>
              <label style={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={alwaysShowHiddenFiles}
                  disabled={!hiddenVisibilityReady}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    const store = dependencies.hiddenVisibility;
                    if (!store) return;
                    const next = event.currentTarget.checked;
                    setAlwaysShowHiddenFiles(next);
                    setHiddenVisibilityError(null);
                    void store.setAlwaysShowHiddenFiles(next)
                      .catch((cause: unknown) => {
                        setAlwaysShowHiddenFiles(store.getSnapshot().alwaysShowHiddenFiles);
                        setHiddenVisibilityError(cause instanceof Error ? cause.message : String(cause));
                      });
                  }}
                />
                Always show hidden files
              </label>
              <p style={styles.helpText}>Show hidden resources across Search, Start, and File Explorer.</p>
              {hiddenVisibilityError ? <p role="alert">Hidden-file setting could not be saved: {hiddenVisibilityError}</p> : null}
            </>
          ) : (
            <p>Global hidden-file visibility is unavailable.</p>
          )}
        </NativeAppPanel>

        <NativeAppPanel style={styles.card} aria-labelledby="diagnostics-heading">
          <h2 id="diagnostics-heading" style={styles.subheading}>Diagnostics</h2>
          {dependencies.diagnosticSettings && diagnosticSettings ? (
            <>
              <label style={styles.controlRow}>
                System log minimum level
                <select
                  aria-label="System log minimum level"
                  style={styles.select}
                  value={diagnosticSettings.fileMinLevel}
                  disabled={!diagnosticSettingsReady}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                    const store = dependencies.diagnosticSettings;
                    if (!store) return;
                    const fileMinLevel = event.currentTarget.value as DiagnosticLevel;
                    saveDiagnosticSetting(
                      { ...diagnosticSettings, fileMinLevel },
                      store.setFileMinLevel(fileMinLevel),
                    );
                  }}
                >
                  {DIAGNOSTIC_LEVELS.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </label>
              <label style={styles.controlRow}>
                Browser console minimum level
                <select
                  aria-label="Browser console minimum level"
                  style={styles.select}
                  value={diagnosticSettings.consoleMinLevel}
                  disabled={!diagnosticSettingsReady}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => {
                    const store = dependencies.diagnosticSettings;
                    if (!store) return;
                    const consoleMinLevel = event.currentTarget.value as DiagnosticLevel;
                    saveDiagnosticSetting(
                      { ...diagnosticSettings, consoleMinLevel },
                      store.setConsoleMinLevel(consoleMinLevel),
                    );
                  }}
                >
                  {DIAGNOSTIC_LEVELS.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
              </label>
              <p style={styles.helpText}>
                Missing or invalid values use safe defaults: info for /System/system.log and warn for the browser console.
              </p>
              {remoteReportingAvailable && diagnosticSettings.remoteReportingEnabled !== undefined ? (
                <>
                  <label style={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={diagnosticSettings.remoteReportingEnabled}
                      disabled={!diagnosticSettingsReady}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => {
                        const store = dependencies.diagnosticSettings;
                        if (!store) return;
                        const remoteReportingEnabled = event.currentTarget.checked;
                        saveDiagnosticSetting(
                          { ...diagnosticSettings, remoteReportingEnabled },
                          store.setRemoteReportingEnabled(remoteReportingEnabled),
                        );
                      }}
                    />
                    Enable remote incident reporting
                  </label>
                  <p style={styles.helpText}>
                    This controls only the separately provided remote incident sink. Local diagnostics remain enabled.
                  </p>
                </>
              ) : null}
              {diagnosticSettingsError ? (
                <p role="alert">Diagnostic setting could not be saved: {diagnosticSettingsError}</p>
              ) : null}
            </>
          ) : (
            <p>Diagnostic sink controls are unavailable.</p>
          )}
        </NativeAppPanel>

        <NativeAppPanel style={styles.card} aria-labelledby="appearance-heading">
          <h2 id="appearance-heading" style={styles.subheading}>Appearance</h2>
          {shellSnapshot ? (
            <>
              <h3 style={styles.sectionHeading}>Theme</h3>
              <div style={styles.optionGrid}>
                {SHELL_THEME_IDS.map((themeId) => (
                  <button
                    key={themeId}
                    type="button"
                    disabled={!shellPreferencesReady}
                    aria-pressed={shellSnapshot.themeId === themeId}
                    onClick={() => updateShellPreferences({ themeId })}
                  >
                    {SHELL_THEME_LABELS[themeId]}
                  </button>
                ))}
              </div>
              <h3 style={styles.sectionHeading}>Appearance mode</h3>
              <div style={styles.optionGrid}>
                {SHELL_APPEARANCE_MODES.map((appearanceMode) => (
                  <button
                    key={appearanceMode}
                    type="button"
                    disabled={!shellPreferencesReady}
                    aria-pressed={shellSnapshot.appearanceMode === appearanceMode}
                    onClick={() => updateShellPreferences({ appearanceMode })}
                  >
                    {appearanceMode === "dark" ? "Dark" : "Light"}
                  </button>
                ))}
              </div>
              <h3 style={styles.sectionHeading}>Wallpaper</h3>
              <div style={styles.optionGrid}>
                <button
                  type="button"
                  disabled={!shellPreferencesReady || shellSnapshot.wallpaper.mode === "follow-theme"}
                  aria-pressed={shellSnapshot.wallpaper.mode === "follow-theme"}
                  onClick={() => updateShellPreferences({ wallpaper: { mode: "follow-theme" } })}
                >
                  Follow theme
                </button>
                {SHELL_WALLPAPER_IDS.map((wallpaperId) => (
                  <button
                    key={wallpaperId}
                    type="button"
                    disabled={!shellPreferencesReady || effectiveShellWallpaper(shellSnapshot.themeId, shellSnapshot.wallpaper) === wallpaperId}
                    aria-pressed={shellSnapshot.wallpaper.mode === "pinned" && shellSnapshot.wallpaper.id === wallpaperId}
                    onClick={() => updateShellPreferences({ wallpaper: { mode: "pinned", id: wallpaperId } })}
                  >
                    {SHELL_WALLPAPER_LABELS[wallpaperId]}
                  </button>
                ))}
              </div>
              <h3 style={styles.sectionHeading}>Desktop overlay</h3>
              <button
                type="button"
                disabled={!shellPreferencesReady}
                aria-label="Show Plasmon watermark"
                aria-pressed={shellSnapshot.showBrandWatermark !== false}
                onClick={() => updateShellPreferences({ showBrandWatermark: shellSnapshot.showBrandWatermark === false })}
              >
                Plasmon watermark: {shellSnapshot.showBrandWatermark !== false ? "On" : "Off"}
              </button>
              <p style={styles.helpText}>The Plasmon SVG watermark is layered over every wallpaper and can be hidden independently.</p>
              <h3 style={styles.sectionHeading}>Taskbar alignment</h3>
              <div style={styles.optionGrid}>
                <button type="button" disabled={!shellPreferencesReady} aria-pressed={shellSnapshot.taskbarAlignment === "center"} onClick={() => updateShellPreferences({ taskbarAlignment: "center" })}>Center</button>
                <button type="button" disabled={!shellPreferencesReady} aria-pressed={shellSnapshot.taskbarAlignment === "left"} onClick={() => updateShellPreferences({ taskbarAlignment: "left" })}>Left</button>
              </div>
              {shellPreferencesError ? <p role="alert">Appearance settings could not be saved: {shellPreferencesError}</p> : null}
            </>
          ) : dependencies.setThemeName ? (
            <label style={styles.controlRow}>
              Theme
              <select
                style={styles.select}
                value={theme ?? "system"}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => dependencies.setThemeName?.(event.currentTarget.value)}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
          ) : (
            <p>Theme controls will become available when Shell provides its settings callback.</p>
          )}
          {!shellSnapshot && (dependencies.setTaskbarMode ? (
            <label style={styles.controlRow}>
              Taskbar
              <select
                style={styles.select}
                value={taskbar ?? "default"}
                onChange={(event: ChangeEvent<HTMLSelectElement>) => dependencies.setTaskbarMode?.(event.currentTarget.value)}
              >
                <option value="default">Default</option>
                <option value="compact">Compact</option>
              </select>
            </label>
          ) : (
            <p>Taskbar preferences will become available when Shell provides its settings callback.</p>
          ))}
        </NativeAppPanel>

        <NativeAppPanel style={styles.card} aria-labelledby="associations-heading">
          <h2 id="associations-heading" style={styles.subheading}>File associations</h2>
          <p>
            {dependencies.associations
              ? "Per-resource defaults are available through Open With. A global default-enumeration API is not exposed by the current contract."
              : "File association changes are available per resource through Properties / Open With."}
          </p>
        </NativeAppPanel>

        <NativeAppPanel style={styles.card} aria-labelledby="future-heading">
          <h2 id="future-heading" style={styles.subheading}>Backup & sharing</h2>
          {settingsFeatureAvailability.map((feature) => (
            <p key={feature.id}><strong>{feature.label}:</strong> {feature.message}</p>
          ))}
        </NativeAppPanel>
      </NativeAppContentSurface>
    );
  };
}

export default createSettingsComponent();

const styles: Record<string, CSSProperties> = {
  root: {
    overflow: "auto",
    padding: 22,
  },
  heading: {
    margin: "0 0 18px",
    color: "var(--plasmon-text-primary)",
    fontSize: 24,
  },
  subheading: {
    margin: "0 0 8px",
    color: "var(--plasmon-text-primary)",
    fontSize: 16,
  },
  card: {
    marginBottom: 14,
  },
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
  controlRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginTop: 10,
    color: "var(--plasmon-text-primary)",
    fontWeight: 600,
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: 9,
    marginTop: 10,
    color: "var(--plasmon-text-primary)",
    fontWeight: 600,
  },
  helpText: {
    margin: "6px 0 0 25px",
    color: "var(--plasmon-text-secondary)",
    fontSize: 13,
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