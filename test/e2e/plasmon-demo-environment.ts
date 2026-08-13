import { access, readFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";

export const DEFAULT_PLASMON_DEMO_MANIFEST = "plasmon-local.ndeploy.json";

interface InlineArtifact {
  path: string;
}

interface PlasmonDemoDeploymentManifest {
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

export interface DemoArtifact {
  archivePath: string;
  workspace: string;
  workspaceDirectory: string;
}

export type DemoProvisionAction = "serve" | "reinstall" | "status";

export interface DemoEnvironmentOptions {
  repoRoot?: string;
  manifestPath?: string;
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

export async function resolveDemoArtifacts(
  options: DemoEnvironmentOptions = {},
): Promise<DemoArtifact[]> {
  const repoRoot = resolve(options.repoRoot ?? repositoryRoot());
  const manifestPath = options.manifestPath ?? DEFAULT_PLASMON_DEMO_MANIFEST;
  const manifestFile = assertRepositoryPath(repoRoot, manifestPath, "Deployment manifest");
  const manifest = await readJson<PlasmonDemoDeploymentManifest>(manifestFile);

  if (manifest.artifacts?.kind !== "inline") {
    throw new Error("Plasmon demo preparation requires an inline deployment artifact manifest");
  }

  const artifactPaths = [
    manifest.artifacts.kernel?.path,
    ...(manifest.artifacts.packages ?? []).map((artifact) => artifact.path),
  ];
  if (artifactPaths.some((path) => typeof path !== "string" || !path.trim())) {
    throw new Error("Plasmon demo deployment contains an artifact without a path");
  }

  const artifacts: DemoArtifact[] = [];
  const seenWorkspaces = new Set<string>();
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
    if (seenWorkspaces.has(workspace)) continue;
    seenWorkspaces.add(workspace);
    artifacts.push({
      archivePath,
      workspace,
      workspaceDirectory,
    });
  }

  return artifacts;
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

export async function verifyDemoArchives(
  artifacts: readonly DemoArtifact[],
  options: DemoEnvironmentOptions = {},
): Promise<void> {
  const repoRoot = resolve(options.repoRoot ?? repositoryRoot());
  for (const artifact of artifacts) {
    const archiveFile = assertRepositoryPath(repoRoot, artifact.archivePath, "Deployment artifact");
    try {
      await access(archiveFile);
    } catch {
      throw new Error(`Required Plasmon demo archive was not produced: ${artifact.archivePath}`);
    }
  }
}

export async function prepareDemoEnvironment(
  options: DemoEnvironmentOptions = {},
): Promise<DemoArtifact[]> {
  const repoRoot = resolve(options.repoRoot ?? repositoryRoot());
  const artifacts = await resolveDemoArtifacts({ ...options, repoRoot });
  for (const artifact of artifacts) {
    await runCommand(["npm", "--workspace", artifact.workspace, "run", "package"], repoRoot);
  }
  await verifyDemoArchives(artifacts, { ...options, repoRoot });
  return artifacts;
}

export async function provisionDemoEnvironment(
  action: DemoProvisionAction,
  options: DemoEnvironmentOptions = {},
): Promise<void> {
  const repoRoot = resolve(options.repoRoot ?? repositoryRoot());
  const manifestPath = options.manifestPath ?? DEFAULT_PLASMON_DEMO_MANIFEST;
  assertRepositoryPath(repoRoot, manifestPath, "Deployment manifest");

  if (action !== "status") {
    const artifacts = await resolveDemoArtifacts({ ...options, repoRoot });
    await verifyDemoArchives(artifacts, { ...options, repoRoot });
  }

  await runCommand(["npm", "run", "provision", "--", manifestPath, action], repoRoot);
}

async function main(): Promise<void> {
  const command = process.argv[2];
  switch (command) {
    case "prepare":
      await prepareDemoEnvironment();
      return;
    case "serve":
    case "reinstall":
    case "status":
      await provisionDemoEnvironment(command);
      return;
    default:
      throw new Error("Usage: bun test/e2e/plasmon-demo-environment.ts <prepare|serve|reinstall|status>");
  }
}

if (import.meta.main) {
  await main();
}
