import { useEffect, useState, type CSSProperties } from "react";
import type { FsNode, FsService, NodeId } from "../../os/contracts/index.ts";
import {
  SHELL_WALLPAPER_IDS,
  SHELL_WALLPAPER_LABELS,
  SHELL_WALLPAPER_LAYOUTS,
  SHELL_WALLPAPER_LAYOUT_LABELS,
  type ShellPreferences,
} from "../../os/shell/preferences.ts";
import { listWallpaperDirectory, type WallpaperDirectoryEntry } from "../../os/shell/wallpaperResource.ts";
import { PLASMON_VISUAL_ASSET_ROOT } from "../../os/visual/assets.ts";
import { NativeAppButton } from "../../os/visual/index.ts";

export interface WallpaperPersonalizationProps {
  fs: FsService;
  preferences: ShellPreferences;
  ready: boolean;
  onChange: (patch: Partial<ShellPreferences>) => void;
}

function wallpaperAsset(wallpaperId: (typeof SHELL_WALLPAPER_IDS)[number]): string {
  const extension = wallpaperId === "graphite-sand" ? "jpg" : "svg";
  return `${PLASMON_VISUAL_ASSET_ROOT}/wallpapers/${wallpaperId}.${extension}`;
}

export function WallpaperPersonalization({ fs, preferences, ready, onChange }: WallpaperPersonalizationProps) {
  const [chooserOpen, setChooserOpen] = useState(false);
  const [directory, setDirectory] = useState<FsNode | null>(null);
  const [entries, setEntries] = useState<WallpaperDirectoryEntry[]>([]);
  const [chooserError, setChooserError] = useState<string | null>(null);
  const [selectedFilesystemName, setSelectedFilesystemName] = useState<string | null>(null);

  const selectedNodeId = preferences.wallpaper.mode === "filesystem" ? preferences.wallpaper.nodeId : null;

  useEffect(() => {
    let active = true;
    if (!selectedNodeId) {
      setSelectedFilesystemName(null);
      return () => { active = false; };
    }
    void fs.stat(selectedNodeId).then((node) => {
      if (active) setSelectedFilesystemName(node.name);
    }).catch(() => {
      if (active) setSelectedFilesystemName(null);
    });
    return () => { active = false; };
  }, [fs, selectedNodeId]);

  const openDirectory = async (node: FsNode): Promise<void> => {
    if (node.kind !== "directory") return;
    setChooserError(null);
    try {
      const nextEntries = await listWallpaperDirectory(fs, node.id);
      setDirectory(node);
      setEntries(nextEntries);
    } catch (cause: unknown) {
      setChooserError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  const openChooser = (): void => {
    setChooserOpen(true);
    setChooserError(null);
    void (async () => {
      const pictures = await fs.resolvePath("/Pictures");
      const root = pictures?.kind === "directory" ? pictures : await fs.resolvePath("/");
      if (!root || root.kind !== "directory") throw new Error("Filesystem root is unavailable");
      await openDirectory(root);
    })().catch((cause: unknown) => {
      setChooserError(cause instanceof Error ? cause.message : String(cause));
    });
  };

  const goUp = (): void => {
    if (!directory?.parentId) return;
    void fs.stat(directory.parentId).then(openDirectory).catch((cause: unknown) => {
      setChooserError(cause instanceof Error ? cause.message : String(cause));
    });
  };

  return (
    <>
      <h3 style={styles.heading}>Wallpaper</h3>
      <div style={styles.thumbnailGrid} role="group" aria-label="Built-in wallpapers">
        <NativeAppButton
          type="button"
          disabled={!ready}
          aria-pressed={preferences.wallpaper.mode === "follow-theme"}
          onClick={() => onChange({ wallpaper: { mode: "follow-theme" } })}
          style={styles.followTheme}
        >
          Follow theme
        </NativeAppButton>
        {SHELL_WALLPAPER_IDS.map((wallpaperId) => (
          <NativeAppButton
            key={wallpaperId}
            type="button"
            disabled={!ready}
            aria-label={SHELL_WALLPAPER_LABELS[wallpaperId]}
            aria-pressed={preferences.wallpaper.mode === "pinned" && preferences.wallpaper.id === wallpaperId}
            onClick={() => onChange({ wallpaper: { mode: "pinned", id: wallpaperId } })}
            style={styles.thumbnailButton}
          >
            <img
              src={wallpaperAsset(wallpaperId)}
              alt=""
              draggable={false}
              style={styles.thumbnailImage}
            />
            <span style={styles.thumbnailLabel}>{SHELL_WALLPAPER_LABELS[wallpaperId]}</span>
          </NativeAppButton>
        ))}
      </div>

      <div style={styles.filesystemRow}>
        <NativeAppButton type="button" disabled={!ready} onClick={openChooser}>
          Choose filesystem image…
        </NativeAppButton>
        {selectedNodeId ? (
          <span role="status" style={styles.statusText}>
            {selectedFilesystemName ? `Selected: ${selectedFilesystemName}` : "Selected filesystem image is currently unavailable"}
          </span>
        ) : null}
      </div>

      {chooserOpen ? (
        <div style={styles.chooser} aria-label="Filesystem wallpaper chooser">
          <div style={styles.chooserToolbar}>
            <NativeAppButton type="button" disabled={!directory?.parentId} onClick={goUp}>Up</NativeAppButton>
            <span style={styles.pathText}>{directory ? `Folder: ${directory.name || "/"}` : "Loading…"}</span>
            <NativeAppButton type="button" onClick={() => setChooserOpen(false)}>Close</NativeAppButton>
          </div>
          {chooserError ? <p role="alert">Could not browse wallpapers: {chooserError}</p> : null}
          <div style={styles.fileList}>
            {entries.map(({ node, supportedImage }) => node.kind === "directory" ? (
              <NativeAppButton key={node.id} type="button" onClick={() => { void openDirectory(node); }}>
                Folder: {node.name}
              </NativeAppButton>
            ) : (
              <NativeAppButton
                key={node.id}
                type="button"
                disabled={!supportedImage}
                aria-pressed={selectedNodeId === node.id}
                onClick={() => {
                  onChange({ wallpaper: { mode: "filesystem", nodeId: node.id } });
                  setChooserOpen(false);
                }}
              >
                {node.name}{supportedImage ? "" : " (unsupported)"}
              </NativeAppButton>
            ))}
          </div>
        </div>
      ) : null}

      <h3 style={styles.heading}>Wallpaper layout</h3>
      <div style={styles.optionGrid} role="group" aria-label="Wallpaper layout">
        {SHELL_WALLPAPER_LAYOUTS.map((layout) => (
          <NativeAppButton
            key={layout}
            type="button"
            disabled={!ready}
            aria-pressed={preferences.wallpaperLayout === layout}
            onClick={() => onChange({ wallpaperLayout: layout })}
          >
            {SHELL_WALLPAPER_LAYOUT_LABELS[layout]}
          </NativeAppButton>
        ))}
      </div>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  heading: {
    margin: "14px 0 8px",
    color: "var(--plasmon-text-primary)",
    fontSize: 14,
  },
  thumbnailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(132px, 1fr))",
    gap: 10,
  },
  followTheme: {
    minHeight: 92,
  },
  thumbnailButton: {
    display: "grid",
    gap: 6,
    padding: 7,
    textAlign: "left",
  },
  thumbnailImage: {
    width: "100%",
    aspectRatio: "16 / 9",
    objectFit: "cover",
    borderRadius: 5,
    border: "1px solid var(--plasmon-border-subtle)",
  },
  thumbnailLabel: {
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  filesystemRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  statusText: {
    color: "var(--plasmon-text-secondary)",
    fontSize: 13,
  },
  chooser: {
    marginTop: 10,
    padding: 10,
    border: "1px solid var(--plasmon-border-subtle)",
    borderRadius: "var(--plasmon-radius-control)",
    background: "var(--plasmon-window-background)",
  },
  chooserToolbar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  pathText: {
    flex: 1,
    color: "var(--plasmon-text-secondary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  fileList: {
    display: "grid",
    gap: 6,
    marginTop: 8,
    maxHeight: 220,
    overflow: "auto",
  },
  optionGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
};
