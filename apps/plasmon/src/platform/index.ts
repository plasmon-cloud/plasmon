import { MockPlatform } from "./mock.ts";
import { NeutronPlatform } from "./neutron.ts";
import type { PlasmonPlatform } from "./types.ts";

export * from "./types.ts";

export function createPlatform(): PlasmonPlatform {
  if (typeof window === "undefined" || window.parent === window) {
    return new MockPlatform();
  }
  return new NeutronPlatform();
}
