import type { ProcessId, WindowId } from "../contracts/common.ts";
import type {
  WindowCreateOptions,
  WindowGeometry,
  WindowManager,
  WindowState,
} from "../contracts/window.ts";
import {
  DEFAULT_MIN_HEIGHT,
  DEFAULT_MIN_WIDTH,
  DEFAULT_REACHABLE_TITLEBAR_HEIGHT,
  DEFAULT_REACHABLE_TITLEBAR_WIDTH,
  DEFAULT_WINDOW_HEIGHT,
  DEFAULT_WINDOW_WIDTH,
  constrainGeometry,
  geometryEqual,
  horizontalSnapGeometry,
  maximizeGeometry,
  normalizeViewport,
  type HorizontalSnapSide,
  type WindowViewport,
} from "./geometry.ts";

export interface NativeWindowManagerOptions {
  idFactory?: () => WindowId;
  viewport?: () => WindowViewport;
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  cascadeOffset?: number;
  initialX?: number;
  initialY?: number;
  zBase?: number;
  zCompactAt?: number;
  reachableTitlebarWidth?: number;
  reachableTitlebarHeight?: number;
  listenForViewportChanges?: boolean;
}

export interface WindowGeometryCommitter {
  setGeometry(id: WindowId, geometry: WindowGeometry): void;
}

export interface WindowStateReader {
  get(id: WindowId): WindowState | undefined;
}

export interface WindowSnapController {
  snap(id: WindowId, side: HorizontalSnapSide, restoreGeometry?: WindowGeometry): void;
  getSnapSide(id: WindowId): HorizontalSnapSide | null;
}

let generatedId = 0;
const fallbackId = (): WindowId => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `window:${crypto.randomUUID()}`;
  }
  generatedId += 1;
  return `window:${Date.now().toString(36)}:${generatedId.toString(36)}`;
};

const browserViewport = (): WindowViewport => {
  if (typeof window === "undefined") return { x: 0, y: 0, width: 1280, height: 720 };
  return { x: 0, y: 0, width: window.innerWidth || 1, height: window.innerHeight || 1 };
};

const cloneGeometry = (geometry: WindowGeometry): WindowGeometry => ({ ...geometry });

function cloneState(state: WindowState): WindowState {
  return {
    id: state.id,
    processId: state.processId,
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    z: state.z,
    minimized: state.minimized,
    maximized: state.maximized,
    ...(state.minWidth === undefined ? {} : { minWidth: state.minWidth }),
    ...(state.minHeight === undefined ? {} : { minHeight: state.minHeight }),
    ...(state.restoreGeometry === undefined ? {} : { restoreGeometry: cloneGeometry(state.restoreGeometry) }),
  };
}

function stateGeometry(state: WindowState): WindowGeometry {
  return { x: state.x, y: state.y, width: state.width, height: state.height };
}

export class NativeWindowManager implements WindowManager, WindowGeometryCommitter, WindowStateReader, WindowSnapController {
  private readonly windows = new Map<WindowId, WindowState>();
  private readonly snapSides = new Map<WindowId, HorizontalSnapSide>();
  private readonly listeners = new Set<() => void>();
  private readonly idFactory: () => WindowId;
  private readonly viewportProvider: () => WindowViewport;
  private readonly defaultWidth: number;
  private readonly defaultHeight: number;
  private readonly defaultMinWidth: number;
  private readonly defaultMinHeight: number;
  private readonly cascadeOffset: number;
  private readonly initialX: number;
  private readonly initialY: number;
  private readonly zBase: number;
  private readonly zCompactAt: number;
  private readonly reachableTitlebarWidth: number;
  private readonly reachableTitlebarHeight: number;
  private viewportOverride: WindowViewport | undefined;
  private nextZ: number;
  private createdCount = 0;
  private disposed = false;
  private readonly onBrowserResize = (): void => this.constrainToViewport();

  constructor(options: NativeWindowManagerOptions = {}) {
    this.idFactory = options.idFactory ?? fallbackId;
    this.viewportProvider = options.viewport ?? browserViewport;
    this.defaultWidth = Math.max(1, options.defaultWidth ?? DEFAULT_WINDOW_WIDTH);
    this.defaultHeight = Math.max(1, options.defaultHeight ?? DEFAULT_WINDOW_HEIGHT);
    this.defaultMinWidth = Math.max(1, options.minWidth ?? DEFAULT_MIN_WIDTH);
    this.defaultMinHeight = Math.max(1, options.minHeight ?? DEFAULT_MIN_HEIGHT);
    this.cascadeOffset = Math.max(0, options.cascadeOffset ?? 28);
    this.initialX = options.initialX ?? 64;
    this.initialY = options.initialY ?? 48;
    this.zBase = Math.max(0, options.zBase ?? 100);
    this.zCompactAt = Math.max(this.zBase + 100, options.zCompactAt ?? 100_000);
    this.reachableTitlebarWidth = Math.max(1, options.reachableTitlebarWidth ?? DEFAULT_REACHABLE_TITLEBAR_WIDTH);
    this.reachableTitlebarHeight = Math.max(1, options.reachableTitlebarHeight ?? DEFAULT_REACHABLE_TITLEBAR_HEIGHT);
    this.nextZ = this.zBase;

    if ((options.listenForViewportChanges ?? true) && typeof window !== "undefined") {
      window.addEventListener("resize", this.onBrowserResize, { passive: true });
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (typeof window !== "undefined") window.removeEventListener("resize", this.onBrowserResize);
    this.listeners.clear();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  create(processId: ProcessId, initial: WindowCreateOptions = {}): WindowId {
    const id = this.uniqueId();
    const minWidth = Math.max(1, initial.minWidth ?? this.defaultMinWidth);
    const minHeight = Math.max(1, initial.minHeight ?? this.defaultMinHeight);
    const cascade = this.createdCount * this.cascadeOffset;
    this.createdCount += 1;
    const geometry = this.constrain(
      {
        x: initial.x ?? this.initialX + cascade,
        y: initial.y ?? this.initialY + cascade,
        width: initial.width ?? this.defaultWidth,
        height: initial.height ?? this.defaultHeight,
      },
      minWidth,
      minHeight,
    );
    const state: WindowState = {
      id,
      processId,
      ...geometry,
      z: this.raiseZ(),
      minimized: false,
      maximized: false,
      minWidth,
      minHeight,
    };
    this.windows.set(id, state);
    this.compactZIfNeeded();
    this.emit();
    return id;
  }

  focus(id: WindowId): void {
    const state = this.windows.get(id);
    if (!state) return;
    state.minimized = false;
    state.z = this.raiseZ();
    this.compactZIfNeeded();
    this.emit();
  }

  move(id: WindowId, x: number, y: number): void {
    const state = this.windows.get(id);
    if (!state || state.maximized) return;
    const next = this.constrain({ ...stateGeometry(state), x, y }, this.minWidth(state), this.minHeight(state));
    if (geometryEqual(stateGeometry(state), next)) return;
    this.clearSnapForFloatingEdit(state);
    Object.assign(state, next);
    this.emit();
  }

  resize(id: WindowId, width: number, height: number): void {
    const state = this.windows.get(id);
    if (!state || state.maximized) return;
    const next = this.constrain({ ...stateGeometry(state), width, height }, this.minWidth(state), this.minHeight(state));
    if (geometryEqual(stateGeometry(state), next)) return;
    this.clearSnapForFloatingEdit(state);
    Object.assign(state, next);
    this.emit();
  }

  setGeometry(id: WindowId, geometry: WindowGeometry): void {
    const state = this.windows.get(id);
    if (!state || state.maximized) return;
    const next = this.constrain(geometry, this.minWidth(state), this.minHeight(state));
    if (geometryEqual(stateGeometry(state), next)) return;
    this.clearSnapForFloatingEdit(state);
    Object.assign(state, next);
    this.emit();
  }

  snap(id: WindowId, side: HorizontalSnapSide, restoreGeometry?: WindowGeometry): void {
    const state = this.windows.get(id);
    if (!state) return;
    const previousSide = this.snapSides.get(id);
    if (previousSide === undefined) {
      const candidate = restoreGeometry
        ?? (state.maximized && state.restoreGeometry ? state.restoreGeometry : stateGeometry(state));
      state.restoreGeometry = this.constrain(candidate, this.minWidth(state), this.minHeight(state));
    }
    const geometry = horizontalSnapGeometry(this.getViewport(), side);
    const placementChanged = previousSide !== side || state.maximized || state.minimized || !geometryEqual(stateGeometry(state), geometry);
    if (!placementChanged) return;

    this.snapSides.set(id, side);
    Object.assign(state, geometry);
    state.maximized = false;
    state.minimized = false;
    state.z = this.raiseZ();
    this.compactZIfNeeded();
    this.emit();
  }

  getSnapSide(id: WindowId): HorizontalSnapSide | null {
    const state = this.windows.get(id);
    if (!state || state.maximized) return null;
    return this.snapSides.get(id) ?? null;
  }

  minimize(id: WindowId): void {
    const state = this.windows.get(id);
    if (!state || state.minimized) return;
    state.minimized = true;
    this.emit();
  }

  maximize(id: WindowId): void {
    const state = this.windows.get(id);
    if (!state) return;
    if (state.maximized) {
      if (state.minimized) {
        state.minimized = false;
        Object.assign(state, maximizeGeometry(this.getViewport()));
        state.z = this.raiseZ();
        this.compactZIfNeeded();
        this.emit();
      }
      return;
    }
    if (!this.snapSides.has(id)) state.restoreGeometry = cloneGeometry(stateGeometry(state));
    Object.assign(state, maximizeGeometry(this.getViewport()));
    state.maximized = true;
    state.minimized = false;
    state.z = this.raiseZ();
    this.compactZIfNeeded();
    this.emit();
  }

  restore(id: WindowId): void {
    const state = this.windows.get(id);
    if (!state) return;
    const snapSide = this.snapSides.get(id);

    if (state.minimized) {
      state.minimized = false;
      if (state.maximized) Object.assign(state, maximizeGeometry(this.getViewport()));
      else if (snapSide) Object.assign(state, horizontalSnapGeometry(this.getViewport(), snapSide));
      state.z = this.raiseZ();
      this.compactZIfNeeded();
      this.emit();
      return;
    }

    if (state.maximized) {
      if (snapSide) {
        Object.assign(state, horizontalSnapGeometry(this.getViewport(), snapSide));
        state.maximized = false;
        state.z = this.raiseZ();
        this.compactZIfNeeded();
        this.emit();
        return;
      }
      const restoreGeometry = state.restoreGeometry ?? stateGeometry(state);
      Object.assign(state, this.constrain(restoreGeometry, this.minWidth(state), this.minHeight(state)));
      state.maximized = false;
      delete state.restoreGeometry;
      state.z = this.raiseZ();
      this.compactZIfNeeded();
      this.emit();
      return;
    }

    if (!snapSide) return;
    const restoreGeometry = state.restoreGeometry ?? stateGeometry(state);
    Object.assign(state, this.constrain(restoreGeometry, this.minWidth(state), this.minHeight(state)));
    this.snapSides.delete(id);
    delete state.restoreGeometry;
    state.z = this.raiseZ();
    this.compactZIfNeeded();
    this.emit();
  }

  close(id: WindowId): void {
    if (!this.windows.delete(id)) return;
    this.snapSides.delete(id);
    this.emit();
  }

  list(): readonly WindowState[] {
    return [...this.windows.values()].sort((a, b) => a.z - b.z).map(cloneState);
  }

  get(id: WindowId): WindowState | undefined {
    const state = this.windows.get(id);
    return state ? cloneState(state) : undefined;
  }

  setViewport(viewport: WindowViewport): void {
    const normalized = normalizeViewport(viewport);
    const previous = this.viewportOverride;
    this.viewportOverride = normalized;
    if (previous && previous.x === normalized.x && previous.y === normalized.y && previous.width === normalized.width && previous.height === normalized.height) return;
    this.constrainToViewport();
  }

  clearViewportOverride(): void {
    if (!this.viewportOverride) return;
    this.viewportOverride = undefined;
    this.constrainToViewport();
  }

  constrainToViewport(): void {
    let changed = false;
    const viewport = this.getViewport();
    for (const state of this.windows.values()) {
      const snapSide = this.snapSides.get(state.id);
      const next = state.maximized
        ? maximizeGeometry(viewport)
        : snapSide
          ? horizontalSnapGeometry(viewport, snapSide)
          : this.constrain(stateGeometry(state), this.minWidth(state), this.minHeight(state));
      if (!geometryEqual(stateGeometry(state), next)) {
        Object.assign(state, next);
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  private clearSnapForFloatingEdit(state: WindowState): void {
    if (!this.snapSides.delete(state.id)) return;
    delete state.restoreGeometry;
  }

  private uniqueId(): WindowId {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const id = this.idFactory();
      if (!this.windows.has(id)) return id;
    }
    throw new Error("Window id factory repeatedly produced duplicate ids");
  }

  private getViewport(): WindowViewport {
    return normalizeViewport(this.viewportOverride ?? this.viewportProvider());
  }

  private constrain(geometry: WindowGeometry, minWidth: number, minHeight: number): WindowGeometry {
    return constrainGeometry(geometry, this.getViewport(), {
      minWidth,
      minHeight,
      reachableTitlebarWidth: this.reachableTitlebarWidth,
      reachableTitlebarHeight: this.reachableTitlebarHeight,
    });
  }

  private minWidth(state: WindowState): number {
    return state.minWidth ?? this.defaultMinWidth;
  }

  private minHeight(state: WindowState): number {
    return state.minHeight ?? this.defaultMinHeight;
  }

  private raiseZ(): number {
    this.nextZ += 1;
    return this.nextZ;
  }

  private compactZIfNeeded(): void {
    if (this.nextZ < this.zCompactAt) return;
    const ordered = [...this.windows.values()].sort((a, b) => a.z - b.z);
    ordered.forEach((state, index) => { state.z = this.zBase + index + 1; });
    this.nextZ = this.zBase + ordered.length + 1;
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener();
  }
}
