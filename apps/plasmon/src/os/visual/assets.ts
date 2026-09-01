export const PLASMON_VISUAL_ASSET_ROOT = "static/plasmon";
export const PLASMON_ICON_ASSET_ROOT = `${PLASMON_VISUAL_ASSET_ROOT}/icons`;

export type FileTypeIconName =
  | "folder"
  | "file"
  | "text"
  | "markdown"
  | "image"
  | "video"
  | "audio"
  | "atom"
  | "jsdos"
  | "rom-game"
  | "game-save"
  | "emulator-save-state"
  | "dos-changes";

export type SystemIconName =
  | "application"
  | "file-manager"
  | "settings"
  | "start"
  | "search"
  | "photos"
  | "browser"
  | "recycle-bin"
  | "properties"
  | "terminal"
  | "pin";

export const FILE_TYPE_ICON_ASSETS: Readonly<Record<FileTypeIconName, string>> = Object.freeze({
  folder: `${PLASMON_ICON_ASSET_ROOT}/folder.svg`,
  file: `${PLASMON_ICON_ASSET_ROOT}/file.svg`,
  text: `${PLASMON_ICON_ASSET_ROOT}/text.svg`,
  markdown: `${PLASMON_ICON_ASSET_ROOT}/markdown.svg`,
  image: `${PLASMON_ICON_ASSET_ROOT}/image.svg`,
  video: `${PLASMON_ICON_ASSET_ROOT}/video.svg`,
  audio: `${PLASMON_ICON_ASSET_ROOT}/audio.svg`,
  atom: `${PLASMON_ICON_ASSET_ROOT}/atom.svg`,
  jsdos: `${PLASMON_ICON_ASSET_ROOT}/jsdos.svg`,
  "rom-game": `${PLASMON_ICON_ASSET_ROOT}/rom-game.svg`,
  "game-save": `${PLASMON_ICON_ASSET_ROOT}/game-save.svg`,
  "emulator-save-state": `${PLASMON_ICON_ASSET_ROOT}/emulator-save-state.svg`,
  "dos-changes": `${PLASMON_ICON_ASSET_ROOT}/dos-changes.svg`,
});

export const SYSTEM_ICON_ASSETS: Readonly<Record<SystemIconName, string>> = Object.freeze({
  application: `${PLASMON_ICON_ASSET_ROOT}/application.svg`,
  "file-manager": `${PLASMON_ICON_ASSET_ROOT}/file-manager.svg`,
  settings: `${PLASMON_ICON_ASSET_ROOT}/settings.svg`,
  start: `${PLASMON_ICON_ASSET_ROOT}/start.svg`,
  search: `${PLASMON_ICON_ASSET_ROOT}/search.svg`,
  photos: `${PLASMON_ICON_ASSET_ROOT}/photos.svg`,
  browser: `${PLASMON_ICON_ASSET_ROOT}/browser.svg`,
  "recycle-bin": `${PLASMON_ICON_ASSET_ROOT}/recycle-bin.svg`,
  properties: `${PLASMON_ICON_ASSET_ROOT}/properties.svg`,
  terminal: `${PLASMON_ICON_ASSET_ROOT}/terminal.svg`,
  pin: `${PLASMON_ICON_ASSET_ROOT}/pin.svg`,
});

export const SHORTCUT_OVERLAY_ASSET = `${PLASMON_ICON_ASSET_ROOT}/shortcut-overlay.svg`;
export const PLASMON_MARK_ASSET = `${PLASMON_VISUAL_ASSET_ROOT}/plasmon-mark.svg`;
export const PLASMON_WALLPAPER_ASSET = `${PLASMON_VISUAL_ASSET_ROOT}/wallpaper.svg`;
