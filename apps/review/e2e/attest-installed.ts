import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "fflate";
import { unpackNeutronPackage } from "../../../packages/neutron-compiler/src/install.ts";
import { resolveLocalNeutronRuntime } from "neutron-provision/src/local_session.ts";
import { packageArchiveFilename } from "neutron-tools/src/package_archive.js";
import { localCanisterOrigin } from "neutron-tools/src/runtime.js";

const appRoot = fileURLToPath(new URL("..", import.meta.url));
const deploymentConfig =
  process.env.NEUTRON_NDEPLOY_CONFIG ??
  fileURLToPath(new URL("../../../review-local.ndeploy.json", import.meta.url));
const expectedAssets = ["main.js", "service.js"] as const;

async function main(): Promise<void> {
  const sourceManifest = JSON.parse(
    await readFile(resolve(appRoot, "neutron.json"), "utf8"),
  ) as { id?: unknown; version?: unknown };
  if (sourceManifest.id !== "review" || !Number.isInteger(sourceManifest.version)) {
    throw new Error("Review neutron.json must declare id review and an integer version");
  }

  const archivePath = process.env.NEUTRON_REVIEW_PACKAGE
    ? resolve(process.cwd(), process.env.NEUTRON_REVIEW_PACKAGE)
    : resolve(
        appRoot,
        packageArchiveFilename("review", sourceManifest.version as number),
      );
  const archive = new Uint8Array(await readFile(archivePath));
  const unpacked = unpackNeutronPackage(archive);
  const packagedManifestBytes = unpacked["neutron.json"];
  if (!packagedManifestBytes) {
    throw new Error(`${archivePath} does not contain neutron.json`);
  }
  const packagedManifest = JSON.parse(
    new TextDecoder().decode(packagedManifestBytes),
  ) as { id?: unknown; version?: unknown };
  if (
    packagedManifest.id !== sourceManifest.id ||
    packagedManifest.version !== sourceManifest.version
  ) {
    throw new Error(
      `Package manifest ${String(packagedManifest.id)} v${String(packagedManifest.version)} does not match source ${String(sourceManifest.id)} v${String(sourceManifest.version)}`,
    );
  }

  const origin = installedOrigin();
  const verified: Array<{ asset: string; bytes: number; sha256: string }> = [];
  for (const asset of expectedAssets) {
    const expected = unpacked[`web/${asset}`];
    if (!expected) {
      throw new Error(`${basename(archivePath)} does not contain web/${asset}`);
    }
    const requested = new URL(`/app/review/${asset}`, `${origin}/`);
    const response = await fetch(requested, {
      cache: "no-store",
      headers: { "cache-control": "no-cache" },
    });
    if (!response.ok) {
      throw new Error(
        `Installed ${asset} returned HTTP ${response.status} ${response.statusText} from ${response.url || requested.href}`,
      );
    }
    const contentType = response.headers.get("content-type") ?? "";
    const contentEncoding = response.headers.get("content-encoding") ?? "";
    const receivedBody = new Uint8Array(await response.arrayBuffer());
    const received = isGzip(receivedBody) ? gunzipSync(receivedBody) : receivedBody;
    const expectedHash = sha256(expected);
    const receivedHash = sha256(received);
    if (received.byteLength !== expected.byteLength || receivedHash !== expectedHash) {
      throw new Error(
        `Installed ${asset} mismatch from ${response.url || requested.href}: expected ${expected.byteLength} bytes sha256 ${expectedHash}; received body ${receivedBody.byteLength} bytes, decoded ${received.byteLength} bytes sha256 ${receivedHash}; content-type=${contentType || "(missing)"}; content-encoding=${contentEncoding || "(missing)"}`,
      );
    }
    verified.push({ asset, bytes: received.byteLength, sha256: receivedHash });
  }

  console.log(`Attested installed Review at ${origin}`);
  console.log(`Package ${basename(archivePath)} sha256 ${sha256(archive)}`);
  for (const asset of verified) {
    console.log(`${asset.asset} ${asset.bytes} bytes sha256 ${asset.sha256}`);
  }
}

function installedOrigin(): string {
  const runtime = resolveLocalNeutronRuntime({ configPath: deploymentConfig });
  return localCanisterOrigin(runtime.canisterId, runtime.gatewayUrl);
}

function isGzip(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function githubEscape(value: string): string {
  return value
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A");
}

await main().catch((error: unknown) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error(detail);
  if (process.env.GITHUB_ACTIONS === "true") {
    console.error(`::error title=Review installed-byte attestation::${githubEscape(detail)}`);
  }
  process.exitCode = 1;
});
