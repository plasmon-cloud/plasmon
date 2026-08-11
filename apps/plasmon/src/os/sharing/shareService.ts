import type { NodeId, ShareId } from "../contracts/common.ts";
import type { FsNode } from "../contracts/fs.ts";
import type { ResourceAuthorizationService, ResourceRight } from "../contracts/authorization.ts";
import type {
  CreatedShare,
  ShareOptions,
  ShareRecord,
  ShareService,
  SharedResourceProvider,
} from "../contracts/sharing.ts";

const DEFAULT_SHARE_RIGHTS = ["read"] as const satisfies readonly ResourceRight[];

/**
 * The current frozen ResourceAuthorizationService can issue/revoke grants but
 * cannot express MTN 0.2's lease-bound provider call path. Import therefore
 * fails closed until Coordinator A reconciles that contract with Agent 8.
 */
export class SharingAuthorizationContractMismatchError extends Error {
  constructor() {
    super(
      "ResourceAuthorizationService cannot express MTN 0.2 lease-bound provider access: " +
      "redeem() exposes no lease/provider/consumer scope and the service has no authorized call/register-provider operation",
    );
    this.name = "SharingAuthorizationContractMismatchError";
  }
}

export class SharingAuthorizationUnavailableError extends Error {
  constructor() {
    super("Resource authorization service is unavailable");
    this.name = "SharingAuthorizationUnavailableError";
  }
}

export interface ResourceAuthorizedShareServiceOptions {
  now?: () => number;
}

/**
 * High-level Sharing orchestration that consumes only the frozen Plasmon
 * ResourceAuthorizationService abstraction. It does not persist bearer tokens,
 * grants, ownership, liveness, leases, authorization epochs, or AppScope state.
 *
 * ShareId intentionally equals the authorization provider's non-secret grantId,
 * allowing revoke() to delegate directly without a parallel share->grant
 * authority database. ShareRecord.url is likewise token-free; callers receive
 * the one-time bearer value only through CreatedShare.grant.token.
 */
export class ResourceAuthorizedShareService implements ShareService {
  private readonly provider: SharedResourceProvider;
  private readonly authorization: ResourceAuthorizationService;
  private readonly now: () => number;

  constructor(
    provider: SharedResourceProvider,
    authorization: ResourceAuthorizationService,
    options: ResourceAuthorizedShareServiceOptions = {},
  ) {
    this.provider = provider;
    this.authorization = authorization;
    this.now = options.now ?? Date.now;
  }

  private requireAuthorization(): void {
    if (!this.authorization.available) throw new SharingAuthorizationUnavailableError();
  }

  async share(
    nodeId: NodeId,
    options: ShareOptions = { mode: "snapshot" },
  ): Promise<CreatedShare> {
    this.requireAuthorization();

    const published = await this.provider.publish(nodeId, { mode: "snapshot" });
    const rights = options.rights ?? DEFAULT_SHARE_RIGHTS;
    const grant = await this.authorization.issue({
      resource: published.resource,
      rights,
      ...(options.audience !== undefined ? { audience: options.audience } : {}),
      ...(options.expiresAt !== undefined ? { expiresAt: options.expiresAt } : {}),
    });

    const id: ShareId = grant.grantId;
    const record: ShareRecord = {
      id,
      nodeId,
      resource: published.resource,
      grantId: grant.grantId,
      // Deliberately excludes the bearer token. UI/integration may combine the
      // non-secret locator and one-time token transiently, but must not persist it.
      url: `plasmon://share/${encodeURIComponent(grant.grantId)}`,
      createdAt: this.now(),
    };

    return { record, grant };
  }

  async revoke(id: ShareId): Promise<void> {
    this.requireAuthorization();
    await this.authorization.revoke(id);
  }

  async importShare(_token: string, _destination: NodeId): Promise<FsNode> {
    this.requireAuthorization();
    // Do not redeem a bearer token until the returned lease can actually be
    // consumed by an MTN-authorized provider call. Redeeming here and then
    // calling SharedResourceProvider.importResource(ResourceRef) directly would
    // create a stale-authorization TOCTOU and bypass MTN's call-time revalidation.
    throw new SharingAuthorizationContractMismatchError();
  }
}
