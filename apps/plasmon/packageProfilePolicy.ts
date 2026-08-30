export const PACKAGE_PROFILES = ["slim", "base"] as const;
export type PackageProfile = (typeof PACKAGE_PROFILES)[number];
export type MonacoPackageProfile = "slim" | "base";

export const DEFAULT_PACKAGE_PROFILE: PackageProfile = "base";

export interface PackageProfilePolicy {
  readonly requestedProfile: PackageProfile;
  readonly packageTier: PackageProfile;
  readonly isSlim: boolean;
  readonly demoOverlay: boolean;
  readonly isDemo: boolean;
  readonly monacoProfile: MonacoPackageProfile;
}

function isPackageProfile(value: string): value is PackageProfile {
  return (PACKAGE_PROFILES as readonly string[]).includes(value);
}

function resolveDemoOverlay(value: string | undefined): boolean {
  if (value === undefined || value === "" || value === "0" || value === "false") return false;
  if (value === "1" || value === "true") return true;
  throw new Error(
    `Invalid PLASMON_DEMO_OVERLAY "${value}". Expected one of: 0, 1, false, true.`,
  );
}

export function resolvePackageProfile(
  value = process.env.PLASMON_PACKAGE_PROFILE,
  demoOverlayValue = process.env.PLASMON_DEMO_OVERLAY,
): PackageProfilePolicy {
  const requestedProfile = value ?? DEFAULT_PACKAGE_PROFILE;
  if (!isPackageProfile(requestedProfile)) {
    throw new Error(
      `Invalid PLASMON_PACKAGE_PROFILE "${requestedProfile}". Expected one of: ${PACKAGE_PROFILES.join(", ")}.`,
    );
  }

  const demoOverlay = resolveDemoOverlay(demoOverlayValue);
  if (requestedProfile === "slim" && demoOverlay) {
    throw new Error("PLASMON_DEMO_OVERLAY cannot be enabled for the Slim package tier.");
  }

  const isSlim = requestedProfile === "slim";
  const monacoProfile: MonacoPackageProfile = isSlim ? "slim" : "base";

  return Object.freeze({
    requestedProfile,
    packageTier: requestedProfile,
    isSlim,
    demoOverlay,
    // Temporary consumer compatibility while source call sites migrate from the
    // old profile-shaped name. Demo is no longer a package tier.
    isDemo: demoOverlay,
    monacoProfile,
  });
}
