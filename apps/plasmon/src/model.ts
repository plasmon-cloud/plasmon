export type VfsKind =
  | "folder"
  | "markdown"
  | "text"
  | "image"
  | "video"
  | "atom";

export type VfsItem = {
  id: string;
  parentId: string;
  name: string;
  kind: VfsKind;
  content?: string;
  source?: string;
  detail?: string;
  modified: number;
};

export type IconPosition = { x: number; y: number };
export type IconPositions = Record<string, IconPosition>;

const FILES_KEY = "plasmon-gui2-vfs-v1";
const POSITIONS_KEY = "plasmon-gui2-icon-positions-v1";
const PINS_KEY = "plasmon-gui2-taskbar-pins-v1";

const now = Date.now();

export const INITIAL_VFS: VfsItem[] = [
  {
    id: "folder-documents",
    parentId: "desktop",
    name: "Documents",
    kind: "folder",
    detail: "Folder",
    modified: now - 86_400_000,
  },
  {
    id: "folder-media",
    parentId: "desktop",
    name: "Media",
    kind: "folder",
    detail: "Folder",
    modified: now - 86_400_000,
  },
  {
    id: "folder-projects",
    parentId: "desktop",
    name: "Projects",
    kind: "folder",
    detail: "Folder",
    modified: now - 172_800_000,
  },
  {
    id: "atom-budget",
    parentId: "desktop",
    name: "Budget 2026.nsheet",
    kind: "atom",
    detail: "Spreadsheet Atom",
    modified: now - 3_600_000,
  },
  {
    id: "readme-md",
    parentId: "desktop",
    name: "Welcome.md",
    kind: "markdown",
    content:
      "# Welcome to Plasmon\n\nThis desktop treats **Atoms like files**: things you can name, open, organize, and eventually share.\n\n## GUI2 experiment\n\n- Drag desktop icons\n- Draw a selection rectangle\n- Cut, copy, paste, rename, and delete local items\n- Open Markdown and video files in windows\n- Launch installed Neutron apps as real Kernel tiles\n",
    detail: "Markdown document",
    modified: now,
  },
  {
    id: "project-notes",
    parentId: "folder-documents",
    name: "Plasmon Notes.md",
    kind: "markdown",
    content:
      "# Plasmon Notes\n\nThe long-term desktop model is:\n\n- **Elements** are applications.\n- **Atoms** are file-like user objects.\n- **Neutron** provides runtime and security.\n- **Plasmon** provides the familiar desktop environment.\n",
    detail: "Markdown document",
    modified: now - 7_200_000,
  },
  {
    id: "ideas-text",
    parentId: "folder-projects",
    name: "ideas.txt",
    kind: "text",
    content: "Tray mirroring\nAtom sharing\nFloating Kernel windows\nDesktop search\n",
    detail: "Text document",
    modified: now - 10_800_000,
  },
  {
    id: "flower-video",
    parentId: "folder-media",
    name: "Flower demo.mp4",
    kind: "video",
    source: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    detail: "Remote CC0 demo video",
    modified: now - 86_400_000,
  },
  {
    id: "sintel-video",
    parentId: "folder-media",
    name: "Sintel trailer.mp4",
    kind: "video",
    source: "https://media.w3.org/2010/05/sintel/trailer.mp4",
    detail: "Remote demo video",
    modified: now - 86_400_000,
  },
  {
    id: "wallpaper-image",
    parentId: "folder-media",
    name: "Plasma field.svg",
    kind: "image",
    detail: "Generated desktop artwork",
    modified: now - 86_400_000,
  },
];

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The GUI remains usable in an ephemeral browser context.
  }
}

export function loadVfs(): VfsItem[] {
  const value = readJson<unknown>(FILES_KEY, INITIAL_VFS);
  if (!Array.isArray(value)) return INITIAL_VFS.map((item) => ({ ...item }));
  const items = value.filter(isVfsItem).map((item) => ({ ...item }));
  return items.length > 0 ? items : INITIAL_VFS.map((item) => ({ ...item }));
}

export function saveVfs(items: VfsItem[]): void {
  writeJson(FILES_KEY, items);
}

export function loadIconPositions(): IconPositions {
  const value = readJson<unknown>(POSITIONS_KEY, {});
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const positions: IconPositions = {};
  for (const [key, candidate] of Object.entries(value)) {
    if (
      candidate &&
      typeof candidate === "object" &&
      !Array.isArray(candidate) &&
      typeof (candidate as { x?: unknown }).x === "number" &&
      typeof (candidate as { y?: unknown }).y === "number"
    ) {
      positions[key] = {
        x: (candidate as { x: number }).x,
        y: (candidate as { y: number }).y,
      };
    }
  }
  return positions;
}

export function saveIconPositions(positions: IconPositions): void {
  writeJson(POSITIONS_KEY, positions);
}

export function loadPins(): string[] {
  const value = readJson<unknown>(PINS_KEY, [
    "builtin:explorer",
    "builtin:control",
    "builtin:terminal",
  ]);
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function savePins(pins: string[]): void {
  writeJson(PINS_KEY, pins);
}

export function uniqueName(items: VfsItem[], parentId: string, requested: string): string {
  const names = new Set(
    items
      .filter((item) => item.parentId === parentId)
      .map((item) => item.name.toLocaleLowerCase()),
  );
  if (!names.has(requested.toLocaleLowerCase())) return requested;
  const dot = requested.lastIndexOf(".");
  const base = dot > 0 ? requested.slice(0, dot) : requested;
  const extension = dot > 0 ? requested.slice(dot) : "";
  let index = 2;
  while (names.has(`${base} (${index})${extension}`.toLocaleLowerCase())) index += 1;
  return `${base} (${index})${extension}`;
}

export function descendants(items: VfsItem[], id: string): Set<string> {
  const result = new Set<string>([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of items) {
      if (result.has(item.parentId) && !result.has(item.id)) {
        result.add(item.id);
        changed = true;
      }
    }
  }
  return result;
}

export function cloneItemTree(
  items: VfsItem[],
  sourceId: string,
  parentId: string,
): VfsItem[] {
  const source = items.find((item) => item.id === sourceId);
  if (!source) return items;
  const idMap = new Map<string, string>();
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const tree = descendants(items, sourceId);
  for (const id of tree) idMap.set(id, `${id}-copy-${stamp}-${idMap.size}`);
  const rootName = uniqueName(items, parentId, source.name);
  const copies = items
    .filter((item) => tree.has(item.id))
    .map((item) => ({
      ...item,
      id: idMap.get(item.id)!,
      parentId:
        item.id === sourceId
          ? parentId
          : idMap.get(item.parentId) ?? parentId,
      name: item.id === sourceId ? rootName : item.name,
      modified: Date.now(),
    }));
  return [...items, ...copies];
}

function isVfsItem(value: unknown): value is VfsItem {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<VfsItem>;
  return (
    typeof item.id === "string" &&
    typeof item.parentId === "string" &&
    typeof item.name === "string" &&
    typeof item.kind === "string" &&
    ["folder", "markdown", "text", "image", "video", "atom"].includes(item.kind) &&
    typeof item.modified === "number"
  );
}
