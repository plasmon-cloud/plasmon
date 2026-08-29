import type { ComponentType } from "react";
import type {
  AssociationRule,
  HandlerDefinition,
  NativeAppDefinition,
} from "../os/contracts/index.ts";
import { FILE_TYPE_ICON_ASSETS, SYSTEM_ICON_ASSETS } from "../os/visual/assets.ts";
import { isCoreProfile } from "../os/integration/packageProfile.ts";
import type { PhotosProps } from "./photos/Photos.tsx";
import type { VideoPlayerProps } from "./video/VideoPlayer.tsx";
import type { BrowserProps } from "./browser/Browser.tsx";
import type { SettingsDependencies, SettingsHostProps } from "./settings/Settings.tsx";
import { IMAGE_EXTENSIONS, IMAGE_MIME_TYPES } from "./photos/media.ts";

export const textHandler: HandlerDefinition = { id: "native:text", kind: "native", name: "Text Editor", icon: FILE_TYPE_ICON_ASSETS.text, capabilities: ["read", "write"] };
export const markdownHandler: HandlerDefinition = { id: "native:markdown", kind: "native", name: "Markdown", icon: FILE_TYPE_ICON_ASSETS.markdown, capabilities: ["read", "write"] };
export const photosHandler: HandlerDefinition = { id: "native:photos", kind: "native", name: "Photos", icon: SYSTEM_ICON_ASSETS.photos, capabilities: ["read"] };
export const videoHandler: HandlerDefinition = { id: "native:video", kind: "native", name: "Video Player", icon: FILE_TYPE_ICON_ASSETS.video, capabilities: ["read", "url"] };
export const browserHandler: HandlerDefinition = { id: "native:browser", kind: "native", name: "Browser", icon: SYSTEM_ICON_ASSETS.browser, capabilities: ["read", "url"] };
export const settingsHandler: HandlerDefinition = { id: "native:settings", kind: "native", name: "Settings", icon: SYSTEM_ICON_ASSETS.settings, capabilities: [] };

/** Metadata-only external routing target; OpenService owns external URL execution. */
export const externalUrlHandler: HandlerDefinition = { id: "external:url", kind: "external", name: "Open in browser tab", icon: browserHandler.icon, capabilities: ["url"] };

export const textAssociationRules: AssociationRule[] = [
  { id: "native:text:txt", handlerId: "native:text", extensions: [".txt"], mimeTypes: ["text/plain"], priority: 200 },
  { id: "native:text:source", handlerId: "native:text", extensions: [".json", ".js", ".ts", ".tsx", ".jsx", ".run", ".cmd", ".css", ".html", ".htm", ".xml", ".yaml", ".yml", ".toml", ".md", ".markdown"], mimeTypes: ["text/*", "application/json", "application/xml", "application/javascript"], priority: 40 },
  { id: "text:wildcard", handlerId: "native:text", mimeTypes: ["*/*"], priority: -1_000_000 },
];
export const markdownAssociationRules: AssociationRule[] = [
  { id: "native:markdown:markdown", handlerId: "native:markdown", extensions: [".md", ".markdown"], mimeTypes: ["text/markdown"], priority: 220 },
];
export const photosAssociationRules: AssociationRule[] = [
  { id: "native:photos:images", handlerId: "native:photos", extensions: [...IMAGE_EXTENSIONS], mimeTypes: [...IMAGE_MIME_TYPES], priority: 210 },
];
export const videoAssociationRules: AssociationRule[] = [
  { id: "native:video:common", handlerId: "native:video", extensions: [".mp4", ".m4v", ".webm", ".mov", ".ogv", ".ogg"], mimeTypes: ["video/*"], priority: 200 },
];
export const browserAssociationRules: AssociationRule[] = [
  { id: "native:browser:url", handlerId: "native:browser", extensions: [".url"], priority: 180 },
];

export const textAppDefinition: NativeAppDefinition = { id: "native:text", handlerId: "native:text", name: "Text Editor", icon: textHandler.icon, singleton: false, defaultWindow: { width: 820, height: 600, minWidth: 440, minHeight: 300 }, associations: textAssociationRules };
export const markdownAppDefinition: NativeAppDefinition = { id: "native:markdown", handlerId: "native:markdown", name: "Markdown", icon: markdownHandler.icon, singleton: false, defaultWindow: { width: 980, height: 660, minWidth: 560, minHeight: 340 }, associations: markdownAssociationRules };
export const photosAppDefinition: NativeAppDefinition = { id: "native:photos", handlerId: "native:photos", name: "Photos", icon: photosHandler.icon, singleton: false, defaultWindow: { width: 820, height: 600, minWidth: 440, minHeight: 320 }, associations: photosAssociationRules };
export const videoAppDefinition: NativeAppDefinition = { id: "native:video", handlerId: "native:video", name: "Video Player", icon: videoHandler.icon, singleton: false, defaultWindow: { width: 820, height: 520, minWidth: 480, minHeight: 300 }, associations: videoAssociationRules };
export const browserAppDefinition: NativeAppDefinition = { id: "native:browser", handlerId: "native:browser", name: "Browser", icon: browserHandler.icon, singleton: false, defaultWindow: { width: 980, height: 680, minWidth: 560, minHeight: 360 }, associations: browserAssociationRules };
export const settingsAppDefinition: NativeAppDefinition = { id: "native:settings", handlerId: "native:settings", name: "Settings", icon: settingsHandler.icon, singleton: true, defaultWindow: { width: 760, height: 620, minWidth: 520, minHeight: 380 }, associations: [] };

const coreContentAppDefinitions = [photosAppDefinition, videoAppDefinition, browserAppDefinition, settingsAppDefinition] as const;
const coreContentHandlerDefinitions = [photosHandler, videoHandler, browserHandler, settingsHandler, externalUrlHandler] as const;
const coreContentAssociationRules = [...photosAssociationRules, ...videoAssociationRules, ...browserAssociationRules] as const;

export const contentAppDefinitions = isCoreProfile
  ? coreContentAppDefinitions
  : [textAppDefinition, markdownAppDefinition, ...coreContentAppDefinitions] as const;
export const contentHandlerDefinitions = isCoreProfile
  ? coreContentHandlerDefinitions
  : [textHandler, markdownHandler, ...coreContentHandlerDefinitions] as const;
export const contentAssociationRules = isCoreProfile
  ? coreContentAssociationRules
  : [...textAssociationRules, ...markdownAssociationRules, ...coreContentAssociationRules] as const;

export const loadTextComponent = () => import("./text/TextEditor.tsx");
export const loadMarkdownComponent = () => import("./markdown/MarkdownEditor.tsx");
export const loadPhotosComponent = () => import("./photos/Photos.tsx");
export const loadVideoComponent = () => import("./video/VideoPlayer.tsx");
export const loadBrowserComponent = () => import("./browser/Browser.tsx");
export function createSettingsLoader(dependencies: SettingsDependencies = {}): () => Promise<{ default: ComponentType<SettingsHostProps> }> {
  return async () => { const module = await import("./settings/Settings.tsx"); return { default: module.createSettingsComponent(dependencies) }; };
}

/** Convenience loader map; editor loaders are absent from the core package profile. */
export function createContentAppLoaders(settingsDependencies: SettingsDependencies = {}) {
  const loaders = new Map<string, () => Promise<{ default: ComponentType<any> }>>([
    [photosAppDefinition.id, loadPhotosComponent as () => Promise<{ default: ComponentType<PhotosProps> }>],
    [videoAppDefinition.id, loadVideoComponent as () => Promise<{ default: ComponentType<VideoPlayerProps> }>],
    [browserAppDefinition.id, loadBrowserComponent as () => Promise<{ default: ComponentType<BrowserProps> }>],
    [settingsAppDefinition.id, createSettingsLoader(settingsDependencies)],
  ]);
  if (!isCoreProfile) {
    loaders.set(textAppDefinition.id, loadTextComponent);
    loaders.set(markdownAppDefinition.id, loadMarkdownComponent);
  }
  return loaders;
}
