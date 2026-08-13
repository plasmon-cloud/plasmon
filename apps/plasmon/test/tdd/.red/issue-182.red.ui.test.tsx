import { expect, test } from "bun:test";
import { within } from "@testing-library/react";
import { renderPlasmon } from "../../../test/renderPlasmon.tsx";

test("#182 production Explorer Favorites projects the actual root inventory", async () => {
  const view = await renderPlasmon();
  try {
    const root = await view.environment.node("/");
    if (!root) throw new Error("root bootstrap missing");
    const custom = await view.environment.services.fs.mkdir(root.id, "Coordinator Projects");
    const start = view.getByRole("button", { name: "Start" });
    await view.user.click(start);
    await view.user.click(view.getAllByRole("button", { name: "Files Shortcut · native" })[0]!);
    const explorer = await view.findByRole("dialog", { name: "This Plasmon" });
    expect(explorer).toBeTruthy();

    const rootChildren = (await view.environment.services.fs.list(root.id, { includeHidden: false, sort: "name" }))
      .filter((node) => node.kind === "directory" && node.name !== "System" && node.name !== "Apps")
      .map((node) => node.name)
      .filter((name) => name !== "Downloads");
    const favorites = within(within(explorer).getByRole("complementary", { name: "Favorites" }))
      .getAllByRole("button")
      .map((button) => button.textContent?.replace("▰", "").trim() ?? "");

    expect(favorites).toContain("Coordinator Projects");
    expect(favorites).not.toContain("Downloads");
    expect(new Set(favorites)).toEqual(new Set(rootChildren));
    expect(custom.id).toBeTruthy();
  } finally {
    view.dispose();
  }
});
