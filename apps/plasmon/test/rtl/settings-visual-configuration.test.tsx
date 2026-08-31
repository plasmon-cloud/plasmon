import { expect, test } from "bun:test";
import { waitFor, within } from "@testing-library/react";
import { VISUAL_PRESENTATION_CONFIGURATION_PATH } from "../../src/os/visual/configuration.ts";
import { renderPlasmon } from "../renderPlasmon.tsx";

test("Settings discovers and opens the authoritative Visual configuration resource", async () => {
  const app = await renderPlasmon();

  try {
    await app.environment.os.open("/System/Settings.sys");
    const settings = await app.findByRole("region", { name: "Settings" });
    const navigation = within(settings).getByRole("navigation", { name: "Settings sections" });
    await app.user.click(within(navigation).getByRole("button", { name: "Personalization" }));

    expect(within(settings).getByRole("heading", { name: "Advanced configuration" })).toBeDefined();
    expect(within(settings).getByText(VISUAL_PRESENTATION_CONFIGURATION_PATH)).toBeDefined();

    await app.user.click(within(settings).getByRole("button", { name: "Open Visual configuration" }));
    await waitFor(() => {
      expect(app.environment.os.processes.list().some(
        (process) => process.handlerId === "native:explorer" && process.state === "running",
      )).toBe(true);
    });
    expect(within(settings).queryByRole("alert")).toBeNull();
  } finally {
    app.dispose();
  }
});
