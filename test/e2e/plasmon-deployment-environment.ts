import { access, readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

export const PLASMON_LOCAL_MANIFEST = "plasmon-local.ndeploy.json";
export const PLASMON_DEMO_MANIFEST = "plasmon.ndeploy.json";

export type PlasmonDeploymentScope = "local" | "demo";

interface InlineArtifact {
  path: string;
}

interface PlasmonDeploymentManifest {
  artifacts: {
    kind: "inline";
    kernel: InlineArtifact;
    packages: InlineArtifact[];
  };
}

interface WorkspacePackageJson {
  name?: string;
  scripts?: Record<string, string>;
}

export interface DeploymentArtifact {
  archivePath: string;
  workspace: string;
  workspaceDirectory: string;
}

export type ProvisionAction = "serve" | "reinstall" | "status";

export interface DeploymentEnvironmentOptions {
  repoRoot?: string;
  manifestPath?: string;
}

export function manifestForPlasmonDeployment(scope: PlasmonDeploymentScope): string {
  switch (scope) {
    case "local":
      return PLASMON_LOCAL_MANIFEST;
    case "demo":
      return PLASMON_DEMO_MANIFEST;
  }
}

function repositoryRoot(): string {
  return resolve(import.meta.dir, "../..");
}

function assertRepositoryPath(repoRoot: string, candidate: string, label: string): string {
  const absolute = resolve(repoRoot, candidate);
  const rel = relative(repoRoot, absolute);
  if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    throw new Error(`${label} must stay within the repository: ${candidate}`);
  }
  return absolute;
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export async function resolveDeploymentArtifacts(
  options: DeploymentEnvironmentOptions = {},
): Promise<DeploymentArtifact[]> {
  const repoRoot = resolve(options.repoRoot ?? repositoryRoot());
  const manifestPath = options.manifestPath;
  if (!manifestPath) {
    throw new Error("Deployment manifest must be selected explicitly");
  }
  const manifestFile = assertRepositoryPath(repoRoot, manifestPath, "Deployment manifest");
  const manifest = await readJson<PlasmonDeploymentManifest>(manifestFile);

  if (manifest.artifacts?.kind !== "inline") {
    throw new Error("Plasmon deployment preparation requires an inline deployment artifact manifest");
  }

  const artifactPaths = [
    manifest.artifacts.kernel?.path,
    ...(manifest.artifacts.packages ?? []).map((artifact) => artifact.path),
  ];
  if (artifactPaths.some((path) => typeof path !== "string" || !path.trim())) {
    throw new Error("Plasmon deployment contains an artifact without a path");
  }

  const artifacts: DeploymentArtifact[] = [];
  for (const archivePath of artifactPaths) {
    const archiveFile = assertRepositoryPath(repoRoot, archivePath, "Deployment artifact");
    const workspaceDirectory = dirname(archiveFile);
    const packageJson = await readJson<WorkspacePackageJson>(resolve(workspaceDirectory, "package.json"));
    const workspace = packageJson.name?.trim();
    if (!workspace) {
      throw new Error(`Deployment artifact workspace has no package name: ${archivePath}`);
    }
    if (!packageJson.scripts?.package) {
      throw new Error(`Deployment artifact workspace has no production package command: ${workspace}`);
    }
    artifacts.push({
      archivePath,
      workspace,
      workspaceDirectory,
    });
  }

  return artifacts;
}

export function workspacesToPackage(artifacts: readonly DeploymentArtifact[]): string[] {
  return [...new Set(artifacts.map((artifact) => artifact.workspace))];
}

async function runCommand(command: string[], cwd: string): Promise<void> {
  const child = Bun.spawn(command, {
    cwd,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) {
    throw new Error(`Command failed (${exitCode}): ${command.join(" ")}`);
  }
}

export async function verifyDeploymentArchives(
  artifacts: readonly DeploymentArtifact[],
  options: DeploymentEnvironmentOptions = {},
): Promise<void> {
  const repoRoot = resolve(options.repoRoot ?? repositoryRoot());
  for (const artifact of artifacts) {
    const archiveFile = assertRepositoryPath(repoRoot, artifact.archivePath, "Deployment artifact");
    try {
      await access(archiveFile);
    } catch {
      throw new Error(`Required Plasmon deployment archive was not produced: ${artifact.archivePath}`);
    }
  }
}

export async function prepareDeploymentEnvironment(
  options: DeploymentEnvironmentOptions,
): Promise<DeploymentArtifact[]> {
  const repoRoot = resolve(options.repoRoot ?? repositoryRoot());
  const artifacts = await resolveDeploymentArtifacts({ ...options, repoRoot });
  for (const workspace of workspacesToPackage(artifacts)) {
    await runCommand(["npm", "--workspace", workspace, "run", "package"], repoRoot);
  }
  await verifyDeploymentArchives(artifacts, { ...options, repoRoot });
  return artifacts;
}

export async function provisionDeploymentEnvironment(
  action: ProvisionAction,
  options: DeploymentEnvironmentOptions,
): Promise<void> {
  const repoRoot = resolve(options.repoRoot ?? repositoryRoot());
  const manifestPath = options.manifestPath;
  if (!manifestPath) {
    throw new Error("Deployment manifest must be selected explicitly");
  }
  assertRepositoryPath(repoRoot, manifestPath, "Deployment manifest");

  if (action !== "status") {
    const artifacts = await resolveDeploymentArtifacts({ ...options, repoRoot });
    await verifyDeploymentArchives(artifacts, { ...options, repoRoot });
  }

  await runCommand(["npm", "run", "provision", "--", manifestPath, action], repoRoot);
}

async function main(): Promise<void> {
  const scope = process.argv[2] as PlasmonDeploymentScope | undefined;
  const command = process.argv[3];
  if (scope !== "local" && scope !== "demo") {
    throw new Error("Usage: bun test/e2e/plasmon-deployment-environment.ts <local|demo> <prepare|serve|reinstall|status>");
  }
  const manifestPath = manifestForPlasmonDeployment(scope);
  switch (command) {
    case "prepare":
      await prepareDeploymentEnvironment({ manifestPath });
      return;
    case "serve":
    case "reinstall":
    case "status":
      await provisionDeploymentEnvironment(command, { manifestPath });
      return;
    default:
      throw new Error("Usage: bun test/e2e/plasmon-deployment-environment.ts <local|demo> <prepare|serve|reinstall|status>");
  }
}

if (import.meta.main) {
  await main();
}
