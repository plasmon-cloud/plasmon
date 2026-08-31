import type { FsNode, FsService, JsonValue } from "../contracts/index.ts";
import {
  CONFIGURATION_PATH,
  FilesystemConfigurationDocumentStore,
  type ConfigurationDiagnostic,
  type ConfigurationDocument,
  type ConfigurationDocumentDefinition,
  type ConfigurationService,
} from "../fs/configuration.ts";

export const VISUAL_PRESENTATION_CONFIGURATION_PATH = `${CONFIGURATION_PATH}/Visual/presentation.json`;
export const VISUAL_PRESENTATION_SCHEMA = "plasmon.visual.presentation";
export const VISUAL_PRESENTATION_SCHEMA_VERSION = 1;

export const VISUAL_LABEL_READABILITY_LEVELS = ["standard", "strong", "maximum"] as const;
export type VisualLabelReadability = (typeof VISUAL_LABEL_READABILITY_LEVELS)[number];

export const VISUAL_CHECKER_INTENSITIES = ["subtle", "standard", "strong"] as const;
export type VisualCheckerIntensity = (typeof VISUAL_CHECKER_INTENSITIES)[number];

export const VISUAL_CHECKER_PATTERNS = ["fine", "standard", "coarse"] as const;
export type VisualCheckerPattern = (typeof VISUAL_CHECKER_PATTERNS)[number];

export interface VisualPresentationConfigurationSnapshot {
  readonly desktopLabels: {
    readonly readability: VisualLabelReadability;
  };
  readonly transparencyChecker: {
    readonly intensity: VisualCheckerIntensity;
    readonly pattern: VisualCheckerPattern;
  };
}

export const DEFAULT_VISUAL_PRESENTATION_CONFIGURATION: VisualPresentationConfigurationSnapshot = Object.freeze({
  desktopLabels: Object.freeze({ readability: "standard" }),
  transparencyChecker: Object.freeze({ intensity: "standard", pattern: "standard" }),
});

const DEFAULT_VISUAL_PRESENTATION_DOCUMENT: ConfigurationDocument = {
  schema: VISUAL_PRESENTATION_SCHEMA,
  version: VISUAL_PRESENTATION_SCHEMA_VERSION,
  desktopLabels: { readability: "standard" },
  transparencyChecker: { intensity: "standard", pattern: "standard" },
};

export const VISUAL_PRESENTATION_CONFIGURATION_DECLARATION = {
  owner: "Visual",
  fileName: "presentation.json",
  schema: VISUAL_PRESENTATION_SCHEMA,
  version: VISUAL_PRESENTATION_SCHEMA_VERSION,
  reloadClass: "live",
  initialText: `${JSON.stringify(DEFAULT_VISUAL_PRESENTATION_DOCUMENT, null, 2)}\n`,
  mime: "application/json",
} as const;

function object(value: JsonValue | undefined): Record<string, JsonValue> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, JsonValue>
    : null;
}

function recognized<T extends string>(
  value: JsonValue | undefined,
  values: readonly T[],
  fallback: T,
  code: string,
  message: string,
  diagnostics: ConfigurationDiagnostic[],
): T {
  if (typeof value === "string" && values.includes(value as T)) return value as T;
  diagnostics.push({ code, message });
  return fallback;
}

export const VISUAL_PRESENTATION_CONFIGURATION_DEFINITION: ConfigurationDocumentDefinition<VisualPresentationConfigurationSnapshot> = {
  declaration: VISUAL_PRESENTATION_CONFIGURATION_DECLARATION,
  defaults: DEFAULT_VISUAL_PRESENTATION_CONFIGURATION,
  defaultDocument: DEFAULT_VISUAL_PRESENTATION_DOCUMENT,
  migrations: [],
  parse: (document) => {
    const diagnostics: ConfigurationDiagnostic[] = [];
    const desktopLabels = object(document.desktopLabels);
    const transparencyChecker = object(document.transparencyChecker);
    const readability = recognized(
      desktopLabels?.readability,
      VISUAL_LABEL_READABILITY_LEVELS,
      DEFAULT_VISUAL_PRESENTATION_CONFIGURATION.desktopLabels.readability,
      "invalid-desktop-label-readability",
      "desktopLabels.readability must be a recognized Visual readability level; using the safe default",
      diagnostics,
    );
    const intensity = recognized(
      transparencyChecker?.intensity,
      VISUAL_CHECKER_INTENSITIES,
      DEFAULT_VISUAL_PRESENTATION_CONFIGURATION.transparencyChecker.intensity,
      "invalid-transparency-checker-intensity",
      "transparencyChecker.intensity must be a recognized Visual checker intensity; using the safe default",
      diagnostics,
    );
    const pattern = recognized(
      transparencyChecker?.pattern,
      VISUAL_CHECKER_PATTERNS,
      DEFAULT_VISUAL_PRESENTATION_CONFIGURATION.transparencyChecker.pattern,
      "invalid-transparency-checker-pattern",
      "transparencyChecker.pattern must be a recognized Visual checker pattern; using the safe default",
      diagnostics,
    );
    return {
      value: Object.freeze({
        desktopLabels: Object.freeze({ readability }),
        transparencyChecker: Object.freeze({ intensity, pattern }),
      }),
      ...(diagnostics.length > 0 ? { diagnostics } : {}),
    };
  },
  equals: (left, right) => (
    left.desktopLabels.readability === right.desktopLabels.readability
    && left.transparencyChecker.intensity === right.transparencyChecker.intensity
    && left.transparencyChecker.pattern === right.transparencyChecker.pattern
  ),
};

export function applyVisualPresentationConfiguration(
  shell: HTMLElement,
  snapshot: VisualPresentationConfigurationSnapshot,
): void {
  shell.dataset.plasmonVisualLabelReadability = snapshot.desktopLabels.readability;
  shell.dataset.plasmonVisualCheckerIntensity = snapshot.transparencyChecker.intensity;
  shell.dataset.plasmonVisualCheckerPattern = snapshot.transparencyChecker.pattern;
}

export function clearVisualPresentationConfiguration(shell: HTMLElement): void {
  delete shell.dataset.plasmonVisualLabelReadability;
  delete shell.dataset.plasmonVisualCheckerIntensity;
  delete shell.dataset.plasmonVisualCheckerPattern;
}

export interface VisualPresentationConfigurationOptions {
  readonly onDiagnostic?: (diagnostic: ConfigurationDiagnostic) => void;
}

/**
 * Visual-owned semantic consumer of the filesystem configuration-document
 * contract. Filesystem keeps NodeId/bytes/reconciliation/event authority; this
 * controller owns only the bounded Visual schema and its effective snapshot.
 */
export class VisualPresentationConfigurationController {
  private readonly store: FilesystemConfigurationDocumentStore<VisualPresentationConfigurationSnapshot>;
  readonly ready: Promise<void>;

  constructor(
    fs: FsService,
    private readonly configuration: ConfigurationService,
    options: VisualPresentationConfigurationOptions = {},
  ) {
    this.store = new FilesystemConfigurationDocumentStore({
      fs,
      configuration,
      definition: VISUAL_PRESENTATION_CONFIGURATION_DEFINITION,
      ...(options.onDiagnostic ? { onDiagnostic: options.onDiagnostic } : {}),
    });
    // The store already leaves the canonical default snapshot active when a
    // cold read fails. Keep composition usable while filesystem diagnostics stay
    // owned by the filesystem layer rather than creating Visual log vocabulary.
    this.ready = this.store.ready.catch(() => undefined);
  }

  getSnapshot(): VisualPresentationConfigurationSnapshot {
    return this.store.getSnapshot();
  }

  subscribe(listener: (snapshot: VisualPresentationConfigurationSnapshot) => void): () => void {
    return this.store.subscribe(() => listener(this.store.getSnapshot()));
  }

  async resource(): Promise<FsNode> {
    await this.ready;
    return this.configuration.ensureFile(VISUAL_PRESENTATION_CONFIGURATION_DECLARATION);
  }

  async restoreDefaults(): Promise<void> {
    await this.ready;
    await this.store.restoreDefaults();
  }

  dispose(): void {
    this.store.dispose();
  }
}
