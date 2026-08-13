import { expect, type Page } from "@playwright/test";

export async function activateLocalPlaywrightIdentity(
  page: Page,
  identitySeed: number,
  expectedPrincipal: string,
): Promise<void> {
  await page.waitForFunction(
    () => typeof window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__ === "function",
  );
  const principal = await page.evaluate(
    (seed) => window.__NEUTRON_PLAYWRIGHT_LOGIN_AS__!(seed),
    identitySeed,
  );
  expect(principal).toBe(expectedPrincipal);
}

declare global {
  interface Window {
    __NEUTRON_PLAYWRIGHT_LOGIN_AS__?: (seed: number) => Promise<string>;
  }
}
