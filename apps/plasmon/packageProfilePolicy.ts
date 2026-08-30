export const PACKAGE_PROFILES = ["slim", "full", "demo"] as const;
export type PackageProfile = (typeof PACKAGE_PROFILES)[number];
export type MonacoPackageProfile = "slim" | "full";

// Keep the existing default until #527 deliberately changes ordinary product
// packaging to the Base composition. Slim is the permanent constrained package
// contract; it is not event- or release-specific.
export const DEFAULT_PACKAGE_PROFILE: PackageProfile = "slim";

export interface PackageProfilePolicy {
  readonly requestedProfile: PackageProfile;
  readonly isSlim: boolean;
  readonly isDemo: boolean;
  readonly monacoProfile: MonacoPackageProfile;
}

function isPackageProfile(value: string): value is PackageProfile {
  return (PACKAGE_PROFILES as readonly string[]).includes(value);
}

export function resolvePackageProfile(value = process.env.PLASMON_PACKAGE_PROFILE): PackageProfilePolicy {
  const requestedProfile = value ?? DEFAULT_PACKAGE_PROFILE;
  if (!isPackageProfile(requestedProfile)) {
    throw new Error(
      `Invalid PLASMON_PACKAGE_PROFILE "${requestedProfile}". Expected one of: ${PACKAGE_PROFILES.join(", ")}.`,
    );
  }

  const isSlim = requestedProfile === "slim";
  const isDemo = requestedProfile === "demo";
  const monacoProfile: MonacoPackageProfile = requestedProfile === "full" ? "full" : "slim";

  return Object.freeze({
    requestedProfile,
    isSlim,
    isDemo,
    monacoProfile,
  });
}
