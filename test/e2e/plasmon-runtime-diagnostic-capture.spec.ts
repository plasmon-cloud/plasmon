import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";
import { resolveLocalNeutronRuntime } from "../../packages/neutron-provision/src/local_session.ts";
import { installPlasmonBrowserHealth } from "./plasmon-browser-health.ts";
import { installPackagedDiagnosticArtifact } from "./plasmon-diagnostic-artifact.ts";

const PLASMON_SELECTOR = 'iframe[data-app-id="plasmon"][data-tile-id="main"]';

async function launchPlasmon(page: Page) {
  const runtime = resolveLocalNeutronRuntime();
  const kernelUrl = localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
  const diagnostics = installPackagedDiagnosticArtifact(page);
  const health = installPlasmonBrowserHealth(page, { firstPartyOrigins: [kernelUrl] });

  await page.goto(kernelUrl);
  await page.waitForFunction(() => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function");
  await page.evaluate(
    (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
    runtime.developerIdentitySeed,
  );
  await page.locator('[data-tid="launcher-open"]').click();
  await page.locator('[data-tid="launcher-tile-plasmon-main"]').click();
  await expect(page.locator(PLASMON_SELECTOR).first()).toBeVisible();
  const app = page.frameLocator(PLASMON_SELECTOR).first();
  await expect(app.getByRole("navigation", { name: "Taskbar" })).toBeVisible({ timeout: 30_000 });
  return { app, health, diagnostics };
}

function waitForRuntimeDiagnostic(page: Page, event: string) {
  return page.waitForEvent("console", {
    predicate: (message) => message.text().includes(`[runtime] | ${event} |`),
  });
}

async function triggerUncaughtProductError(app: FrameLocator): Promise<void> {
  await app.locator("body").evaluate(() => {
    setTimeout(() => {
      function ordinaryProductFunction(): never {
        throw new TypeError(
          "PRIVATE_BROWSER_CONTENT Bearer browser-secret https://private.example/Users/alice/document.txt?token=browser-secret",
        );
      }
      ordinaryProductFunction();
    }, 0);
  });
}

async function triggerUnhandledProductRejection(app: FrameLocator): Promise<void> {
  await app.locator("body").evaluate(() => {
    function ordinaryAsyncProductFunction(): Promise<never> {
      return Promise.reject(new RangeError(
        "PRIVATE_REJECTION_CONTENT Bearer rejection-secret https://private.example/Users/alice/rejection.txt?token=rejection-secret",
      ));
    }
    void ordinaryAsyncProductFunction();
  });
}

test("real browser uncaught exceptions and unhandled rejections enter canonical diagnostics without weakening BrowserHealth", async ({ page }, testInfo) => {
  const { app, health, diagnostics } = await launchPlasmon(page);
  try {
    const uncaughtDiagnostic = waitForRuntimeDiagnostic(page, "runtime.uncaught_error");
    const pageError = page.waitForEvent("pageerror");
    await triggerUncaughtProductError(app);
    const [uncaughtMessage, uncaughtPageError] = await Promise.all([uncaughtDiagnostic, pageError]);

    expect(uncaughtPageError).toBeInstanceOf(Error);
    expect(uncaughtMessage.text()).toContain('"name":"TypeError"');
    expect(uncaughtMessage.text()).toContain("ordinaryProductFunction");
    expect(uncaughtMessage.text()).not.toContain("PRIVATE_BROWSER_CONTENT");
    expect(uncaughtMessage.text()).not.toContain("browser-secret");
    expect(uncaughtMessage.text()).not.toContain("private.example");
    expect(uncaughtMessage.text()).not.toContain("/Users/alice");

    const rejectionDiagnostic = waitForRuntimeDiagnostic(page, "runtime.unhandled_rejection");
    await triggerUnhandledProductRejection(app);
    const rejectionMessage = await rejectionDiagnostic;
    expect(rejectionMessage.text()).toContain('"name":"RangeError"');
    expect(rejectionMessage.text()).toContain("ordinaryAsyncProductFunction");
    expect(rejectionMessage.text()).not.toContain("PRIVATE_REJECTION_CONTENT");
    expect(rejectionMessage.text()).not.toContain("rejection-secret");
    expect(rejectionMessage.text()).not.toContain("private.example");

    // Runtime capture is observational only. The real page error remains a strict
    // BrowserHealth failure even though a matching canonical diagnostic exists.
    expect(() => health.assertClean()).toThrow();
  } catch (error) {
    await diagnostics.attach(testInfo);
    throw error;
  } finally {
    diagnostics.dispose();
    health.dispose();
  }
});

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
