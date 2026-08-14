import type { ConsoleMessage, Page, Request, Response } from "@playwright/test";

export type BrowserHealthIssueKind =
  | "pageerror"
  | "console.error"
  | "console.warn"
  | "requestfailed"
  | "response";

export interface BrowserHealthIssue {
  readonly kind: BrowserHealthIssueKind;
  readonly message: string;
  readonly url?: string;
  readonly status?: number;
}

export interface BrowserHealthAllowRule {
  readonly kind: BrowserHealthIssueKind;
  readonly message?: string;
  readonly messageIncludes?: string;
  readonly reason: string;
  readonly url?: string;
  readonly urlPathPrefix?: string;
  readonly status?: number;
}

export interface AllowedBrowserHealthIssue extends BrowserHealthIssue {
  readonly reason: string;
}

export interface BrowserHealthLedgerOptions {
  readonly allow?: readonly BrowserHealthAllowRule[];
}

function urlPathMatches(prefix: string, url: string | undefined): boolean {
  if (!url) return false;
  try {
    return new URL(url).pathname.startsWith(prefix);
  } catch {
    return false;
  }
}

function allowRuleMatches(rule: BrowserHealthAllowRule, issue: BrowserHealthIssue): boolean {
  return rule.kind === issue.kind
    && (rule.message === undefined || rule.message === issue.message)
    && (rule.messageIncludes === undefined || issue.message.includes(rule.messageIncludes))
    && (rule.url === undefined || rule.url === issue.url)
    && (rule.urlPathPrefix === undefined || urlPathMatches(rule.urlPathPrefix, issue.url))
    && (rule.status === undefined || rule.status === issue.status);
}

function formatIssue(issue: BrowserHealthIssue): string {
  const details = [issue.kind, issue.message];
  if (issue.status !== undefined) details.push(`status=${issue.status}`);
  if (issue.url) details.push(issue.url);
  return details.join(" | ");
}

export class BrowserHealthLedger {
  readonly #allow: readonly BrowserHealthAllowRule[];
  readonly #failures: BrowserHealthIssue[] = [];
  readonly #allowed: AllowedBrowserHealthIssue[] = [];

  constructor(options: BrowserHealthLedgerOptions = {}) {
    this.#allow = options.allow ?? [];
  }

  record(issue: BrowserHealthIssue): void {
    const rule = this.#allow.find((candidate) => allowRuleMatches(candidate, issue));
    if (rule) {
      this.#allowed.push({ ...issue, reason: rule.reason });
      return;
    }
    this.#failures.push(issue);
  }

  failures(): readonly BrowserHealthIssue[] {
    return [...this.#failures];
  }

  allowedIssues(): readonly AllowedBrowserHealthIssue[] {
    return [...this.#allowed];
  }

  assertClean(): void {
    if (this.#failures.length === 0) return;
    throw new Error(
      `Unexpected packaged browser health failures:\n${this.#failures
        .map((issue) => `- ${formatIssue(issue)}`)
        .join("\n")}`,
    );
  }
}

export interface InstallBrowserHealthOptions extends BrowserHealthLedgerOptions {
  /** Origins owned by the installed acceptance environment. Request/HTTP failures outside these origins are ignored. */
  readonly firstPartyOrigins: readonly string[];
}

export interface InstalledBrowserHealth {
  readonly ledger: BrowserHealthLedger;
  assertClean(): void;
  dispose(): void;
}

function normalizedOrigins(origins: readonly string[]): ReadonlySet<string> {
  return new Set(origins.map((origin) => new URL(origin).origin));
}

function isFirstParty(url: string, origins: ReadonlySet<string>): boolean {
  try {
    return origins.has(new URL(url).origin);
  } catch {
    return false;
  }
}

function consoleIssue(message: ConsoleMessage): BrowserHealthIssue | null {
  if (message.type() !== "error" && message.type() !== "warning") return null;
  const location = message.location();
  return {
    kind: message.type() === "error" ? "console.error" : "console.warn",
    message: message.text(),
    url: location.url || undefined,
  };
}

function failedRequestIssue(request: Request): BrowserHealthIssue {
  return {
    kind: "requestfailed",
    message: request.failure()?.errorText ?? "request failed",
    url: request.url(),
  };
}

function failedResponseIssue(response: Response): BrowserHealthIssue {
  return {
    kind: "response",
    message: `HTTP ${response.status()}`,
    url: response.url(),
    status: response.status(),
  };
}

/**
 * Attach the shared strict packaged-browser health policy to one Playwright page.
 *
 * Product semantics remain outside this helper. It observes browser-owned
 * failure signals only and records them in a deterministic ledger that tests
 * assert at the end of their representative workflow. Allow rules remain
 * scenario-owned and narrow: exact matches are preferred, while substring and
 * pathname-prefix matching exist only for browser diagnostics containing
 * dynamic origins, hashes, or stack text.
 */
export function installPlasmonBrowserHealth(
  page: Page,
  options: InstallBrowserHealthOptions,
): InstalledBrowserHealth {
  const origins = normalizedOrigins(options.firstPartyOrigins);
  const ledger = new BrowserHealthLedger(options);

  const onPageError = (error: Error): void => {
    ledger.record({ kind: "pageerror", message: error.message });
  };
  const onConsole = (message: ConsoleMessage): void => {
    const issue = consoleIssue(message);
    if (issue) ledger.record(issue);
  };
  const onRequestFailed = (request: Request): void => {
    if (isFirstParty(request.url(), origins)) ledger.record(failedRequestIssue(request));
  };
  const onResponse = (response: Response): void => {
    if (response.status() >= 400 && isFirstParty(response.url(), origins)) {
      ledger.record(failedResponseIssue(response));
    }
  };

  page.on("pageerror", onPageError);
  page.on("console", onConsole);
  page.on("requestfailed", onRequestFailed);
  page.on("response", onResponse);

  return {
    ledger,
    assertClean: () => ledger.assertClean(),
    dispose: () => {
      page.off("pageerror", onPageError);
      page.off("console", onConsole);
      page.off("requestfailed", onRequestFailed);
      page.off("response", onResponse);
    },
  };
}

// #217 baseline trigger: test-only no-op; packaged product inputs remain identical to release.
