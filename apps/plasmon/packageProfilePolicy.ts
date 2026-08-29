export const PACKAGE_PROFILES = ["hackathon", "slim", "full", "demo"] as const;
export type PackageProfile = (typeof PACKAGE_PROFILES)[number];
export type CanonicalPackageProfile = "hackathon" | "full" | "demo";
export type MonacoPackageProfile = "slim" | "full";

// Keep the existing default until the separately owned full/default restoration
// changes normal product packaging. `slim` is a compatibility spelling for the
// explicit Hackathon composition, not a second package contract.
export const DEFAULT_PACKAGE_PROFILE: PackageProfile = "slim";

export interface PackageProfilePolicy {
  readonly requestedProfile: PackageProfile;
  readonly canonicalProfile: CanonicalPackageProfile;
  readonly isHackathon: boolean;
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

  const canonicalProfile: CanonicalPackageProfile = requestedProfile === "slim"
    ? "hackathon"
    : requestedProfile;
  const isHackathon = canonicalProfile === "hackathon";
  const isDemo = canonicalProfile === "demo";
  const monacoProfile: MonacoPackageProfile = canonicalProfile === "full" ? "full" : "slim";

  return Object.freeze({
    requestedProfile,
    canonicalProfile,
    isHackathon,
    isDemo,
    monacoProfile,
  });
}
