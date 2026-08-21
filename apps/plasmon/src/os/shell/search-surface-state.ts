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
  capped: boolean;
}

export function deriveSearchSurfaceViewState(input: {
  batch: SearchBatch;
  tab: SearchTab;
  searching: boolean;
  error: string | null;
}): SearchSurfaceViewState {
  const results = input.error ? [] : filterSearchResults(input.batch.results, input.tab);
  return {
    results,
    searching: input.searching,
    error: input.error,
    empty: !input.searching && !input.error && results.length === 0,
    warnings: input.error ? [] : input.batch.warnings,
    truncated: input.error ? false : input.batch.truncated,
    capped: input.error ? false : input.batch.capped,
  };
}
