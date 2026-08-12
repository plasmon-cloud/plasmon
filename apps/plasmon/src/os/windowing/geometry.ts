import type { WindowGeometry } from "../contracts/window.ts";

export const DEFAULT_WINDOW_WIDTH = 720;
export const DEFAULT_WINDOW_HEIGHT = 520;
export const DEFAULT_MIN_WIDTH = 240;
export const DEFAULT_MIN_HEIGHT = 160;
export const DEFAULT_REACHABLE_TITLEBAR_WIDTH = 72;
export const DEFAULT_REACHABLE_TITLEBAR_HEIGHT = 32;

export type HorizontalSnapSide = "left" | "right";

export interface WindowViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GeometryConstraints {
  minWidth: number;
  minHeight: number;
  reachableTitlebarWidth: number;
  reachableTitlebarHeight: number;
}

const finite = (value: number, fallback: number): number => Number.isFinite(value) ? value : fallback;
const positive = (value: number, fallback: number): number => Math.max(1, finite(value, fallback));
export const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), Math.max(minimum, maximum));

export function normalizeViewport(viewport: WindowViewport): WindowViewport {
  return {
    x: finite(viewport.x, 0),
    y: finite(viewport.y, 0),
    width: Math.max(1, finite(viewport.width, 1)),
    height: Math.max(1, finite(viewport.height, 1)),
  };
}

export function normalizeConstraints(constraints: Partial<GeometryConstraints> = {}): GeometryConstraints {
  return {
    minWidth: positive(constraints.minWidth ?? DEFAULT_MIN_WIDTH, DEFAULT_MIN_WIDTH),
    minHeight: positive(constraints.minHeight ?? DEFAULT_MIN_HEIGHT, DEFAULT_MIN_HEIGHT),
    reachableTitlebarWidth: positive(
      constraints.reachableTitlebarWidth ?? DEFAULT_REACHABLE_TITLEBAR_WIDTH,
      DEFAULT_REACHABLE_TITLEBAR_WIDTH,
    ),
    reachableTitlebarHeight: positive(
      constraints.reachableTitlebarHeight ?? DEFAULT_REACHABLE_TITLEBAR_HEIGHT,
      DEFAULT_REACHABLE_TITLEBAR_HEIGHT,
    ),
  };
}

export function constrainGeometry(
  geometry: WindowGeometry,
  viewportInput: WindowViewport,
  constraintsInput: Partial<GeometryConstraints> = {},
): WindowGeometry {
  const viewport = normalizeViewport(viewportInput);
  const constraints = normalizeConstraints(constraintsInput);
  const maxWidth = Math.max(constraints.minWidth, viewport.width);
  const maxHeight = Math.max(constraints.minHeight, viewport.height);
  const width = clamp(finite(geometry.width, DEFAULT_WINDOW_WIDTH), constraints.minWidth, maxWidth);
  const height = clamp(finite(geometry.height, DEFAULT_WINDOW_HEIGHT), constraints.minHeight, maxHeight);
  const reachableWidth = Math.min(width, constraints.reachableTitlebarWidth, viewport.width);
  const reachableHeight = Math.min(height, constraints.reachableTitlebarHeight, viewport.height);
  const minX = viewport.x - width + reachableWidth;
  const maxX = viewport.x + viewport.width - reachableWidth;
  const minY = viewport.y;
  const maxY = viewport.y + viewport.height - reachableHeight;

  return {
    x: clamp(finite(geometry.x, viewport.x), minX, maxX),
    y: clamp(finite(geometry.y, viewport.y), minY, maxY),
    width,
    height,
  };
}

export function maximizeGeometry(viewportInput: WindowViewport): WindowGeometry {
  const viewport = normalizeViewport(viewportInput);
  return { x: viewport.x, y: viewport.y, width: viewport.width, height: viewport.height };
}

export function horizontalSnapGeometry(
  viewportInput: WindowViewport,
  side: HorizontalSnapSide,
): WindowGeometry {
  const viewport = normalizeViewport(viewportInput);
  const split = Math.floor(viewport.width / 2);
  const leftWidth = Math.max(1, split);
  const rightWidth = Math.max(1, viewport.width - split);

  if (side === "left") {
    return {
      x: viewport.x,
      y: viewport.y,
      width: leftWidth,
      height: viewport.height,
    };
  }

  return {
    x: viewport.x + viewport.width - rightWidth,
    y: viewport.y,
    width: rightWidth,
    height: viewport.height,
  };
}

export function geometryEqual(a: WindowGeometry, b: WindowGeometry): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
