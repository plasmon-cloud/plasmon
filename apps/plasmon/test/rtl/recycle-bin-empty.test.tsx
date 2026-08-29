import { expect, test } from "bun:test";
import { act, waitFor, within } from "@testing-library/react";
import { renderPlasmon } from "../renderPlasmon.tsx";

test("non-empty Recycle Bin confirms in-app and empties canonical Trash", async () => {
  const app = await renderPlasmon();
  const originalConfirm = window.confirm;
  try {
    // The installed Neutron sandbox must not need browser modal permission for
    // destructive Recycle Bin actions. The pre-fix adapter called this path.
    window.confirm = () => {
      throw new Error("Recycle Bin must not depend on window.confirm");
    };

    let sourceId = "";
    await act(async () => {
      const documents = await app.environment.node("/Documents");
      if (!documents || documents.kind !== "directory") {
        throw new Error("Documents directory is unavailable");
      }
      const source = await app.environment.services.fs.createFile(
        documents.id,
        "empty-from-recycle-bin.txt",
        { mime: "text/plain" },
      );
      sourceId = source.id;
      await app.environment.services.filesystem.trash.trash(source.id);
      await app.environment.services.process.open("native:recycle-bin", {});
    });

    await app.findByText("empty-from-recycle-bin.txt");
    const emptyButton = await app.findByRole("button", { name: "Empty Recycle Bin" });
    expect(emptyButton.hasAttribute("disabled")).toBe(false);

    await app.user.click(emptyButton);
    const confirmation = await app.findByRole("alertdialog", { name: "Empty Recycle Bin?" });
    expect(confirmation.textContent).toContain("Permanently delete all 1 item in Recycle Bin?");
    expect((await app.environment.services.filesystem.trash.list()).map((entry) => entry.node.id)).toContain(sourceId);

    await app.user.click(within(confirmation).getByRole("button", { name: "Confirm Empty Recycle Bin" }));

    await waitFor(async () => {
      const entries = await app.environment.services.filesystem.trash.list();
      if (entries.length !== 0) throw new Error(`Trash still contains ${entries.length} item(s)`);
    });
    expect((await app.findByText("Recycle Bin is empty.")).textContent).toBe("Recycle Bin is empty.");
    await expect(app.environment.services.fs.stat(sourceId)).rejects.toThrow();
  } finally {
    window.confirm = originalConfirm;
    app.dispose();
  }
});

test("selected permanent delete confirms in-app and cancellation is non-destructive", async () => {
  const app = await renderPlasmon();
  const originalConfirm = window.confirm;
  try {
    window.confirm = () => {
      throw new Error("Recycle Bin must not depend on window.confirm");
    };

    let sourceId = "";
    await act(async () => {
      const documents = await app.environment.node("/Documents");
      if (!documents || documents.kind !== "directory") {
        throw new Error("Documents directory is unavailable");
      }
      const source = await app.environment.services.fs.createFile(
        documents.id,
        "permanent-delete-from-recycle-bin.txt",
        { mime: "text/plain" },
      );
      sourceId = source.id;
      await app.environment.services.filesystem.trash.trash(source.id);
      await app.environment.services.process.open("native:recycle-bin", {});
    });

    await app.findByText("permanent-delete-from-recycle-bin.txt");
    await app.user.click(
      await app.findByRole("checkbox", { name: "Select permanent-delete-from-recycle-bin.txt" }),
    );

    const deleteButton = await app.findByRole("button", { name: "Delete permanently (1)" });
    expect(deleteButton.hasAttribute("disabled")).toBe(false);

    await app.user.click(deleteButton);
    let confirmation = await app.findByRole("alertdialog", { name: "Delete permanently?" });
    expect(confirmation.textContent).toContain("Permanently delete 1 item? This cannot be undone.");

    await app.user.click(within(confirmation).getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      if (app.queryByRole("alertdialog", { name: "Delete permanently?" })) {
        throw new Error("Permanent-delete confirmation is still open after cancellation");
      }
    });
    expect((await app.environment.services.filesystem.trash.list()).map((entry) => entry.node.id)).toContain(sourceId);
    expect((await app.environment.services.fs.stat(sourceId)).id).toBe(sourceId);
    expect((await app.findByText("permanent-delete-from-recycle-bin.txt")).textContent).toBe(
      "permanent-delete-from-recycle-bin.txt",
    );

    await app.user.click(await app.findByRole("button", { name: "Delete permanently (1)" }));
    confirmation = await app.findByRole("alertdialog", { name: "Delete permanently?" });
    await app.user.click(within(confirmation).getByRole("button", { name: "Confirm permanent delete" }));

    await waitFor(async () => {
      const entries = await app.environment.services.filesystem.trash.list();
      if (entries.some((entry) => entry.node.id === sourceId)) {
        throw new Error("Permanently deleted Trash entry is still present");
      }
    });
    await expect(app.environment.services.fs.stat(sourceId)).rejects.toThrow();
    expect((await app.findByText("Recycle Bin is empty.")).textContent).toBe("Recycle Bin is empty.");
  } finally {
    window.confirm = originalConfirm;
    app.dispose();
  }
});
