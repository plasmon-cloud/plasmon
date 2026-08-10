import type { ComponentType } from "react";
import type {
  AssociationRule,
  HandlerDefinition,
  NativeAppDefinition,
} from "../os/contracts/index.ts";
import type { TextEditorProps } from "./text/TextEditor.tsx";
import type { MarkdownEditorProps } from "./markdown/MarkdownEditor.tsx";
import type { VideoPlayerProps } from "./video/VideoPlayer.tsx";
import type { BrowserProps } from "./browser/Browser.tsx";
import type { SettingsDependencies, SettingsHostProps } from "./settings/Settings.tsx";

const icon = (label: string, glyph: string): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect x="4" y="4" width="56" height="56" rx="12" fill="#eef1f5" stroke="#6a7482"/><text x="32" y="40" text-anchor="middle" font-family="system-ui,sans-serif" font-size="25" font-weight="700" fill="#26313d" aria-label="${label}">${glyph}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export const textHandler: HandlerDefinition = { id: "native:text", kind: "native", name: "Text Editor", icon: icon("Text", "T"), capabilities: ["read", "write"] };
export const markdownHandler: HandlerDefinition = { id: "native:markdown", kind: "native", name: "Markdown", icon: icon("Markdown", "M↓"), capabilities: ["read", "write"] };
export const videoHandler: HandlerDefinition = { id: "native:video", kind: "native", name: "Video Player", icon: icon("Video", "▶"), capabilities: ["read", "url"] };
export const browserHandler: HandlerDefinition = { id: "native:browser", kind: "native", name: "Browser", icon: icon("Browser", "↗"), capabilities: ["read", "url"] };
export const settingsHandler: HandlerDefinition = { id: "native:settings", kind: "native", name: "Settings", icon: icon("Settings", "S"), capabilities: [] };

/** Metadata-only external routing target; Coordinator A owns OpenService execution. */
export const externalUrlHandler: HandlerDefinition = { id: "external:url", kind: "external", name: "Open in browser tab", icon: browserHandler.icon, capabilities: ["url"] };

export const textAssociationRules: AssociationRule[] = [
  { id: "native:text:txt", handlerId: "native:text", extensions: [".txt"], mimeTypes: ["text/plain"], priority: 200 },
  { id: "native:text:source", handlerId: "native:text", extensions: [".json", ".js", ".ts", ".tsx", ".jsx", ".css", ".html", ".htm", ".xml", ".yaml", ".yml", ".toml", ".md", ".markdown"], mimeTypes: ["text/*", "application/json", "application/xml", "application/javascript"], priority: 40 },
];
export const markdownAssociationRules: AssociationRule[] = [
  { id: "native:markdown:markdown", handlerId: "native:markdown", extensions: [".md", ".markdown"], mimeTypes: ["text/markdown"], priority: 220 },
];
export const videoAssociationRules: AssociationRule[] = [
  { id: "native:video:common", handlerId: "native:video", extensions: [".mp4", ".m4v", ".webm", ".mov", ".ogv", ".ogg"], mimeTypes: ["video/*"], priority: 200 },
];
export const browserAssociationRules: AssociationRule[] = [
  { id: "native:browser:url", handlerId: "native:browser", extensions: [".url"], priority: 180 },
];

export const textAppDefinition: NativeAppDefinition = { id: "native:text", handlerId: "native:text", name: "Text Editor", icon: textHandler.icon, singleton: false, defaultWindow: { width: 760, height: 560, minWidth: 420, minHeight: 280 }, associations: textAssociationRules };
export const markdownAppDefinition: NativeAppDefinition = { id: "native:markdown", handlerId: "native:markdown", name: "Markdown", icon: markdownHandler.icon, singleton: false, defaultWindow: { width: 920, height: 620, minWidth: 520, minHeight: 320 }, associations: markdownAssociationRules };
export const videoAppDefinition: NativeAppDefinition = { id: "native:video", handlerId: "native:video", name: "Video Player", icon: videoHandler.icon, singleton: false, defaultWindow: { width: 820, height: 520, minWidth: 480, minHeight: 300 }, associations: videoAssociationRules };
export const browserAppDefinition: NativeAppDefinition = { id: "native:browser", handlerId: "native:browser", name: "Browser", icon: browserHandler.icon, singleton: false, defaultWindow: { width: 980, height: 680, minWidth: 560, minHeight: 360 }, associations: browserAssociationRules };
export const settingsAppDefinition: NativeAppDefinition = { id: "native:settings", handlerId: "native:settings", name: "Settings", icon: settingsHandler.icon, singleton: true, defaultWindow: { width: 760, height: 620, minWidth: 520, minHeight: 380 }, associations: [] };

export const contentAppDefinitions = [textAppDefinition, markdownAppDefinition, videoAppDefinition, browserAppDefinition, settingsAppDefinition] as const;
export const contentHandlerDefinitions = [textHandler, markdownHandler, videoHandler, browserHandler, settingsHandler, externalUrlHandler] as const;
export const contentAssociationRules = [...textAssociationRules, ...markdownAssociationRules, ...videoAssociationRules, ...browserAssociationRules] as const;

export const loadTextComponent = () => import("./text/TextEditor.tsx");
export const loadMarkdownComponent = () => import("./markdown/MarkdownEditor.tsx");
export const loadVideoComponent = () => import("./video/VideoPlayer.tsx");
export const loadBrowserComponent = () => import("./browser/Browser.tsx");
export function createSettingsLoader(dependencies: SettingsDependencies = {}): () => Promise<{ default: ComponentType<SettingsHostProps> }> {
  return async () => { const module = await import("./settings/Settings.tsx"); return { default: module.createSettingsComponent(dependencies) }; };
}
/** Convenience loader map for Coordinator A; it does not mutate the global registry. */
export function createContentAppLoaders(settingsDependencies: SettingsDependencies = {}) {
  return new Map<string, () => Promise<{ default: ComponentType<any> }>>([
    [textAppDefinition.id, loadTextComponent as () => Promise<{ default: ComponentType<TextEditorProps> }>],
    [markdownAppDefinition.id, loadMarkdownComponent as () => Promise<{ default: ComponentType<MarkdownEditorProps> }>],
    [videoAppDefinition.id, loadVideoComponent as () => Promise<{ default: ComponentType<VideoPlayerProps> }>],
    [browserAppDefinition.id, loadBrowserComponent as () => Promise<{ default: ComponentType<BrowserProps> }>],
    [settingsAppDefinition.id, createSettingsLoader(settingsDependencies)],
  ]);
}
