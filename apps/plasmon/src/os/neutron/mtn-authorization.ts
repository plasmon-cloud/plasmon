import type {
  IssueResourceGrantRequest,
  IssuedResourceGrant,
  RedeemResourceGrantRequest,
  ResourceAuthorization,
  ResourceAuthorizationService,
  ResourceGrantSummary,
} from "../contracts/authorization.ts";

export const MTN_0_2_ACCEPTED_SHA =
  "13a412f40bc0c3571c43bcfb8f0e2133b35ffc3a" as const;

/** Public Kernel actor methods shipped by accepted MTN 0.2. */
export const MTN_AUTHORIZATION_PUBLIC_METHODS = {
  capabilities: "kernel_authorization_capabilities",
  inspect: "kernel_authorization_inspect",
  redeem: "kernel_authorization_redeem",
} as const;

/** Methods on the compiler-delivered AuthorizationV1 exact-AppScope capability. */
export const MTN_AUTHORIZATION_BOUND_CAPABILITY_METHODS = [
  "issue",
  "list",
  "revoke",
  "rotate_resource",
  "register_provider",
  "call",
  "delegate",
  "release",
] as const;

export const MTN_AUTHORIZATION_REQUIRED_OPERATIONS = [
  "authorization.issue",
  "authorization.list",
  "authorization.inspect",
  "authorization.redeem",
  "authorization.revoke",
] as const;

export const MTN_AUTHORIZATION_REQUIRED_RIGHTS = [
  "read",
  "write",
  "reshare",
] as const;

/**
 * These are reconciliation blockers, not alternate authorization policy.
 * Coordinator A must resolve them before production MTN authorization can be
 * exposed through the frozen Plasmon ResourceAuthorizationService.
 */
export const MTN_RESOURCE_AUTHORIZATION_BLOCKERS = [
  "resource_ref_revision",
  "redeem_consumer_scope",
  "issuer_backend_capability_transport",
  "safe_inspection_shape",
] as const;

export type MtnResourceAuthorizationBlocker =
  (typeof MTN_RESOURCE_AUTHORIZATION_BLOCKERS)[number];

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringSet(value: unknown): Set<string> | null {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    return null;
  }
  return new Set(value);
}

/**
 * Generic MTN capability detection. This intentionally keys only on the
 * accepted operation/right surface; it never sniffs a product or release name.
 */
export function supportsMtnAuthorizationDiscovery(value: unknown): boolean {
  const root = record(value);
  const operations = stringSet(root?.operations);
  const rights = stringSet(root?.rights);
  if (!operations || !rights) return false;

  return MTN_AUTHORIZATION_REQUIRED_OPERATIONS.every((operation) =>
    operations.has(operation)
  ) && MTN_AUTHORIZATION_REQUIRED_RIGHTS.every((right) => rights.has(right));
}

export class MtnAuthorizationUnavailableError extends Error {
  readonly code = "MTN_AUTHORIZATION_UNAVAILABLE" as const;
  readonly blockers: readonly MtnResourceAuthorizationBlocker[];

  constructor(
    blockers: readonly MtnResourceAuthorizationBlocker[] =
      MTN_RESOURCE_AUTHORIZATION_BLOCKERS,
  ) {
    super(
      "MTN 0.2 authorization is present, but the frozen Plasmon ResourceAuthorizationService cannot be safely bound to the accepted MTN surface without contract/integration reconciliation.",
    );
    this.name = "MtnAuthorizationUnavailableError";
    this.blockers = [...blockers];
  }
}

/**
 * Fail-closed boundary until Coordinator A reconciles the frozen Plasmon
 * authorization contract and supplies an exact-AppScope MTN transport.
 *
 * This service deliberately mirrors no grant, lease, token, ownership,
 * liveness, resource-epoch, provider-registration, or revocation state.
 */
export class BlockedMtnResourceAuthorizationService
  implements ResourceAuthorizationService
{
  readonly available = false;

  async issue(_request: IssueResourceGrantRequest): Promise<IssuedResourceGrant> {
    throw new MtnAuthorizationUnavailableError();
  }

  async inspect(_grantId: string): Promise<ResourceGrantSummary> {
    throw new MtnAuthorizationUnavailableError();
  }

  async redeem(
    _request: RedeemResourceGrantRequest,
  ): Promise<ResourceAuthorization> {
    throw new MtnAuthorizationUnavailableError();
  }

  async revoke(_grantId: string): Promise<void> {
    throw new MtnAuthorizationUnavailableError();
  }
}
