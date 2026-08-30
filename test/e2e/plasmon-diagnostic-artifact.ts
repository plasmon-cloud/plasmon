import type { ConsoleMessage, Page, TestInfo } from "@playwright/test";

const MAX_ARTIFACT_ENTRIES = 40;
const MAX_ARTIFACT_BYTES = 8 * 1024;
const DIAGNOSTIC_IDENTITY = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z) \| (DEBUG|INFO|NOTICE|WARN|ERROR|CRITICAL) \| \[([A-Za-z0-9_.:-]{1,80})\] \| ([A-Za-z0-9_.:-]{1,160})(?: \| |$)/;

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

/**
 * Reduce a human-formatted production console diagnostic to stable, non-payload identity.
 * Messages, context, errors, correlation values, paths, URLs, and arbitrary console output
 * never enter the CI artifact.
 */
export function sanitizePackagedDiagnosticLine(text: string): string | null {
  const match = DIAGNOSTIC_IDENTITY.exec(text);
  if (!match) return null;
  const [, timestamp, level, subsystem, event] = match;
  return `${timestamp} | ${level} | [${subsystem}] | ${event}`;
}

export class PackagedDiagnosticTail {
  readonly #entries: string[] = [];

  record(text: string): void {
    const sanitized = sanitizePackagedDiagnosticLine(text);
    if (!sanitized) return;
    this.#entries.push(sanitized);
    while (
      this.#entries.length > MAX_ARTIFACT_ENTRIES
      || byteLength(`${this.#entries.join("\n")}\n`) > MAX_ARTIFACT_BYTES
    ) {
      this.#entries.shift();
    }
  }

  text(): string {
    return this.#entries.length === 0 ? "" : `${this.#entries.join("\n")}\n`;
  }
}

export interface InstalledPackagedDiagnosticArtifact {
  readonly tail: PackagedDiagnosticTail;
  attach(testInfo: TestInfo): Promise<void>;
  dispose(): void;
}

/**
 * Observe Plasmon's existing production browser-console sink for failure evidence.
 * This is an artifact observer only; BrowserHealth remains a separate strict authority.
 */
export function installPackagedDiagnosticArtifact(
  page: Page,
): InstalledPackagedDiagnosticArtifact {
  const tail = new PackagedDiagnosticTail();
  const onConsole = (message: ConsoleMessage): void => tail.record(message.text());
  page.on("console", onConsole);

  return {
    tail,
    attach: async (testInfo: TestInfo) => {
      const text = tail.text();
      if (!text) return;
      await testInfo.attach("plasmon-diagnostics-tail", {
        body: text,
        contentType: "text/plain",
      });
    },
    dispose: () => page.off("console", onConsole),
  };
}
