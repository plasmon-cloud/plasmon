import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { appIndexUrl, canisterIdFromUrl } from "neutron-tools/src/runtime.js";
import { InstallDialog } from "../components/InstallDialog.tsx";
import {
  createPlatform,
  type PlasmonApp,
  type PlatformMode,
  type PlatformSnapshot,
} from "../platform/index.ts";
import {
  cloneItemTree,
  descendants,
  loadIconPositions,
  loadPins,
  loadVfs,
  saveIconPositions,
  savePins,
  saveVfs,
  uniqueName,
  type IconPositions,
  type VfsItem,
} from "./model.ts";

type WindowKind =
  | "control"
  | "explorer"
  | "markdown"
  | "video"
  | "image"
  | "terminal"
  | "calculator"
  | "about"
  | "doom";

type GuiWindow = {
  id: string;
  kind: WindowKind;
  title: string;
  glyph: string;
  targetId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
};

type ClipboardState = {
  mode: "copy" | "cut";
  ids: string[];
} | null;

type ContextMenuState =
  | { kind: "desktop"; x: number; y: number }
  | { kind: "item"; x: number; y: number; id: string };

type MarqueeState = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type DesktopDescriptor =
  | { id: string; kind: "native"; native: WindowKind; name: string; subtitle: string }
  | { id: string; kind: "app"; app: PlasmonApp; name: string; subtitle: string }
  | { id: string; kind: "file"; file: VfsItem; name: string; subtitle: string };

const NATIVE_DESKTOP: Array<Extract<DesktopDescriptor, { kind: "native" }>> = [
  { id: "native:explorer", kind: "native", native: "explorer", name: "Files", subtitle: "Plasmon" },
  { id: "native:control", kind: "native", native: "control", name: "Plasmon Control", subtitle: "System" },
  { id: "native:terminal", kind: "native", native: "terminal", name: "Terminal", subtitle: "Console" },
  { id: "native:markdown", kind: "native", native: "markdown", name: "Markdown", subtitle: "Editor" },
  { id: "native:video", kind: "native", native: "video", name: "Media Player", subtitle: "Videos" },
  { id: "native:doom", kind: "native", native: "doom", name: "Doom", subtitle: "Web game" },
];

const NATIVE_META: Record<WindowKind, { title: string; glyph: string; width: number; height: number }> = {
  control: { title: "Plasmon Control", glyph: "⚛", width: 900, height: 620 },
  explorer: { title: "Files", glyph: "▰", width: 860, height: 590 },
  markdown: { title: "Markdown", glyph: "M↓", width: 900, height: 650 },
  video: { title: "Media Player", glyph: "▶", width: 840, height: 590 },
  image: { title: "Photos", glyph: "▧", width: 760, height: 560 },
  terminal: { title: "Terminal", glyph: ">_", width: 780, height: 500 },
  calculator: { title: "Calculator", glyph: "∑", width: 370, height: 520 },
  about: { title: "About Plasmon", glyph: "i", width: 560, height: 430 },
  doom: { title: "Doom", glyph: "D", width: 860, height: 610 },
};

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function modeLabel(mode: PlatformMode): string {
  if (mode === "preview") return "Preview";
  if (mode === "tenant-capable") return "Tenant capable";
  return "Vanilla Neutron";
}

function appVersion(version?: number): string {
  if (version === undefined) return "";
  const major = Math.floor(version / 10_000);
  const minor = Math.floor((version % 10_000) / 100);
  const patch = version % 100;
  return `${major}.${minor}.${patch}`;
}

function appIconUrl(app: PlasmonApp): string | null {
  if (typeof window === "undefined") return null;
  const canisterId = canisterIdFromUrl(window.location.href);
  if (!canisterId) return null;
  const local = window.location.hostname.endsWith(".localhost");
  const localHost = local
    ? `${window.location.protocol}//localhost${window.location.port ? `:${window.location.port}` : ""}`
    : undefined;
  try {
    return appIndexUrl({
      canisterId,
      appId: app.id,
      path: "static/icon.svg",
      local,
      ...(localHost ? { localHost } : {}),
    });
  } catch {
    return null;
  }
}

function initials(app: PlasmonApp): string {
  const words = app.name.trim().split(/\s+/u).filter(Boolean);
  const value = words.slice(0, 2).map((word) => word[0]).join("");
  return (value || app.id.slice(0, 2) || "A").toUpperCase();
}

function defaultWindow(
  kind: WindowKind,
  z: number,
  offset: number,
  targetId?: string,
  title?: string,
): GuiWindow {
  const meta = NATIVE_META[kind];
  return {
    id: targetId ? `${kind}:${targetId}` : `native:${kind}`,
    kind,
    title: title ?? meta.title,
    glyph: meta.glyph,
    ...(targetId ? { targetId } : {}),
    x: 84 + (offset % 7) * 26,
    y: 54 + (offset % 7) * 24,
    width: meta.width,
    height: meta.height,
    z,
    minimized: false,
    maximized: false,
  };
}

function defaultIconPosition(index: number): { x: number; y: number } {
  const rows = 6;
  return {
    x: 18 + Math.floor(index / rows) * 98,
    y: 16 + (index % rows) * 102,
  };
}

function fileGlyph(item: VfsItem): string {
  if (item.kind === "folder") return "▰";
  if (item.kind === "markdown") return "M↓";
  if (item.kind === "text") return "≡";
  if (item.kind === "video") return "▶";
  if (item.kind === "image") return "▧";
  if (item.kind === "atom") return "◈";
  return "□";
}

function nativeGlyph(kind: WindowKind): string {
  return NATIVE_META[kind].glyph;
}

export function DesktopShell2() {
  const [platform] = useState(() => createPlatform());
  const [snapshot, setSnapshot] = useState<PlatformSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [installBusy, setInstallBusy] = useState(false);
  const [windows, setWindows] = useState<GuiWindow[]>([]);
  const [vfs, setVfs] = useState<VfsItem[]>(() => loadVfs());
  const [positions, setPositions] = useState<IconPositions>(() => loadIconPositions());
  const [pins, setPins] = useState<string[]>(() => loadPins());
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [clipboard, setClipboard] = useState<ClipboardState>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [trayOpen, setTrayOpen] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const desktopRef = useRef<HTMLElement>(null);
  const zCounter = useRef(30);
  const marqueeRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    base: Set<string>;
  } | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    ids: string[];
    base: IconPositions;
    moved: boolean;
  } | null>(null);

  const refresh = () => {
    setLoading(true);
    setError(null);
    platform
      .load()
      .then(setSnapshot)
      .catch((cause: unknown) => setError(formatError(cause)))
      .finally(() => setLoading(false));
  };

  useEffect(refresh, [platform]);
  useEffect(() => saveVfs(vfs), [vfs]);
  useEffect(() => saveIconPositions(positions), [positions]);
  useEffect(() => savePins(pins), [pins]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const apps = snapshot?.apps ?? [];
  const liveAppIds = snapshot?.liveAppIds ?? new Set<string>();
  const mode = snapshot?.mode ?? platform.mode;
  const trayApps = apps.filter((app) => app.tray);

  const desktopItems = useMemo<DesktopDescriptor[]>(() => {
    const native: DesktopDescriptor[] = NATIVE_DESKTOP;
    const appItems: DesktopDescriptor[] = apps.map((app) => ({
      id: `app:${app.id}`,
      kind: "app",
      app,
      name: app.name,
      subtitle: appVersion(app.version) || "Neutron app",
    }));
    const files: DesktopDescriptor[] = vfs
      .filter((item) => item.parentId === "desktop")
      .map((file) => ({
        id: `file:${file.id}`,
        kind: "file",
        file,
        name: file.name,
        subtitle: file.detail ?? file.kind,
      }));
    return [...native, ...appItems, ...files];
  }, [apps, vfs]);

  const positionFor = (id: string, index: number) => positions[id] ?? defaultIconPosition(index);

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => (current === message ? null : current)), 4200);
  };

  const closeMenus = () => {
    setStartOpen(false);
    setSearchOpen(false);
    setCalendarOpen(false);
    setTrayOpen(false);
    setContextMenu(null);
  };

  const focusWindow = (id: string) => {
    const z = ++zCounter.current;
    setWindows((current) =>
      current.map((entry) =>
        entry.id === id ? { ...entry, minimized: false, z } : entry,
      ),
    );
  };

  const openNative = (
    kind: WindowKind,
    options: { targetId?: string; title?: string; folderId?: string } = {},
  ) => {
    closeMenus();
    const targetId = options.targetId ?? options.folderId;
    const id = targetId ? `${kind}:${targetId}` : `native:${kind}`;
    const z = ++zCounter.current;
    setWindows((current) => {
      const existing = current.find((entry) => entry.id === id);
      if (existing) {
        return current.map((entry) =>
          entry.id === id
            ? {
                ...entry,
                z,
                minimized: false,
                ...(targetId ? { targetId } : {}),
              }
            : entry,
        );
      }
      return [
        ...current,
        defaultWindow(kind, z, current.length, targetId, options.title),
      ];
    });
  };

  const closeWindow = (id: string) =>
    setWindows((current) => current.filter((entry) => entry.id !== id));

  const mutateWindow = (id: string, update: (entry: GuiWindow) => GuiWindow) =>
    setWindows((current) =>
      current.map((entry) => (entry.id === id ? update(entry) : entry)),
    );

  const launchApp = (app: PlasmonApp) => {
    closeMenus();
    setError(null);
    const pending = platform.open(app);
    setLaunchingId(app.id);
    pending
      .then(() => {
        notify(
          snapshot?.mode === "preview"
            ? `Preview: would open ${app.name} in Neutron.`
            : `${app.name} opened/focused as a real Neutron tile.`,
        );
        window.setTimeout(refresh, 250);
      })
      .catch((cause: unknown) => setError(formatError(cause)))
      .finally(() => setLaunchingId(null));
  };

  const installApp = (url: string) => {
    setError(null);
    const pending = platform.install(url);
    setInstallBusy(true);
    pending
      .then(() => {
        setInstallOpen(false);
        notify("Install offer handed to Kernel. Refresh after installation completes.");
      })
      .catch((cause: unknown) => setError(formatError(cause)))
      .finally(() => setInstallBusy(false));
  };

  const togglePin = (key: string) =>
    setPins((current) =>
      current.includes(key)
        ? current.filter((candidate) => candidate !== key)
        : [...current, key],
    );

  const createFolder = (parentId = "desktop", requested = "New folder"): VfsItem => {
    const item: VfsItem = {
      id: `folder-${cryptoId()}`,
      parentId,
      name: uniqueName(vfs, parentId, requested),
      kind: "folder",
      detail: "Folder",
      modified: Date.now(),
    };
    setVfs((current) => [...current, item]);
    return item;
  };

  const createMarkdown = (parentId = "desktop", requested = "Untitled.md"): VfsItem => {
    const item: VfsItem = {
      id: `markdown-${cryptoId()}`,
      parentId,
      name: uniqueName(vfs, parentId, requested.endsWith(".md") ? requested : `${requested}.md`),
      kind: "markdown",
      content: "# Untitled\n\nStart writing…\n",
      detail: "Markdown document",
      modified: Date.now(),
    };
    setVfs((current) => [...current, item]);
    return item;
  };

  const createText = (parentId: string, requested: string): VfsItem => {
    const item: VfsItem = {
      id: `text-${cryptoId()}`,
      parentId,
      name: uniqueName(vfs, parentId, requested),
      kind: "text",
      content: "",
      detail: "Text document",
      modified: Date.now(),
    };
    setVfs((current) => [...current, item]);
    return item;
  };

  const renameFile = (id: string) => {
    const item = vfs.find((candidate) => candidate.id === id);
    if (!item) return;
    const next = window.prompt("Rename", item.name)?.trim();
    if (!next || next === item.name) return;
    setVfs((current) =>
      current.map((candidate) =>
        candidate.id === id
          ? {
              ...candidate,
              name: uniqueName(
                current.filter((entry) => entry.id !== id),
                candidate.parentId,
                next,
              ),
              modified: Date.now(),
            }
          : candidate,
      ),
    );
  };

  const deleteFiles = (ids: string[]) => {
    if (ids.length === 0) return;
    const deleting = new Set<string>();
    for (const id of ids) {
      for (const child of descendants(vfs, id)) deleting.add(child);
    }
    setVfs((current) => current.filter((item) => !deleting.has(item.id)));
    setSelected((current) =>
      new Set([...current].filter((id) => !deleting.has(id.replace(/^file:/u, "")))),
    );
    notify(`${deleting.size} item${deleting.size === 1 ? "" : "s"} moved to the void.`);
  };

  const copyFiles = (ids: string[], parentId: string) => {
    setVfs((current) => {
      let next = current;
      for (const id of ids) next = cloneItemTree(next, id, parentId);
      return next;
    });
  };

  const moveFiles = (ids: string[], parentId: string) => {
    const moved = new Set(ids);
    setVfs((current) =>
      current.map((item) =>
        moved.has(item.id) ? { ...item, parentId, modified: Date.now() } : item,
      ),
    );
  };

  const pasteInto = (parentId: string) => {
    if (!clipboard) return;
    if (clipboard.mode === "copy") copyFiles(clipboard.ids, parentId);
    else {
      moveFiles(clipboard.ids, parentId);
      setClipboard(null);
    }
    notify(`${clipboard.mode === "copy" ? "Copied" : "Moved"} ${clipboard.ids.length} item${clipboard.ids.length === 1 ? "" : "s"}.`);
  };

  const selectedFiles = (): string[] =>
    [...selected]
      .filter((id) => id.startsWith("file:"))
      .map((id) => id.slice("file:".length));

  const openFile = (item: VfsItem) => {
    if (item.kind === "folder") {
      openNative("explorer", { folderId: item.id, title: item.name });
      return;
    }
    if (item.kind === "markdown" || item.kind === "text") {
      openNative("markdown", { targetId: item.id, title: item.name });
      return;
    }
    if (item.kind === "video") {
      openNative("video", { targetId: item.id, title: item.name });
      return;
    }
    if (item.kind === "image") {
      openNative("image", { targetId: item.id, title: item.name });
      return;
    }
    if (item.kind === "atom") {
      const spreadsheet = apps.find((app) => app.id === "spreadsheet");
      if (spreadsheet) launchApp(spreadsheet);
      else notify("Spreadsheet is not installed; this Atom cannot be opened yet.");
    }
  };

  const openNativeShortcut = (kind: WindowKind) => {
    if (kind === "markdown") {
      const file = createMarkdown();
      openFile(file);
      return;
    }
    if (kind === "video") {
      const firstVideo = vfs.find((item) => item.kind === "video");
      openNative("video", firstVideo ? { targetId: firstVideo.id, title: firstVideo.name } : {});
      return;
    }
    openNative(kind);
  };

  const openDesktopItem = (item: DesktopDescriptor) => {
    if (item.kind === "app") launchApp(item.app);
    else if (item.kind === "file") openFile(item.file);
    else openNativeShortcut(item.native);
  };

  const downloadFile = (item: VfsItem) => {
    if (item.kind === "video" && item.source) {
      notify("Remote media is referenced by URL; use the player to view it.");
      return;
    }
    const content = item.content ??
      (item.kind === "atom"
        ? JSON.stringify({ atom: item.name, note: "GUI2 logical Atom placeholder" }, null, 2)
        : item.name);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = item.name;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const updateFileContent = (id: string, content: string) =>
    setVfs((current) =>
      current.map((item) =>
        item.id === id ? { ...item, content, modified: Date.now() } : item,
      ),
    );

  const descriptorById = (id: string): DesktopDescriptor | undefined =>
    desktopItems.find((item) => item.id === id);

  const beginMarquee = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    closeMenus();
    const base = event.ctrlKey || event.metaKey ? new Set(selected) : new Set<string>();
    if (!event.ctrlKey && !event.metaKey) setSelected(new Set());
    event.currentTarget.setPointerCapture(event.pointerId);
    marqueeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      base,
    };
    setMarquee({ left: event.nativeEvent.offsetX, top: event.nativeEvent.offsetY, width: 0, height: 0 });
  };

  const moveMarquee = (event: ReactPointerEvent<HTMLElement>) => {
    const active = marqueeRef.current;
    if (!active || active.pointerId !== event.pointerId || !desktopRef.current) return;
    const bounds = desktopRef.current.getBoundingClientRect();
    const leftClient = Math.min(active.startX, event.clientX);
    const topClient = Math.min(active.startY, event.clientY);
    const rightClient = Math.max(active.startX, event.clientX);
    const bottomClient = Math.max(active.startY, event.clientY);
    setMarquee({
      left: leftClient - bounds.left,
      top: topClient - bounds.top,
      width: rightClient - leftClient,
      height: bottomClient - topClient,
    });
    const next = new Set(active.base);
    desktopRef.current.querySelectorAll<HTMLElement>("[data-desktop-id]").forEach((element) => {
      const rect = element.getBoundingClientRect();
      if (
        rect.left < rightClient &&
        rect.right > leftClient &&
        rect.top < bottomClient &&
        rect.bottom > topClient
      ) {
        const id = element.dataset.desktopId;
        if (id) next.add(id);
      }
    });
    setSelected(next);
  };

  const finishMarquee = (event: ReactPointerEvent<HTMLElement>) => {
    if (marqueeRef.current?.pointerId !== event.pointerId) return;
    marqueeRef.current = null;
    setMarquee(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const selectDesktopItem = (id: string, additive: boolean) => {
    setSelected((current) => {
      if (!additive) return new Set([id]);
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const beginIconDrag = (id: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const additive = event.ctrlKey || event.metaKey;
    const activeSelection = selected.has(id)
      ? new Set(selected)
      : additive
        ? new Set([...selected, id])
        : new Set([id]);
    setSelected(activeSelection);
    const ids = [...activeSelection];
    const base: IconPositions = {};
    for (const activeId of ids) {
      const index = desktopItems.findIndex((item) => item.id === activeId);
      if (index >= 0) base[activeId] = positionFor(activeId, index);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      ids,
      base,
      moved: false,
    };
  };

  const moveIconDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const active = dragRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const dx = event.clientX - active.startX;
    const dy = event.clientY - active.startY;
    if (!active.moved && dx * dx + dy * dy < 16) return;
    active.moved = true;
    setPositions((current) => {
      const next = { ...current };
      for (const id of active.ids) {
        const base = active.base[id];
        if (!base) continue;
        next[id] = {
          x: Math.max(4, base.x + dx),
          y: Math.max(4, base.y + dy),
        };
      }
      return next;
    });
  };

  const finishIconDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const showContextMenu = (id: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!selected.has(id)) setSelected(new Set([id]));
    setContextMenu({ kind: "item", id, x: event.clientX, y: event.clientY });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) return;

      if (event.key === "Escape") {
        closeMenus();
        setSelected(new Set());
        return;
      }
      if (event.ctrlKey && event.code === "Space") {
        event.preventDefault();
        setStartOpen((value) => !value);
        setSearchOpen(false);
        return;
      }
      if (event.metaKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setSearchOpen(true);
        setStartOpen(false);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
        const ids = selectedFiles();
        if (ids.length) setClipboard({ mode: "copy", ids });
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "x") {
        const ids = selectedFiles();
        if (ids.length) setClipboard({ mode: "cut", ids });
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        pasteInto("desktop");
        return;
      }
      if (event.key === "Delete") {
        deleteFiles(selectedFiles());
        return;
      }
      if (event.key === "F2") {
        const id = selectedFiles()[0];
        if (id) renameFile(id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <main className="pl2-os" onClick={() => setContextMenu(null)}>
      <section
        aria-label="Plasmon desktop"
        className="pl2-desktop"
        onContextMenu={(event) => {
          if (event.defaultPrevented) return;
          event.preventDefault();
          setContextMenu({ kind: "desktop", x: event.clientX, y: event.clientY });
        }}
        onPointerCancel={finishMarquee}
        onPointerDown={beginMarquee}
        onPointerMove={moveMarquee}
        onPointerUp={finishMarquee}
        ref={desktopRef}
      >
        <div className="pl2-aurora pl2-aurora--a" />
        <div className="pl2-aurora pl2-aurora--b" />
        <div className="pl2-aurora pl2-aurora--c" />
        <div className="pl2-wallpaper-mark"><ElectronMark /><span>PLASMON</span></div>

        {desktopItems.map((item, index) => {
          const position = positionFor(item.id, index);
          return (
            <DesktopIcon
              descriptor={item}
              key={item.id}
              position={position}
              selected={selected.has(item.id)}
              onContextMenu={(event) => showContextMenu(item.id, event)}
              onDoubleClick={() => openDesktopItem(item)}
              onPointerDown={(event) => beginIconDrag(item.id, event)}
              onPointerMove={moveIconDrag}
              onPointerUp={finishIconDrag}
              onPointerCancel={finishIconDrag}
            />
          );
        })}

        {marquee ? <div className="pl2-marquee" style={marquee} /> : null}

        {windows.map((entry) => (
          <WindowFrame
            key={entry.id}
            state={entry}
            onClose={() => closeWindow(entry.id)}
            onFocus={() => focusWindow(entry.id)}
            onGeometry={(geometry) =>
              mutateWindow(entry.id, (current) => ({ ...current, ...geometry }))
            }
            onMaximize={() =>
              mutateWindow(entry.id, (current) => ({
                ...current,
                maximized: !current.maximized,
                minimized: false,
              }))
            }
            onMinimize={() =>
              mutateWindow(entry.id, (current) => ({ ...current, minimized: true }))
            }
          >
            <WindowContent
              entry={entry}
              apps={apps}
              liveAppIds={liveAppIds}
              mode={mode}
              loading={loading}
              pins={pins}
              vfs={vfs}
              launchingId={launchingId}
              onCreateFolder={createFolder}
              onCreateMarkdown={createMarkdown}
              onCreateText={createText}
              onDeleteFiles={deleteFiles}
              onInstall={() => setInstallOpen(true)}
              onLaunchApp={launchApp}
              onMoveFiles={moveFiles}
              onNotify={notify}
              onOpenFile={openFile}
              onOpenNative={openNativeShortcut}
              onPaste={(parentId) => pasteInto(parentId)}
              onRefresh={refresh}
              onRenameFile={renameFile}
              onSetClipboard={setClipboard}
              onTogglePin={togglePin}
              onUpdateFile={updateFileContent}
            />
          </WindowFrame>
        ))}

        {startOpen ? (
          <StartPanel
            apps={apps}
            files={vfs}
            pins={pins}
            onLaunchApp={launchApp}
            onOpenFile={openFile}
            onOpenNative={openNativeShortcut}
            onSearch={() => {
              setStartOpen(false);
              setSearchOpen(true);
            }}
          />
        ) : null}

        {searchOpen ? (
          <SearchPanel
            apps={apps}
            files={vfs}
            query={searchQuery}
            onLaunchApp={launchApp}
            onOpenFile={openFile}
            onOpenNative={openNativeShortcut}
            onQuery={setSearchQuery}
          />
        ) : null}

        {calendarOpen ? <CalendarFlyout now={clock} /> : null}
        {trayOpen ? <TrayFlyout apps={trayApps} onLaunch={launchApp} /> : null}

        {contextMenu ? (
          <DesktopContextMenu2
            clipboard={clipboard}
            descriptor={contextMenu.kind === "item" ? descriptorById(contextMenu.id) : undefined}
            menu={contextMenu}
            pinned={contextMenu.kind === "item" && pins.includes(contextMenu.id)}
            onClose={() => setContextMenu(null)}
            onCopy={(id) => {
              if (id.startsWith("file:")) setClipboard({ mode: "copy", ids: [id.slice(5)] });
            }}
            onCut={(id) => {
              if (id.startsWith("file:")) setClipboard({ mode: "cut", ids: [id.slice(5)] });
            }}
            onDelete={(id) => {
              if (id.startsWith("file:")) deleteFiles([id.slice(5)]);
            }}
            onDownload={(id) => {
              const descriptor = descriptorById(id);
              if (descriptor?.kind === "file") downloadFile(descriptor.file);
              else if (descriptor?.kind === "app") {
                notify("Download .neutron is not exposed by the current Kernel API; the installed archive is not available to Plasmon yet.");
              }
            }}
            onLaunch={(descriptor) => openDesktopItem(descriptor)}
            onNewFolder={() => createFolder()}
            onNewMarkdown={() => {
              const item = createMarkdown();
              openFile(item);
            }}
            onPaste={() => pasteInto("desktop")}
            onRename={(id) => {
              if (id.startsWith("file:")) renameFile(id.slice(5));
            }}
            onShare={(id) => {
              const descriptor = descriptorById(id);
              notify(
                descriptor?.kind === "file"
                  ? `Share ${descriptor.file.name}: ready as an Atom-style shell action; the sharing backend is still future work.`
                  : "Sharing is available for Atom/file objects, not application packages.",
              );
            }}
            onTogglePin={(id) => togglePin(id)}
          />
        ) : null}

        <div className="pl2-toast-stack" aria-live="polite">
          {error ? (
            <button className="pl2-toast pl2-toast--error" onClick={() => setError(null)} type="button">
              <strong>Action failed</strong><span>{error}</span>
            </button>
          ) : null}
          {notice ? (
            <button className="pl2-toast" onClick={() => setNotice(null)} type="button">
              <strong>Plasmon</strong><span>{notice}</span>
            </button>
          ) : null}
        </div>
      </section>

      <Taskbar2
        apps={apps}
        liveAppIds={liveAppIds}
        pins={pins}
        trayApps={trayApps}
        windows={windows}
        clock={clock}
        launchingId={launchingId}
        startOpen={startOpen}
        searchOpen={searchOpen}
        onLaunchApp={launchApp}
        onOpenNative={openNativeShortcut}
        onTaskWindow={(kind) => {
          const open = windows.find((entry) => entry.kind === kind);
          if (!open) openNativeShortcut(kind);
          else if (open.minimized) focusWindow(open.id);
          else mutateWindow(open.id, (current) => ({ ...current, minimized: true }));
        }}
        onToggleCalendar={() => {
          setCalendarOpen((value) => !value);
          setTrayOpen(false);
          setStartOpen(false);
          setSearchOpen(false);
        }}
        onToggleSearch={() => {
          setSearchOpen((value) => !value);
          setStartOpen(false);
          setCalendarOpen(false);
          setTrayOpen(false);
        }}
        onToggleStart={() => {
          setStartOpen((value) => !value);
          setSearchOpen(false);
          setCalendarOpen(false);
          setTrayOpen(false);
        }}
        onToggleTray={() => {
          setTrayOpen((value) => !value);
          setCalendarOpen(false);
          setStartOpen(false);
          setSearchOpen(false);
        }}
      />

      <InstallDialog
        busy={installBusy}
        onClose={() => {
          if (!installBusy) setInstallOpen(false);
        }}
        onInstall={installApp}
        open={installOpen}
      />
    </main>
  );
}

function DesktopIcon({
  descriptor,
  position,
  selected,
  onContextMenu,
  onDoubleClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  descriptor: DesktopDescriptor;
  position: { x: number; y: number };
  selected: boolean;
  onContextMenu: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onDoubleClick: () => void;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      className={`pl2-desktop-icon${selected ? " is-selected" : ""}`}
      data-desktop-id={descriptor.id}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
      title={descriptor.subtitle}
      type="button"
    >
      {descriptor.kind === "app" ? (
        <AppGlyph2 app={descriptor.app} size="desktop" />
      ) : descriptor.kind === "file" ? (
        <NativeGlyph glyph={fileGlyph(descriptor.file)} variant={descriptor.file.kind === "atom" ? "atom" : "file"} />
      ) : (
        <NativeGlyph glyph={nativeGlyph(descriptor.native)} variant="native" />
      )}
      <span>{descriptor.name}</span>
    </button>
  );
}

function NativeGlyph({ glyph, variant }: { glyph: string; variant: "native" | "file" | "atom" }) {
  return <span className={`pl2-native-glyph pl2-native-glyph--${variant}`}>{glyph}</span>;
}

function AppGlyph2({ app, size = "normal" }: { app: PlasmonApp; size?: "normal" | "desktop" | "small" }) {
  const [failed, setFailed] = useState(false);
  const src = useMemo(() => appIconUrl(app), [app.id]);
  return (
    <span className={`pl2-app-icon pl2-app-icon--${size} pl-taskbar-appicon`}>
      {src && !failed ? (
        <img alt="" draggable={false} onError={() => setFailed(true)} src={src} />
      ) : (
        <b>{initials(app)}</b>
      )}
      <i aria-hidden="true" className="pl2-neutron-badge"><span /><span /><span /></i>
    </span>
  );
}

function ElectronMark() {
  return (
    <span className="pl2-electron-mark" aria-hidden="true">
      <i className="orbit orbit-a" /><i className="orbit orbit-b" /><i className="orbit orbit-c" /><b />
    </span>
  );
}

function WindowFrame({
  state,
  children,
  onClose,
  onFocus,
  onGeometry,
  onMaximize,
  onMinimize,
}: {
  state: GuiWindow;
  children: ReactNode;
  onClose: () => void;
  onFocus: () => void;
  onGeometry: (geometry: Partial<Pick<GuiWindow, "x" | "y" | "width" | "height">>) => void;
  onMaximize: () => void;
  onMinimize: () => void;
}) {
  const moveRef = useRef<null | { pointerId: number; sx: number; sy: number; x: number; y: number }>(null);
  const resizeRef = useRef<null | { pointerId: number; sx: number; sy: number; width: number; height: number }>(null);
  if (state.minimized) return null;

  const beginMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (state.maximized || event.button !== 0) return;
    onFocus();
    event.currentTarget.setPointerCapture(event.pointerId);
    moveRef.current = { pointerId: event.pointerId, sx: event.clientX, sy: event.clientY, x: state.x, y: state.y };
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = moveRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    onGeometry({
      x: Math.max(4, active.x + event.clientX - active.sx),
      y: Math.max(4, active.y + event.clientY - active.sy),
    });
  };
  const endMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (moveRef.current?.pointerId === event.pointerId) moveRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const beginResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (state.maximized || event.button !== 0) return;
    event.stopPropagation();
    onFocus();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = { pointerId: event.pointerId, sx: event.clientX, sy: event.clientY, width: state.width, height: state.height };
  };
  const resize = (event: ReactPointerEvent<HTMLDivElement>) => {
    const active = resizeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    onGeometry({
      width: Math.max(360, active.width + event.clientX - active.sx),
      height: Math.max(260, active.height + event.clientY - active.sy),
    });
  };
  const endResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (resizeRef.current?.pointerId === event.pointerId) resizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  return (
    <article
      className={`pl2-window${state.maximized ? " is-maximized" : ""}`}
      onPointerDown={onFocus}
      style={
        state.maximized
          ? { zIndex: state.z }
          : { left: state.x, top: state.y, width: state.width, height: state.height, zIndex: state.z }
      }
    >
      <div
        className="pl2-titlebar"
        onDoubleClick={onMaximize}
        onPointerCancel={endMove}
        onPointerDown={beginMove}
        onPointerMove={move}
        onPointerUp={endMove}
      >
        <NativeGlyph glyph={state.glyph} variant="native" />
        <strong>{state.title}</strong>
        <div className="pl2-window-actions" onPointerDown={(event) => event.stopPropagation()}>
          <button aria-label="Minimize" onClick={onMinimize} type="button">—</button>
          <button aria-label={state.maximized ? "Restore" : "Maximize"} onClick={onMaximize} type="button">{state.maximized ? "❐" : "□"}</button>
          <button aria-label="Close" className="close" onClick={onClose} type="button">×</button>
        </div>
      </div>
      <div className="pl2-window-body">{children}</div>
      {!state.maximized ? (
        <div
          className="pl2-resizer"
          onPointerCancel={endResize}
          onPointerDown={beginResize}
          onPointerMove={resize}
          onPointerUp={endResize}
        />
      ) : null}
    </article>
  );
}

function WindowContent({
  entry,
  apps,
  liveAppIds,
  mode,
  loading,
  pins,
  vfs,
  launchingId,
  onCreateFolder,
  onCreateMarkdown,
  onCreateText,
  onDeleteFiles,
  onInstall,
  onLaunchApp,
  onMoveFiles,
  onNotify,
  onOpenFile,
  onOpenNative,
  onPaste,
  onRefresh,
  onRenameFile,
  onSetClipboard,
  onTogglePin,
  onUpdateFile,
}: {
  entry: GuiWindow;
  apps: PlasmonApp[];
  liveAppIds: ReadonlySet<string>;
  mode: PlatformMode;
  loading: boolean;
  pins: string[];
  vfs: VfsItem[];
  launchingId: string | null;
  onCreateFolder: (parentId?: string, requested?: string) => VfsItem;
  onCreateMarkdown: (parentId?: string, requested?: string) => VfsItem;
  onCreateText: (parentId: string, requested: string) => VfsItem;
  onDeleteFiles: (ids: string[]) => void;
  onInstall: () => void;
  onLaunchApp: (app: PlasmonApp) => void;
  onMoveFiles: (ids: string[], parentId: string) => void;
  onNotify: (message: string) => void;
  onOpenFile: (item: VfsItem) => void;
  onOpenNative: (kind: WindowKind) => void;
  onPaste: (parentId: string) => void;
  onRefresh: () => void;
  onRenameFile: (id: string) => void;
  onSetClipboard: (state: ClipboardState) => void;
  onTogglePin: (key: string) => void;
  onUpdateFile: (id: string, content: string) => void;
}) {
  if (entry.kind === "control") {
    return (
      <ControlCenter2
        apps={apps}
        liveAppIds={liveAppIds}
        loading={loading}
        mode={mode}
        pins={pins}
        launchingId={launchingId}
        onInstall={onInstall}
        onLaunch={onLaunchApp}
        onRefresh={onRefresh}
        onTogglePin={onTogglePin}
      />
    );
  }
  if (entry.kind === "explorer") {
    return (
      <Explorer2
        initialFolder={entry.targetId ?? "desktop"}
        items={vfs}
        onCreateFolder={onCreateFolder}
        onCreateMarkdown={onCreateMarkdown}
        onDelete={onDeleteFiles}
        onMove={onMoveFiles}
        onOpen={onOpenFile}
        onPaste={onPaste}
        onRename={onRenameFile}
        onSetClipboard={onSetClipboard}
      />
    );
  }
  if (entry.kind === "markdown") {
    const item = vfs.find((candidate) => candidate.id === entry.targetId);
    return item ? <MarkdownEditor item={item} onUpdate={onUpdateFile} /> : <MissingFile />;
  }
  if (entry.kind === "video") {
    return <MediaPlayer items={vfs.filter((item) => item.kind === "video")} initialId={entry.targetId} onNotify={onNotify} />;
  }
  if (entry.kind === "image") {
    return <ImageViewer item={vfs.find((candidate) => candidate.id === entry.targetId)} />;
  }
  if (entry.kind === "terminal") {
    return (
      <Terminal2
        apps={apps}
        items={vfs}
        mode={mode}
        onCreateFolder={onCreateFolder}
        onCreateText={onCreateText}
        onLaunchApp={onLaunchApp}
        onOpenFile={onOpenFile}
      />
    );
  }
  if (entry.kind === "calculator") return <Calculator2 />;
  if (entry.kind === "doom") return <DoomWindow />;
  return <About2 apps={apps} mode={mode} onOpenNative={onOpenNative} />;
}

function ControlCenter2({
  apps,
  liveAppIds,
  loading,
  mode,
  pins,
  launchingId,
  onInstall,
  onLaunch,
  onRefresh,
  onTogglePin,
}: {
  apps: PlasmonApp[];
  liveAppIds: ReadonlySet<string>;
  loading: boolean;
  mode: PlatformMode;
  pins: string[];
  launchingId: string | null;
  onInstall: () => void;
  onLaunch: (app: PlasmonApp) => void;
  onRefresh: () => void;
  onTogglePin: (key: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = apps.filter((app) =>
    `${app.name}\n${app.description}\n${app.id}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div className="pl2-control">
      <aside>
        <div className="pl2-control-brand"><ElectronMark /><div><strong>Plasmon</strong><small>Control</small></div></div>
        <button className="active" type="button">Applications</button>
        <button type="button">Atoms</button>
        <button type="button">Shared</button>
        <button type="button">Desktop</button>
        <div className="runtime"><i /><strong>{modeLabel(mode)}</strong><small>{apps.length} Elements</small></div>
      </aside>
      <section>
        <header><div><small>YOUR NEUTRON</small><h2>Applications</h2></div><div><button onClick={onRefresh} type="button">Refresh</button><button className="primary" onClick={onInstall} type="button">Install app</button></div></header>
        <label className="pl2-input-search">⌕<input placeholder="Search installed apps" type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="pl2-app-list">
          {loading ? <div className="pl2-empty">Discovering installed apps…</div> : null}
          {!loading && filtered.length === 0 ? <div className="pl2-empty">No matching apps.</div> : null}
          {filtered.map((app) => {
            const key = `app:${app.id}`;
            const live = liveAppIds.has(app.id);
            return (
              <article key={app.id}>
                <AppGlyph2 app={app} />
                <div className="copy"><div><strong>{app.name}</strong>{live ? <span className="live">RUNNING</span> : null}{app.tray ? <span className="tray">TRAY</span> : null}</div><p>{app.description}</p><small>{app.id} · {appVersion(app.version) || "unknown version"} · {app.tiles.length} tile{app.tiles.length === 1 ? "" : "s"}</small></div>
                <button className={pins.includes(key) ? "pinned" : ""} onClick={() => onTogglePin(key)} type="button">{pins.includes(key) ? "Unpin" : "Pin"}</button>
                <button disabled={!app.tiles.length || launchingId === app.id} onClick={() => onLaunch(app)} type="button">{launchingId === app.id ? "Opening…" : live ? "Focus" : "Open"}</button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function Explorer2({
  initialFolder,
  items,
  onCreateFolder,
  onCreateMarkdown,
  onDelete,
  onMove,
  onOpen,
  onPaste,
  onRename,
  onSetClipboard,
}: {
  initialFolder: string;
  items: VfsItem[];
  onCreateFolder: (parentId?: string, requested?: string) => VfsItem;
  onCreateMarkdown: (parentId?: string, requested?: string) => VfsItem;
  onDelete: (ids: string[]) => void;
  onMove: (ids: string[], parentId: string) => void;
  onOpen: (item: VfsItem) => void;
  onPaste: (parentId: string) => void;
  onRename: (id: string) => void;
  onSetClipboard: (state: ClipboardState) => void;
}) {
  const [folder, setFolder] = useState(initialFolder);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [view, setView] = useState<"grid" | "list">("grid");
  const children = items
    .filter((item) => item.parentId === folder)
    .sort((a, b) => (a.kind === "folder" ? -1 : 1) - (b.kind === "folder" ? -1 : 1) || a.name.localeCompare(b.name));
  const current = items.find((item) => item.id === folder);
  const path = folder === "desktop" ? "Desktop" : current?.name ?? "Folder";
  const selectedIds = [...selected];

  const select = (id: string, additive: boolean) => {
    setSelected((currentSelection) => {
      if (!additive) return new Set([id]);
      const next = new Set(currentSelection);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="pl2-explorer">
      <aside>
        <h3>Home</h3>
        <button className={folder === "desktop" ? "active" : ""} onClick={() => { setFolder("desktop"); setSelected(new Set()); }} type="button">⌂ Desktop</button>
        {items.filter((item) => item.parentId === "desktop" && item.kind === "folder").map((item) => (
          <button className={folder === item.id ? "active" : ""} key={item.id} onClick={() => { setFolder(item.id); setSelected(new Set()); }} type="button">▰ {item.name}</button>
        ))}
        <hr />
        <button type="button">◈ Atoms</button>
        <button type="button">↗ Shared</button>
      </aside>
      <section>
        <header className="pl2-explorer-nav">
          <button onClick={() => setFolder("desktop")} type="button">←</button>
          <button type="button">→</button>
          <div className="address">⌂ / {path}</div>
          <label>⌕<input placeholder={`Search ${path}`} /></label>
        </header>
        <div className="pl2-commandbar">
          <button onClick={() => onCreateFolder(folder)} type="button">＋ Folder</button>
          <button onClick={() => { const item = onCreateMarkdown(folder); onOpen(item); }} type="button">＋ Markdown</button>
          <i />
          <button disabled={!selectedIds.length} onClick={() => onSetClipboard({ mode: "cut", ids: selectedIds })} type="button">✂ Cut</button>
          <button disabled={!selectedIds.length} onClick={() => onSetClipboard({ mode: "copy", ids: selectedIds })} type="button">▣ Copy</button>
          <button onClick={() => onPaste(folder)} type="button">▤ Paste</button>
          <button disabled={selectedIds.length !== 1} onClick={() => selectedIds[0] && onRename(selectedIds[0])} type="button">✎ Rename</button>
          <button disabled={!selectedIds.length} onClick={() => { onDelete(selectedIds); setSelected(new Set()); }} type="button">⌫ Delete</button>
          <i />
          <button onClick={() => setView((currentView) => currentView === "grid" ? "list" : "grid")} type="button">{view === "grid" ? "☷ List" : "▦ Grid"}</button>
        </div>
        <div className="pl2-explorer-title"><div><h2>{path}</h2><p>{children.length} items</p></div></div>
        <div className={`pl2-file-view pl2-file-view--${view}`} onClick={(event) => { if (event.target === event.currentTarget) setSelected(new Set()); }}>
          {children.map((item) => (
            <button
              className={selected.has(item.id) ? "selected" : ""}
              key={item.id}
              onClick={(event) => select(item.id, event.ctrlKey || event.metaKey)}
              onDoubleClick={() => item.kind === "folder" ? setFolder(item.id) : onOpen(item)}
              type="button"
            >
              <NativeGlyph glyph={fileGlyph(item)} variant={item.kind === "atom" ? "atom" : "file"} />
              <span><strong>{item.name}</strong><small>{item.detail ?? item.kind}</small></span>
              {view === "list" ? <time>{new Date(item.modified).toLocaleDateString()}</time> : null}
            </button>
          ))}
          {children.length === 0 ? <div className="pl2-empty">This folder is empty.</div> : null}
        </div>
        <footer>{selected.size ? `${selected.size} selected` : `${children.length} items`}<span>Plasmon local desktop model</span></footer>
      </section>
    </div>
  );
}

function MarkdownEditor({ item, onUpdate }: { item: VfsItem; onUpdate: (id: string, content: string) => void }) {
  const [preview, setPreview] = useState(true);
  const text = item.content ?? "";
  return (
    <div className="pl2-markdown">
      <div className="pl2-editor-toolbar"><button type="button">File</button><button type="button">Edit</button><button type="button">Insert</button><i /><strong>{item.name}</strong><span>Auto-saved</span><button className={preview ? "active" : ""} onClick={() => setPreview((value) => !value)} type="button">◫ Preview</button></div>
      <div className={preview ? "pl2-editor-split" : "pl2-editor-split single"}>
        <textarea aria-label={`Edit ${item.name}`} onChange={(event) => onUpdate(item.id, event.target.value)} spellCheck value={text} />
        {preview ? <div className="pl2-markdown-preview"><MarkdownPreview text={text} /></div> : null}
      </div>
      <footer><span>Markdown</span><span>{text.length} characters · {text.split(/\s+/u).filter(Boolean).length} words</span></footer>
    </div>
  );
}

function MarkdownPreview({ text }: { text: string }) {
  return (
    <article>
      {text.split("\n").map((line, index) => {
        if (line.startsWith("### ")) return <h3 key={index}>{inlineMarkdown(line.slice(4))}</h3>;
        if (line.startsWith("## ")) return <h2 key={index}>{inlineMarkdown(line.slice(3))}</h2>;
        if (line.startsWith("# ")) return <h1 key={index}>{inlineMarkdown(line.slice(2))}</h1>;
        if (line.startsWith("- ")) return <div className="bullet" key={index}>• <span>{inlineMarkdown(line.slice(2))}</span></div>;
        if (line.startsWith("> ")) return <blockquote key={index}>{inlineMarkdown(line.slice(2))}</blockquote>;
        if (!line.trim()) return <div className="space" key={index} />;
        return <p key={index}>{inlineMarkdown(line)}</p>;
      })}
    </article>
  );
}

function inlineMarkdown(line: string): ReactNode[] {
  const tokens = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/u);
  return tokens.map((token, index) => {
    if (token.startsWith("**") && token.endsWith("**")) return <strong key={index}>{token.slice(2, -2)}</strong>;
    if (token.startsWith("`") && token.endsWith("`")) return <code key={index}>{token.slice(1, -1)}</code>;
    return <span key={index}>{token}</span>;
  });
}

function MediaPlayer({ items, initialId, onNotify }: { items: VfsItem[]; initialId?: string; onNotify: (message: string) => void }) {
  const [activeId, setActiveId] = useState(initialId ?? items[0]?.id ?? "");
  const [localSource, setLocalSource] = useState<string | null>(null);
  const active = items.find((item) => item.id === activeId) ?? items[0];
  useEffect(() => () => { if (localSource) URL.revokeObjectURL(localSource); }, [localSource]);
  return (
    <div className="pl2-media">
      <div className="pl2-media-stage">
        {active?.source || localSource ? (
          <video controls autoPlay={false} src={localSource ?? active?.source} />
        ) : <div className="pl2-empty">Choose a video.</div>}
      </div>
      <aside>
        <header><div><strong>Videos</strong><small>{items.length} library items</small></div><label className="pl2-upload">＋ Open<input accept="video/*" type="file" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; if (localSource) URL.revokeObjectURL(localSource); setLocalSource(URL.createObjectURL(file)); onNotify(`Opened ${file.name} for this session.`); }} /></label></header>
        <div className="pl2-video-list">
          {items.map((item) => (
            <button className={item.id === active?.id && !localSource ? "active" : ""} key={item.id} onClick={() => { setLocalSource(null); setActiveId(item.id); }} type="button">
              <span className="thumb">{item.source ? <video muted preload="metadata" src={item.source} /> : <b>▶</b>}</span>
              <span><strong>{item.name}</strong><small>{item.detail}</small></span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}

function ImageViewer({ item }: { item?: VfsItem }) {
  return (
    <div className="pl2-image-viewer">
      <div className="pl2-generated-art"><span /><span /><span /><ElectronMark /></div>
      <footer><strong>{item?.name ?? "Image"}</strong><span>{item?.detail ?? "Generated artwork"}</span></footer>
    </div>
  );
}

function Terminal2({
  apps,
  items,
  mode,
  onCreateFolder,
  onCreateText,
  onLaunchApp,
  onOpenFile,
}: {
  apps: PlasmonApp[];
  items: VfsItem[];
  mode: PlatformMode;
  onCreateFolder: (parentId?: string, requested?: string) => VfsItem;
  onCreateText: (parentId: string, requested: string) => VfsItem;
  onLaunchApp: (app: PlasmonApp) => void;
  onOpenFile: (item: VfsItem) => void;
}) {
  const [command, setCommand] = useState("");
  const [lines, setLines] = useState<string[]>([
    "Plasmon Terminal 0.1 GUI2",
    "Web desktop shell for Neutron. Type 'help'.",
    "",
  ]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const execute = () => {
    const input = command.trim();
    if (!input) return;
    const [verb = "", ...args] = input.split(/\s+/u);
    const rest = args.join(" ");
    if (verb === "clear") {
      setLines([]);
      setHistory((current) => [...current, input]);
      setCommand("");
      return;
    }
    const output = (() => {
      if (verb === "help") return ["Commands:", "  apps                 list installed Neutron apps", "  ls | dir             list desktop files", "  atoms                list Atom-like files", "  open <name>           open an app or file", "  cat <file>            print text/markdown", "  mkdir <name>          create desktop folder", "  touch <name>          create desktop text file", "  neutron              runtime summary", "  pwd                   current virtual path", "  whoami                desktop identity", "  date                  local date/time", "  echo <text>           print text", "  history               command history", "  clear                 clear terminal"].join("\n");
      if (verb === "apps") return apps.map((app) => `${app.id.padEnd(14)} ${app.name}`).join("\n") || "No apps discovered.";
      if (verb === "ls" || verb === "dir") return items.filter((item) => item.parentId === "desktop").map((item) => `${item.kind === "folder" ? "<DIR>" : "     "}  ${item.name}`).join("\n") || "Desktop is empty.";
      if (verb === "atoms") return items.filter((item) => item.kind === "atom").map((item) => item.name).join("\n") || "No Atoms.";
      if (verb === "neutron") return `${modeLabel(mode)} · ${apps.length} installed Elements`;
      if (verb === "pwd") return "/Desktop";
      if (verb === "whoami") return "plasmon-user";
      if (verb === "date") return new Date().toString();
      if (verb === "echo") return rest;
      if (verb === "history") return history.map((entry, index) => `${index + 1}  ${entry}`).join("\n");
      if (verb === "mkdir") {
        if (!rest) return "mkdir: missing folder name";
        const created = onCreateFolder("desktop", rest);
        return `created ${created.name}`;
      }
      if (verb === "touch") {
        if (!rest) return "touch: missing file name";
        const created = onCreateText("desktop", rest);
        return `created ${created.name}`;
      }
      if (verb === "cat") {
        const target = items.find((item) => item.name.toLowerCase() === rest.toLowerCase());
        return target?.content ?? (target ? `${target.name}: no text content` : `cat: ${rest}: not found`);
      }
      if (verb === "open") {
        const app = apps.find((candidate) => candidate.name.toLowerCase() === rest.toLowerCase() || candidate.id.toLowerCase() === rest.toLowerCase());
        if (app) { onLaunchApp(app); return `opening ${app.name}`; }
        const file = items.find((candidate) => candidate.name.toLowerCase() === rest.toLowerCase());
        if (file) { onOpenFile(file); return `opening ${file.name}`; }
        return `open: ${rest}: not found`;
      }
      return `${verb}: command not found`;
    })();
    setLines((current) => [...current, `user@plasmon:/Desktop$ ${input}`, output, ""]);
    setHistory((current) => [...current, input]);
    setHistoryIndex(-1);
    setCommand("");
  };

  return (
    <div className="pl2-terminal">
      <div className="pl2-terminal-tabs"><span className="active">⌘ Terminal</span><button type="button">＋</button></div>
      <div className="pl2-terminal-output">{lines.flatMap((line, lineIndex) => line.split("\n").map((part, partIndex) => <div key={`${lineIndex}-${partIndex}`}>{part || " "}</div>))}</div>
      <label><span>user@plasmon:/Desktop$</span><input autoComplete="off" autoFocus spellCheck={false} value={command} onChange={(event) => setCommand(event.target.value)} onKeyDown={(event) => {
        if (event.key === "Enter") execute();
        else if (event.key === "ArrowUp") { event.preventDefault(); const next = Math.min(history.length - 1, historyIndex + 1); if (next >= 0) { setHistoryIndex(next); setCommand(history[history.length - 1 - next] ?? ""); } }
        else if (event.key === "ArrowDown") { event.preventDefault(); const next = Math.max(-1, historyIndex - 1); setHistoryIndex(next); setCommand(next < 0 ? "" : history[history.length - 1 - next] ?? ""); }
      }} /></label>
    </div>
  );
}

function Calculator2() {
  const [display, setDisplay] = useState("0");
  const keys = ["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", ".", "=", "+"];
  const press = (key: string) => {
    if (key === "=") {
      const expression = display.replaceAll("÷", "/").replaceAll("×", "*").replaceAll("−", "-");
      if (!/^[0-9+\-*/().\s]+$/u.test(expression)) return;
      try {
        const value = Function(`"use strict"; return (${expression})`)() as unknown;
        setDisplay(typeof value === "number" && Number.isFinite(value) ? String(value) : "Error");
      } catch { setDisplay("Error"); }
      return;
    }
    setDisplay((current) => current === "0" || current === "Error" ? key : `${current}${key}`);
  };
  return <div className="pl2-calculator"><header><small>Standard</small><output>{display}</output></header><div className="utility"><button onClick={() => setDisplay("0")} type="button">C</button><button onClick={() => setDisplay((value) => value.length > 1 ? value.slice(0, -1) : "0")} type="button">⌫</button></div><div className="keys">{keys.map((key) => <button className={key === "=" ? "equals" : ""} key={key} onClick={() => press(key)} type="button">{key}</button>)}</div></div>;
}

function DoomWindow() {
  return (
    <div className="pl2-doom">
      <iframe
        allow="fullscreen; gamepad"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-pointer-lock"
        src="https://danihre.github.io/jsdoom/"
        title="Doom web emulator"
      />
      <footer><span>Experimental remote web app</span><span>If Neutron/CSP blocks the frame, Doom will require bundling a WASM/js-dos runtime instead.</span></footer>
    </div>
  );
}

function About2({ apps, mode, onOpenNative }: { apps: PlasmonApp[]; mode: PlatformMode; onOpenNative: (kind: WindowKind) => void }) {
  return <div className="pl2-about"><ElectronMark /><div><small>PLASMON GUI2</small><h2>A familiar desktop for a decentralized runtime.</h2><p>GUI2 deliberately borrows the interaction model of mature browser desktops: draggable icons, marquee selection, files/folders, desktop search, a taskbar, calendar, media, editors, and windowed apps.</p><dl><div><dt>Runtime</dt><dd>{modeLabel(mode)}</dd></div><div><dt>Elements</dt><dd>{apps.length}</dd></div><div><dt>Atoms</dt><dd>File-like logical objects</dd></div></dl><div className="actions"><button onClick={() => onOpenNative("explorer")} type="button">Open Files</button><button onClick={() => onOpenNative("control")} type="button">Open Control</button></div></div></div>;
}

function MissingFile() {
  return <div className="pl2-empty pl2-empty--fill"><strong>File unavailable</strong><span>It may have been moved or deleted.</span></div>;
}

function StartPanel({
  apps,
  files,
  pins,
  onLaunchApp,
  onOpenFile,
  onOpenNative,
  onSearch,
}: {
  apps: PlasmonApp[];
  files: VfsItem[];
  pins: string[];
  onLaunchApp: (app: PlasmonApp) => void;
  onOpenFile: (item: VfsItem) => void;
  onOpenNative: (kind: WindowKind) => void;
  onSearch: () => void;
}) {
  const pinnedItems = pins.slice(0, 18);
  const recent = [...files].filter((item) => item.kind !== "folder").sort((a, b) => b.modified - a.modified).slice(0, 6);
  return (
    <section className="pl2-start-panel" onClick={(event) => event.stopPropagation()}>
      <button className="pl2-start-search" onClick={onSearch} type="button">⌕ <span>Search apps, files, settings, and Atoms</span><kbd>⌘F</kbd></button>
      <div className="pl2-start-heading"><strong>Pinned</strong><span>{pinnedItems.length} items</span></div>
      <div className="pl2-start-pins">
        {pinnedItems.map((key) => {
          if (key.startsWith("app:")) {
            const app = apps.find((candidate) => `app:${candidate.id}` === key);
            return app ? <button key={key} onClick={() => onLaunchApp(app)} type="button"><AppGlyph2 app={app} /><span>{app.name}</span></button> : null;
          }
          const kind = key.replace(/^builtin:/u, "") as WindowKind;
          return NATIVE_META[kind] ? <button key={key} onClick={() => onOpenNative(kind)} type="button"><NativeGlyph glyph={nativeGlyph(kind)} variant="native" /><span>{NATIVE_META[kind].title}</span></button> : null;
        })}
      </div>
      <div className="pl2-start-heading"><strong>Recommended</strong><span>Recent files</span></div>
      <div className="pl2-recommended">
        {recent.map((item) => <button key={item.id} onClick={() => onOpenFile(item)} type="button"><NativeGlyph glyph={fileGlyph(item)} variant={item.kind === "atom" ? "atom" : "file"} /><span><strong>{item.name}</strong><small>{item.detail ?? item.kind}</small></span><time>{relativeTime(item.modified)}</time></button>)}
      </div>
      <footer><div className="profile"><span>◎</span><div><strong>Local owner</strong><small>Plasmon desktop</small></div></div><div><button title="Settings" type="button">⚙</button><button title="Power" type="button">⏻</button></div></footer>
    </section>
  );
}

function SearchPanel({ apps, files, query, onLaunchApp, onOpenFile, onOpenNative, onQuery }: { apps: PlasmonApp[]; files: VfsItem[]; query: string; onLaunchApp: (app: PlasmonApp) => void; onOpenFile: (item: VfsItem) => void; onOpenNative: (kind: WindowKind) => void; onQuery: (value: string) => void }) {
  const [tab, setTab] = useState<"all" | "apps" | "files">("all");
  const needle = query.trim().toLowerCase();
  const appResults = apps.filter((app) => !needle || `${app.name} ${app.id} ${app.description}`.toLowerCase().includes(needle));
  const fileResults = files.filter((item) => !needle || `${item.name} ${item.detail ?? ""}`.toLowerCase().includes(needle));
  const bestApp = appResults[0];
  const bestFile = fileResults[0];
  return (
    <section className="pl2-search-panel" onClick={(event) => event.stopPropagation()}>
      <label className="pl2-search-main">⌕<input autoFocus placeholder="Type here to search" value={query} onChange={(event) => onQuery(event.target.value)} /></label>
      <nav><button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")} type="button">All</button><button className={tab === "apps" ? "active" : ""} onClick={() => setTab("apps")} type="button">Apps</button><button className={tab === "files" ? "active" : ""} onClick={() => setTab("files")} type="button">Files & Atoms</button></nav>
      <div className="pl2-search-content">
        <div className="results">
          {(tab === "all" || tab === "apps") && <section><h3>{needle ? "Apps" : "Suggested apps"}</h3>{appResults.slice(0, 8).map((app) => <button key={app.id} onClick={() => onLaunchApp(app)} type="button"><AppGlyph2 app={app} size="small" /><span><strong>{app.name}</strong><small>Neutron Element · {app.id}</small></span></button>)}</section>}
          {(tab === "all" || tab === "files") && <section><h3>{needle ? "Files" : "Recent files"}</h3>{fileResults.slice(0, 8).map((item) => <button key={item.id} onClick={() => onOpenFile(item)} type="button"><NativeGlyph glyph={fileGlyph(item)} variant={item.kind === "atom" ? "atom" : "file"} /><span><strong>{item.name}</strong><small>{item.detail ?? item.kind}</small></span></button>)}</section>}
        </div>
        <aside>
          {bestApp ? <><AppGlyph2 app={bestApp} /><h2>{bestApp.name}</h2><p>{bestApp.description}</p><button onClick={() => onLaunchApp(bestApp)} type="button">Open</button></> : bestFile ? <><NativeGlyph glyph={fileGlyph(bestFile)} variant={bestFile.kind === "atom" ? "atom" : "file"} /><h2>{bestFile.name}</h2><p>{bestFile.detail}</p><button onClick={() => onOpenFile(bestFile)} type="button">Open</button></> : <><ElectronMark /><h2>Search Plasmon</h2><p>Find installed Neutron apps, files, folders, and Atom-like objects.</p><button onClick={() => onOpenNative("explorer")} type="button">Browse Files</button></>}
        </aside>
      </div>
    </section>
  );
}

function CalendarFlyout({ now }: { now: Date }) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const days = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)];
  while (cells.length % 7) cells.push(null);
  return (
    <section className="pl2-calendar" onClick={(event) => event.stopPropagation()}>
      <header><div><strong>{now.toLocaleDateString([], { weekday: "long" })}</strong><span>{now.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}</span></div><b>{now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</b></header>
      <div className="pl2-calendar-month"><div className="month-title"><strong>{now.toLocaleDateString([], { month: "long", year: "numeric" })}</strong><span>⌃⌄</span></div><div className="weekdays">{"SMTWTFS".split("").map((day, index) => <span key={index}>{day}</span>)}</div><div className="days">{cells.map((day, index) => <span className={day === now.getDate() ? "today" : ""} key={index}>{day ?? ""}</span>)}</div></div>
      <footer><span>Today</span><strong>No scheduled events</strong></footer>
    </section>
  );
}

function TrayFlyout({ apps, onLaunch }: { apps: PlasmonApp[]; onLaunch: (app: PlasmonApp) => void }) {
  return (
    <section className="pl2-tray-flyout" onClick={(event) => event.stopPropagation()}>
      <header><strong>Neutron tray</strong><small>{apps.length} tray-capable app{apps.length === 1 ? "" : "s"}</small></header>
      {apps.map((app) => <button key={app.id} onClick={() => onLaunch(app)} type="button"><AppGlyph2 app={app} size="small" /><span><strong>{app.tray?.title ?? app.name}</strong><small>{app.name} · Kernel tray surface</small></span><b>›</b></button>)}
      {apps.length === 0 ? <div className="pl2-empty">No installed apps declare a Kernel tray.</div> : null}
      <footer>Icons/declarations are mirrored here. The interactive tray iframe is still Kernel-owned and cannot safely be nested in Plasmon yet.</footer>
    </section>
  );
}

function DesktopContextMenu2({
  clipboard,
  descriptor,
  menu,
  pinned,
  onClose,
  onCopy,
  onCut,
  onDelete,
  onDownload,
  onLaunch,
  onNewFolder,
  onNewMarkdown,
  onPaste,
  onRename,
  onShare,
  onTogglePin,
}: {
  clipboard: ClipboardState;
  descriptor?: DesktopDescriptor;
  menu: ContextMenuState;
  pinned: boolean;
  onClose: () => void;
  onCopy: (id: string) => void;
  onCut: (id: string) => void;
  onDelete: (id: string) => void;
  onDownload: (id: string) => void;
  onLaunch: (descriptor: DesktopDescriptor) => void;
  onNewFolder: () => void;
  onNewMarkdown: () => void;
  onPaste: () => void;
  onRename: (id: string) => void;
  onShare: (id: string) => void;
  onTogglePin: (id: string) => void;
}) {
  const action = (callback: () => void) => () => { callback(); onClose(); };
  return (
    <div className="pl2-context" onClick={(event) => event.stopPropagation()} style={{ left: menu.x, top: menu.y }}>
      {menu.kind === "desktop" ? <>
        <button onClick={action(() => window.location.reload())} type="button">↻ <span>Refresh</span></button>
        <button type="button">▦ <span>View</span><kbd>›</kbd></button>
        <button type="button">⇅ <span>Sort by</span><kbd>›</kbd></button>
        <hr />
        <button onClick={action(onNewFolder)} type="button">▰ <span>New folder</span></button>
        <button onClick={action(onNewMarkdown)} type="button">M↓ <span>New Markdown file</span></button>
        <button disabled={!clipboard} onClick={action(onPaste)} type="button">▤ <span>Paste</span><kbd>Ctrl+V</kbd></button>
        <hr />
        <button type="button">◐ <span>Personalize desktop</span></button>
      </> : descriptor ? descriptor.kind === "app" ? <>
        <strong>{descriptor.app.name}</strong>
        <button onClick={action(() => onLaunch(descriptor))} type="button">▶ <span>Open / Focus</span></button>
        <button onClick={action(() => onTogglePin(descriptor.id))} type="button">⌖ <span>{pinned ? "Unpin from taskbar" : "Pin to taskbar"}</span></button>
        <hr />
        <button onClick={action(() => onDownload(descriptor.id))} type="button">⇩ <span>Download .neutron</span></button>
        <button type="button">ⓘ <span>Properties</span></button>
        <hr />
        <small>Neutron Element · {descriptor.app.id}</small>
      </> : descriptor.kind === "file" ? <>
        <strong>{descriptor.file.name}</strong>
        <button onClick={action(() => onLaunch(descriptor))} type="button">▶ <span>Open</span></button>
        {descriptor.file.kind === "atom" ? <button onClick={action(() => onShare(descriptor.id))} type="button">↗ <span>Share Atom…</span></button> : null}
        <hr />
        <button onClick={action(() => onCut(descriptor.id))} type="button">✂ <span>Cut</span><kbd>Ctrl+X</kbd></button>
        <button onClick={action(() => onCopy(descriptor.id))} type="button">▣ <span>Copy</span><kbd>Ctrl+C</kbd></button>
        <button onClick={action(() => onRename(descriptor.id))} type="button">✎ <span>Rename</span><kbd>F2</kbd></button>
        <button onClick={action(() => onDelete(descriptor.id))} type="button">⌫ <span>Delete</span><kbd>Del</kbd></button>
        <hr />
        <button onClick={action(() => onDownload(descriptor.id))} type="button">⇩ <span>Download</span></button>
        <button type="button">ⓘ <span>Properties</span></button>
      </> : <>
        <strong>{descriptor.name}</strong>
        <button onClick={action(() => onLaunch(descriptor))} type="button">▶ <span>Open</span></button>
        <button onClick={action(() => onTogglePin(`builtin:${descriptor.native}`))} type="button">⌖ <span>{pinned ? "Unpin from taskbar" : "Pin to taskbar"}</span></button>
      </> : null}
    </div>
  );
}

function Taskbar2({
  apps,
  liveAppIds,
  pins,
  trayApps,
  windows,
  clock,
  launchingId,
  startOpen,
  searchOpen,
  onLaunchApp,
  onOpenNative,
  onTaskWindow,
  onToggleCalendar,
  onToggleSearch,
  onToggleStart,
  onToggleTray,
}: {
  apps: PlasmonApp[];
  liveAppIds: ReadonlySet<string>;
  pins: string[];
  trayApps: PlasmonApp[];
  windows: GuiWindow[];
  clock: Date;
  launchingId: string | null;
  startOpen: boolean;
  searchOpen: boolean;
  onLaunchApp: (app: PlasmonApp) => void;
  onOpenNative: (kind: WindowKind) => void;
  onTaskWindow: (kind: WindowKind) => void;
  onToggleCalendar: () => void;
  onToggleSearch: () => void;
  onToggleStart: () => void;
  onToggleTray: () => void;
}) {
  const openKinds = new Set(windows.map((entry) => entry.kind));
  const keys: string[] = [];
  for (const key of pins) if (!keys.includes(key)) keys.push(key);
  for (const kind of openKinds) {
    const key = `builtin:${kind}`;
    if (!keys.includes(key)) keys.push(key);
  }
  for (const appId of liveAppIds) {
    const key = `app:${appId}`;
    if (!keys.includes(key)) keys.push(key);
  }
  const time = clock.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const date = clock.toLocaleDateString([], { month: "numeric", day: "numeric", year: "2-digit" });

  return (
    <footer className="pl2-taskbar">
      <div className="pl2-taskbar-center">
        <button aria-label="Start" className={`pl2-start${startOpen ? " active" : ""}`} onClick={onToggleStart} type="button"><ElectronMark /></button>
        <button aria-label="Search" className={`pl2-task-search${searchOpen ? " active" : ""}`} onClick={onToggleSearch} type="button">⌕</button>
        <div className="pl2-task-icons">
          {keys.map((key) => {
            if (key.startsWith("app:")) {
              const app = apps.find((candidate) => `app:${candidate.id}` === key);
              if (!app) return null;
              const running = liveAppIds.has(app.id);
              return <button className={running ? "running" : ""} disabled={!app.tiles.length} key={key} onClick={() => onLaunchApp(app)} title={app.name} type="button"><AppGlyph2 app={app} size="small" />{launchingId === app.id ? <i className="launching" /> : null}</button>;
            }
            const kind = key.replace(/^builtin:/u, "") as WindowKind;
            if (!NATIVE_META[kind]) return null;
            const running = openKinds.has(kind);
            return <button className={running ? "running" : ""} key={key} onClick={() => running ? onTaskWindow(kind) : onOpenNative(kind)} title={NATIVE_META[kind].title} type="button"><NativeGlyph glyph={nativeGlyph(kind)} variant="native" /></button>;
          })}
        </div>
      </div>
      <div className="pl2-taskbar-system">
        <button className="tray-preview" onClick={onToggleTray} title="Neutron app trays" type="button">⌃{trayApps.slice(0, 2).map((app) => <AppGlyph2 app={app} key={app.id} size="small" />)}</button>
        <span className="status-glyphs">◉ ᯤ</span>
        <button className="clock" onClick={onToggleCalendar} type="button"><strong>{time}</strong><small>{date}</small></button>
      </div>
    </footer>
  );
}

function relativeTime(timestamp: number): string {
  const delta = Date.now() - timestamp;
  if (delta < 60_000) return "Just now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

function cryptoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replaceAll("-", "").slice(0, 14);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
