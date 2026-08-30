import { createRoot } from "react-dom/client";
import {
  createDemoSeeds,
  reconcileDemoDesktopShortcuts,
} from "./demo/demoContent.ts";
import { installAppIconFallbacks } from "./iconFallback.ts";
import { PlasmonOS } from "./os/PlasmonOS.tsx";
import { createPlasmonServices } from "./os/integration/services.ts";
import { isDemoProfile } from "./os/integration/packageProfile.ts";
import "./style.scss";
import "./os/integration/visual-tokens.scss";
import "./os/integration/theme-graphite.scss";

// Replaced by esbuild for packaged builds. Unbundled/test execution defaults to
// local-only diagnostics and never imports the experimental remote capability.
// @ts-expect-error build-time define
const REMOTE_INCIDENT_EXPERIMENT = typeof __PLASMON_REMOTE_INCIDENT_EXPERIMENT__ === "undefined"
  ? false
  : __PLASMON_REMOTE_INCIDENT_EXPERIMENT__;

installAppIconFallbacks();

const container = document.getElementById("root");
if (!container) throw new Error("Root element not found");

async function start(): Promise<void> {
  const demoSeeds = isDemoProfile ? createDemoSeeds() : [];
  const services = createPlasmonServices({ ...(demoSeeds.length > 0 ? { demoSeeds } : {}) });
  if (REMOTE_INCIDENT_EXPERIMENT) {
    const {
      attachConfiguredRemoteIncidentExperiment,
      installRemoteIncidentSyntheticProbe,
    } = await import("./os/diagnostics/remote/configured.ts");
    attachConfiguredRemoteIncidentExperiment(services.diagnostics);
    installRemoteIncidentSyntheticProbe(services.diagnostics);
  }
  if (isDemoProfile) {
    await services.filesystem.ready;
    await reconcileDemoDesktopShortcuts(services.fs);
  }
  services.startMenu.start();
  createRoot(container).render(<PlasmonOS services={services} />);
}

void start().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  container.textContent = `Plasmon failed to start: ${message}`;
  throw error;
});