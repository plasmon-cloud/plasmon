import type { JsonValue } from "../contracts/common.ts";
import type { ResourceRef } from "../contracts/authorization.ts";
import {
  InvalidPublishedResourceError,
  PLASMON_ATOM_NAMESPACE,
  PLASMON_FILE_NAMESPACE,
  SHARING_PROVIDER_ID,
  SHARING_PROVIDER_SCHEMA_VERSION,
  type ProviderResourceIdentity,
  type ProviderRevisionRecord,
} from "./model.ts";

const ALLOWED_NAMESPACES = new Set([PLASMON_ATOM_NAMESPACE, PLASMON_FILE_NAMESPACE]);

export interface ProviderResourceLocator {
  identity: ProviderResourceIdentity;
  resourceType: string;
  revision: string;
}

function getStringMetadata(metadata: Record<string, JsonValue> | undefined, key: string): string {
  const value = metadata?.[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new InvalidPublishedResourceError(`Published resource is missing ${key}`);
  }
  return value;
}

function validateResourceId(resourceId: string): void {
  if (!resourceId || resourceId.length > 512 || /[\u0000-\u001f\u007f]/.test(resourceId)) {
    throw new InvalidPublishedResourceError("Published resource ID is malformed");
  }
}

function validateRevision(revision: string): void {
  if (!/^[1-9][0-9]*$/.test(revision)) {
    throw new InvalidPublishedResourceError(`Published resource revision is malformed: ${revision}`);
  }
}

/**
 * CURRENT PLASMON CONTRACT BOUNDARY ONLY.
 *
 * ResourceRef predates the final MTN 0.2 wire API. Keep all translation here
 * so Agent 0 can replace this boundary after the MTN handoff without migrating
 * provider persistence.
 */
export function revisionToContractResourceRef(revision: ProviderRevisionRecord): ResourceRef {
  return {
    providerId: SHARING_PROVIDER_ID,
    resourceId: revision.identity.resourceId,
    revision: revision.revision,
    metadata: {
      namespace: revision.identity.namespace,
      resourceType: revision.resourceType,
      providerSchemaVersion: SHARING_PROVIDER_SCHEMA_VERSION,
    },
  };
}

export function contractResourceRefToLocator(resource: ResourceRef): ProviderResourceLocator {
  if (resource.providerId !== SHARING_PROVIDER_ID) {
    throw new InvalidPublishedResourceError(`Unknown shared-resource provider: ${resource.providerId}`);
  }
  validateResourceId(resource.resourceId);
  validateRevision(resource.revision);

  const namespace = getStringMetadata(resource.metadata, "namespace");
  if (!ALLOWED_NAMESPACES.has(namespace)) {
    throw new InvalidPublishedResourceError(`Unsupported shared-resource namespace: ${namespace}`);
  }

  const resourceType = getStringMetadata(resource.metadata, "resourceType");
  const schemaVersion = resource.metadata?.providerSchemaVersion;
  if (schemaVersion !== SHARING_PROVIDER_SCHEMA_VERSION) {
    throw new InvalidPublishedResourceError(`Unsupported shared-resource reference schema: ${String(schemaVersion)}`);
  }

  return {
    identity: { namespace, resourceId: resource.resourceId },
    resourceType,
    revision: resource.revision,
  };
}
