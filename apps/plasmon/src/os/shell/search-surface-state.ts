import {
  filterSearchResults,
  type SearchBatch,
  type SearchTab,
  type ShellSearchResult,
} from "./search.ts";

export interface SearchSurfaceViewState {
  results: readonly ShellSearchResult[];
  searching: boolean;
  error: string | null;
  empty: boolean;
  warnings: readonly string[];
  truncated: boolean;
}

export function deriveSearchSurfaceViewState(input: {
  batch: SearchBatch;
  tab: SearchTab;
  searching: boolean;
  error: string | null;
}): SearchSurfaceViewState {
  const results = filterSearchResults(input.batch.results, input.tab);
  return {
    results,
    searching: input.searching,
    error: input.error,
    empty: !input.searching && results.length === 0,
    warnings: input.batch.warnings,
    truncated: input.batch.truncated,
  };
}
