import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ExternalElement,
  FsEventSource,
  FsService,
  NativeAppDefinition,
} from "../contracts/index.ts";
import { deriveSearchSurfaceViewState, type SearchSurfaceViewState } from "./search-surface-state.ts";
import {
  LatestSearchController,
  searchShell,
  subscribeSearchInvalidation,
  type SearchBatch,
  type SearchTab,
} from "./search.ts";

const EMPTY_SEARCH: SearchBatch = { results: [], warnings: [], truncated: false };

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface SearchSurfaceControllerOptions {
  open: boolean;
  fs: FsService;
  fsEvents?: FsEventSource;
  nativeApps: readonly NativeAppDefinition[];
  elements: readonly ExternalElement[];
  pinnedNative: readonly string[];
  pinnedElements: readonly string[];
}

export interface SearchSurfaceController {
  query: string;
  setQuery(value: string): void;
  tab: SearchTab;
  setTab(value: SearchTab): void;
  view: SearchSurfaceViewState;
}

export function useSearchSurfaceController(
  options: SearchSurfaceControllerOptions,
): SearchSurfaceController {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<SearchTab>("all");
  const [batch, setBatch] = useState<SearchBatch>(EMPTY_SEARCH);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const latest = useRef(new LatestSearchController<SearchBatch>());
  const abort = useRef<AbortController | null>(null);

  useEffect(
    () => subscribeSearchInvalidation(options.fsEvents, () => setRevision((value) => value + 1)),
    [options.fsEvents],
  );

  useEffect(() => {
    latest.current.cancel();
    abort.current?.abort();
    abort.current = null;
    setError(null);

    if (!options.open) {
      setSearching(false);
      return undefined;
    }

    setSearching(true);
    const delay = query.trim() ? 140 : 0;
    const timer = typeof window === "undefined" ? null : window.setTimeout(() => {
      const controller = new AbortController();
      abort.current = controller;
      void latest.current.run(
        () => searchShell(options.fs, options.nativeApps, options.elements, query, {
          signal: controller.signal,
          pinnedNative: options.pinnedNative,
          pinnedElements: options.pinnedElements,
        }),
        (nextBatch) => {
          setBatch(nextBatch);
          setSearching(false);
          setError(null);
        },
      ).catch((cause: unknown) => {
        if (controller.signal.aborted || (cause instanceof Error && cause.name === "AbortError")) return;
        setSearching(false);
        setError(formatError(cause));
      });
    }, delay);

    if (timer === null) {
      setSearching(false);
      return undefined;
    }

    return () => {
      window.clearTimeout(timer);
      abort.current?.abort();
    };
  }, [
    options.elements,
    options.fs,
    options.nativeApps,
    options.open,
    options.pinnedElements,
    options.pinnedNative,
    query,
    revision,
  ]);

  const view = useMemo(
    () => deriveSearchSurfaceViewState({ batch, tab, searching, error }),
    [batch, error, searching, tab],
  );

  return { query, setQuery, tab, setTab, view };
}
