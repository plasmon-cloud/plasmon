import { describe, expect, test } from "bun:test";
import { within } from "@testing-library/react";
import type { ExternalElement } from "../../src/os/contracts/index.ts";
import { renderPlasmon } from "../renderPlasmon.tsx";

const reviewElement: ExternalElement = {
  id: "review",
  name: "Review",
  description: "Collaborative review workspace.",
  version: 1,
  icon: "/app/review/icon.svg",
  tiles: [{ id: "review", title: "Review" }],
  running: "no",
};

describe("renderPlasmon", () => {
  test("drives the production Shell through semantic RTL and user-event APIs", async () => {
    const app = await renderPlasmon({ elements: [reviewElement] });

    try {
      const searchButton = app.getByRole("button", { name: "Search" });
      await app.user.click(searchButton);

      const searchRegion = app.getByRole("region", { name: "Search" });
      const searchInput = within(searchRegion).getByRole("textbox", {
        name: "Search Plasmon",
      });
      await app.user.type(searchInput, "Review");

      expect((searchInput as HTMLInputElement).value).toBe("Review");
      await within(searchRegion).findByRole("button", { name: /^Review/ });
      expect(app.environment.services).toBeDefined();
    } finally {
      app.dispose();
    }
  });
});
