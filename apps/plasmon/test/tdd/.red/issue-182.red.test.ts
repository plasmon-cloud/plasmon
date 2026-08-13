import { expect, test } from "bun:test";
import { createHeadlessPlasmonEnvironment } from "../../headlessEnvironment.ts";

const currentFavoritesProjection = ["/Desktop", "/Documents", "/Downloads", "/Pictures", "/Videos"];

test("#182 fresh bootstrap and Favorites expose one coherent root inventory", async () => {
  const environment = createHeadlessPlasmonEnvironment();
  try {
    await environment.ready;
    const root = await environment.node("/");
    if (!root) throw new Error("root bootstrap missing");
    const rootDirectories = new Set(
      (await environment.services.fs.list(root.id, { includeHidden: false, sort: "name" }))
        .filter((node) => node.kind === "directory" && !["System", "Apps"].includes(node.name))
        .map((node) => node.name),
    );
    expect(rootDirectories.has("Downloads")).toBe(false);

    // The current Explorer projection is path-hard-coded and includes legacy
    // Downloads/Documents/Pictures/Videos while omitting the actual current
    // root inventory. A Favorites projection must derive from the accepted
    // managed/root authority instead of displaying nonexistent defaults.
    const resolvedFavoriteNames = (await Promise.all(currentFavoritesProjection.map((path) => environment.node(path))))
      .filter((node): node is NonNullable<typeof node> => Boolean(node))
      .map((node) => node.name);
    expect(new Set(resolvedFavoriteNames)).toEqual(rootDirectories);
    expect(resolvedFavoriteNames).not.toContain("Downloads");
  } finally {
    environment.dispose();
  }
});
