import { expect, test } from "bun:test";
import { waitFor } from "@testing-library/react";
import { renderPlasmon } from "../renderPlasmon.tsx";

test("Browser launcher supports Go and Enter navigation with bounded invalid-input feedback", async () => {
  const app = await renderPlasmon();

  try {
    await app.environment.os.open("/System/Browser.sys");

    const address = await app.findByRole("textbox", { name: "Web address" });
    expect(app.getByText("Enter an http:// or https:// address to browse.")).toBeDefined();
    expect(app.queryByRole("alert")).toBeNull();

    let browserProcess = app.environment.os.processes.list().find(
      (process) => process.handlerId === "native:browser",
    );
    expect(browserProcess?.state).toBe("running");
    expect(browserProcess?.windowId).toBeDefined();
    expect(app.environment.os.windows.list().some(
      (window) => window.processId === browserProcess?.id,
    )).toBe(true);

    await app.user.type(address, "https://example.com");
    await app.user.click(app.getByRole("button", { name: "Go" }));

    const firstFrame = await app.findByTitle("example.com");
    expect(firstFrame.getAttribute("src")).toBe("https://example.com/");
    browserProcess = app.environment.os.processes.list().find(
      (process) => process.handlerId === "native:browser",
    );
    expect(browserProcess?.title).toBe("example.com");

    await app.user.clear(address);
    await app.user.type(address, "https://example.org{Enter}");

    const secondFrame = await app.findByTitle("example.org");
    expect(secondFrame.getAttribute("src")).toBe("https://example.org/");
    browserProcess = app.environment.os.processes.list().find(
      (process) => process.handlerId === "native:browser",
    );
    expect(browserProcess?.title).toBe("example.org");

    await app.user.clear(address);
    await app.user.type(address, "ftp://example.net{Enter}");

    const alert = await app.findByRole("alert");
    expect(alert.textContent).toContain("Enter a complete http:// or https:// URL");
    await waitFor(() => {
      const current = app.environment.os.processes.list().find(
        (process) => process.handlerId === "native:browser",
      );
      expect(current?.title).toBe("example.org");
    });
  } finally {
    app.dispose();
  }
});
