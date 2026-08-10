import { expect, test } from "bun:test";
import { createNeutronBridge } from "./bridge.ts";
import { MockNeutronBridge } from "./mock.ts";
import { VanillaNeutronBridge } from "./vanilla.ts";

test("factory keeps preview and vanilla modes distinct", () => {
  expect(createNeutronBridge({ mode: "preview", preview: { logger: () => {} } })).toBeInstanceOf(MockNeutronBridge);
  expect(createNeutronBridge({ mode: "neutron", vanilla: { lifecycleTargets: {} } })).toBeInstanceOf(VanillaNeutronBridge);
});

test("preview bridge exposes deterministic mock discovery without Kernel calls", async () => {
  const messages: string[] = [];
  const bridge = new MockNeutronBridge({ logger: (message) => messages.push(message) });
  const elements = await bridge.loadElements();
  expect(elements.find((element) => element.id === "chess")?.running).toBe("yes");
  await bridge.openElement("files");
  await bridge.offerInstall("https://example.com/demo.neutron");
  expect(messages).toEqual([
    "[Plasmon preview] Open Files/main",
    "[Plasmon preview] Offer install https://example.com/demo.neutron",
  ]);
});
