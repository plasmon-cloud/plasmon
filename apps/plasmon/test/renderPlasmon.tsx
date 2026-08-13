import { render, waitFor, type RenderResult } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { PlasmonOS } from "../src/os/PlasmonOS.tsx";
import {
  createHeadlessPlasmonEnvironment,
  type HeadlessPlasmonEnvironment,
  type HeadlessPlasmonEnvironmentOptions,
} from "./headlessEnvironment.ts";

export type RenderedPlasmon = RenderResult & {
  readonly environment: HeadlessPlasmonEnvironment;
  readonly user: UserEvent;
  dispose(): void;
};

/**
 * Render the production Plasmon root against the canonical deterministic OS
 * composition. RTL/user-event are adapters around the real services; they do
 * not replace filesystem, association, opening, process, or window policy.
 */
export async function renderPlasmon(
  options: HeadlessPlasmonEnvironmentOptions = {},
): Promise<RenderedPlasmon> {
  const environment = createHeadlessPlasmonEnvironment(options);
  await environment.ready;

  const view = render(<PlasmonOS services={environment.services} />);
  await waitFor(() => {
    const shell = view.container.querySelector(".plasmon-shell");
    if (!shell || shell.getAttribute("aria-busy") !== "false") {
      throw new Error("Plasmon Shell did not finish its initial adapter state load");
    }
  });

  const user = userEvent.setup({ document: window.document });
  let disposed = false;

  return Object.assign(view, {
    environment,
    user,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      view.unmount();
      environment.dispose();
    },
  });
}
