import { describe, expect, test } from "bun:test";
import {
  BlockedMtnResourceAuthorizationService,
  MTN_AUTHORIZATION_BOUND_CAPABILITY_METHODS,
  MTN_AUTHORIZATION_PUBLIC_METHODS,
  MTN_RESOURCE_AUTHORIZATION_BLOCKERS,
  MtnAuthorizationUnavailableError,
  supportsMtnAuthorizationDiscovery,
} from "./mtn-authorization.ts";

const acceptedDiscovery = {
  operations: [
    "authorization.issue",
    "authorization.list",
    "authorization.inspect",
    "authorization.redeem",
    "authorization.release",
    "authorization.revoke",
    "authorization.rotate_resource",
    "authorization.delegate",
    "authorization.call",
  ],
  rights: ["read", "write", "reshare"],
};

describe("accepted MTN 0.2 authorization surface", () => {
  test("detects authorization by generic operations and rights", () => {
    expect(supportsMtnAuthorizationDiscovery(acceptedDiscovery)).toBe(true);
  });

  test("fails closed when a ResourceAuthorizationService operation is missing", () => {
    expect(supportsMtnAuthorizationDiscovery({
      ...acceptedDiscovery,
      operations: acceptedDiscovery.operations.filter(
        (operation) => operation !== "authorization.redeem",
      ),
    })).toBe(false);
  });

  test("fails closed when the accepted rights surface is incomplete", () => {
    expect(supportsMtnAuthorizationDiscovery({
      operations: acceptedDiscovery.operations,
      rights: ["read", "write"],
    })).toBe(false);
  });

  test("does not use product or release string sniffing", () => {
    expect(supportsMtnAuthorizationDiscovery({
      product: "MTN 0.2.0",
      version: "0.2.0",
      operations: [],
      rights: [],
    })).toBe(false);
  });

  test("pins the accepted public versus exact-AppScope-bound method split", () => {
    expect(MTN_AUTHORIZATION_PUBLIC_METHODS).toEqual({
      capabilities: "kernel_authorization_capabilities",
      inspect: "kernel_authorization_inspect",
      redeem: "kernel_authorization_redeem",
    });
    expect(MTN_AUTHORIZATION_BOUND_CAPABILITY_METHODS).toEqual([
      "issue",
      "list",
      "revoke",
      "rotate_resource",
      "register_provider",
      "call",
      "delegate",
      "release",
    ]);
  });
});

describe("unreconciled Plasmon ResourceAuthorizationService", () => {
  test("stays unavailable and every authority-bearing method fails closed", async () => {
    const service = new BlockedMtnResourceAuthorizationService();
    const resource = {
      providerId: "plasmon-sharing",
      resourceId: "resource-1",
      revision: "1",
    };

    expect(service.available).toBe(false);

    for (const operation of [
      service.issue({ resource, rights: ["read"] }),
      service.inspect("grant-1"),
      service.redeem({ token: "mtn2_grant_secret" }),
      service.revoke("grant-1"),
    ]) {
      await expect(operation).rejects.toMatchObject({
        name: "MtnAuthorizationUnavailableError",
        code: "MTN_AUTHORIZATION_UNAVAILABLE",
        blockers: MTN_RESOURCE_AUTHORIZATION_BLOCKERS,
      });
    }
  });

  test("reports all known reconciliation blockers without shadow authorization state", () => {
    const error = new MtnAuthorizationUnavailableError();
    expect(error.blockers).toEqual([
      "resource_ref_revision",
      "redeem_consumer_scope",
      "issuer_backend_capability_transport",
      "safe_inspection_shape",
    ]);
  });
});
