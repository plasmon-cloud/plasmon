import { expect, test } from "bun:test";
import { act, waitFor, within } from "@testing-library/react";
import { renderPlasmon } from "../renderPlasmon.tsx";

test("File Explorer Favorites use shared themed icons and canonical Apps navigation", async () => {
  const app = await renderPlasmon();
  try {
    const apps = await app.environment.os.fs.stat("/Apps");
    await act(async () => {
      await app.environment.os.open("/Documents");
    });

    const explorer = await app.findByRole("region", { name: "File Explorer" });
    const favorites = within(explorer).getByRole("complementary", { name: "Favorites" });
    const favoriteView = within(favorites);
    const documentsButton = favoriteView.getByRole("button", { name: "Documents" });
    const appsButton = favoriteView.getByRole("button", { name: "Apps" });

    expect(documentsButton.querySelector('[data-plasmon-owned-icon="folder"]')).not.toBeNull();
    expect(appsButton.querySelector('[data-plasmon-owned-icon="application"]')).not.toBeNull();
    expect(favoriteView.queryByText("▰")).toBeNull();
    expect(documentsButton.getAttribute("aria-current")).toBe("page");
    expect(appsButton.getAttribute("aria-current")).toBeNull();
    expect(apps.id).toBeDefined();

    await app.user.click(appsButton);

    await waitFor(() => {
      const address = within(explorer).getByRole("textbox", { name: "Address" }) as HTMLInputElement;
      expect(address.value).toBe("/Apps");
      expect(appsButton.getAttribute("aria-current")).toBe("page");
    });
  } finally {
    app.dispose();
  }
});
