from pathlib import Path


def replace(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f"expected text not found in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new))


# Scripting consumes the canonical production OsApi from #607/#631.
replace(
    "apps/plasmon/src/scripting/command/runtime.ts",
    'import type { OsApi } from "../os-api/types.ts";',
    'import type { OsApi } from "../../os/api/index.ts";',
)
replace(
    "apps/plasmon/src/scripting/run/context.ts",
    'import type { OsApi } from "../os-api/types.ts";',
    'import type { OsApi } from "../../os/api/index.ts";',
)
replace(
    "apps/plasmon/src/scripting/service.ts",
    'import type { OsApi } from "./os-api/types.ts";',
    'import type { OsApi } from "../os/api/index.ts";',
)
replace(
    "apps/plasmon/src/scripting/index.ts",
    'export * from "./os-api/types.ts";\n',
    '',
)

# Canonical stat is nullable; command cd must treat missing resources explicitly.
replace(
    "apps/plasmon/src/scripting/command/runtime.ts",
    '          const target = await this.os.fs.stat(path);\n          if (target.kind !== "directory") return result(1, "", `cd: not a directory: ${path}\\n`);',
    '          const target = await this.os.fs.stat(path);\n          if (!target) return result(1, "", `cd: no such directory: ${path}\\n`);\n          if (target.kind !== "directory") return result(1, "", `cd: not a directory: ${path}\\n`);',
)

# Production composition: keep PlasmonServices canonical and compose scripting above it.
services_path = Path("apps/plasmon/src/os/integration/services.ts")
services = services_path.read_text()
services = services.replace(
    'import { createExperimentalPlasmonOsApi } from "./experimentalOsApi.ts";\nimport type { OsApi } from "../../scripting/os-api/types.ts";\n',
    'import { createPlasmonOsApi } from "../api/adapter.ts";\n',
)
services = services.replace(
    '  hiddenVisibility: HiddenVisibilityPreferenceStore;\n  os: OsApi;\n  scripting: ScriptingService;\n',
    '  hiddenVisibility: HiddenVisibilityPreferenceStore;\n',
)
old_bottom = '''  const fs = filesystem.fs;
  const os = createExperimentalPlasmonOsApi({ fs, filesystem, process, windows });
  const scripting = new ScriptingService({ os });
  nativeApps.setLoader(
    explorerAppDefinition.id,
    createExplorerNativeLoader({
      fsEvents: fs,
      associations,
      openService,
      openAuthority: fileManagerOpenAuthority,
      trashAuthority: fileManagerTrashAuthority,
      clipboard: fileClipboard,
      hiddenVisibility,
      transpileCmdFile: async (nodeId) => scripting.transpileCmdFile(await fs.pathOf(nodeId)),
    }),
  );
  if (!isCoreProfile) {
    nativeApps.setLoader(terminalAppDefinition.id, createTerminalNativeLoader({ scripting }));
  }
  nativeApps.setLoader(
    recycleBinAppDefinition.id,
    createRecycleBinNativeLoader({ trash: filesystem.trash, fsEvents: fs }),
  );
  const startMenu = new StartMenuReconciliationController(fs, nativeApps, neutron);

  return {
    fs,
    fsEvents: fs,
    filesystem,
    process,
    windows,
    windowPlacement,
    neutron,
    authorization: createAuthorizationService(),
    nativeApps,
    associations,
    openService,
    fileClipboard,
    startMenu,
    hiddenVisibility,
    os,
    scripting,
  };
'''
new_bottom = '''  const fs = filesystem.fs;
  const startMenu = new StartMenuReconciliationController(fs, nativeApps, neutron);
  const services: PlasmonServices = {
    fs,
    fsEvents: fs,
    filesystem,
    process,
    windows,
    windowPlacement,
    neutron,
    authorization: createAuthorizationService(),
    nativeApps,
    associations,
    openService,
    fileClipboard,
    startMenu,
    hiddenVisibility,
  };

  // Scripting consumes the same production OsApi contract exposed as env.os in
  // headless/RTL composition. RunContext and command behavior stay above OsApi.
  const scripting = new ScriptingService({ os: createPlasmonOsApi({ services }) });
  nativeApps.setLoader(
    explorerAppDefinition.id,
    createExplorerNativeLoader({
      fsEvents: fs,
      associations,
      openService,
      openAuthority: fileManagerOpenAuthority,
      trashAuthority: fileManagerTrashAuthority,
      clipboard: fileClipboard,
      hiddenVisibility,
      transpileCmdFile: async (nodeId) => scripting.transpileCmdFile(await fs.pathOf(nodeId)),
    }),
  );
  if (!isCoreProfile) {
    nativeApps.setLoader(terminalAppDefinition.id, createTerminalNativeLoader({ scripting }));
  }
  nativeApps.setLoader(
    recycleBinAppDefinition.id,
    createRecycleBinNativeLoader({ trash: filesystem.trash, fsEvents: fs }),
  );

  return services;
'''
if old_bottom not in services:
    raise SystemExit("expected experimental services composition not found")
services_path.write_text(services.replace(old_bottom, new_bottom))

# Tests use #631's env.os rather than experiment-only service fields.
test_path = Path("apps/plasmon/src/scripting/experiment.test.ts")
test = test_path.read_text()
test = test.replace(
    'import { RUN_CONTEXT_DECLARATIONS } from "./os-api/declarations.ts";\n',
    'import { RUN_CONTEXT_DECLARATIONS } from "./os-api/declarations.ts";\nimport { ScriptingService } from "./service.ts";\n',
)
test = test.replace("env.services.os", "env.os")
test = test.replace(
    '    await env.ready;\n    await env.os.fs.createDirectory("/Documents");\n    await env.os.fs.writeText("/Documents/demo.cmd", "echo Hello");\n    const destination = await env.services.scripting.transpileCmdFile("/Documents/demo.cmd");',
    '    await env.ready;\n    await env.os.fs.createDirectory("/Documents");\n    await env.os.fs.writeText("/Documents/demo.cmd", "echo Hello");\n    const scripting = new ScriptingService({ os: env.os });\n    const destination = await scripting.transpileCmdFile("/Documents/demo.cmd");',
)
test = test.replace(
    '    await expect(env.services.scripting.transpileCmdFile("/Documents/demo.cmd")).rejects.toThrow(',
    '    await expect(scripting.transpileCmdFile("/Documents/demo.cmd")).rejects.toThrow(',
)
test_path.write_text(test)

# Keep Monaco's ambient RunContext declarations aligned with the canonical DTOs.
decl_path = Path("apps/plasmon/src/scripting/os-api/declarations.ts")
decl = decl_path.read_text()
decl = decl.replace(
    ' * Temporary Monaco declarations for the experiment. The canonical OsApi source\n * introduced by the production testing API should become the generator/source\n * of truth once it lands so these declarations cannot drift.\n',
    ' * Monaco projection of the canonical production OsApi plus scripting-only\n * RunContext/command types. Keep this projection synchronized with src/os/api\n * until declaration generation is introduced.\n',
)
decl = decl.replace(
    '  state: "starting" | "running" | "closing";\n  windowId?: string;',
    '  title: string;\n  state: "starting" | "running" | "closing";\n  windowId?: string;',
)
decl = decl.replace(
    '  processId: string;\n  title?: string;\n  minimized: boolean;\n  maximized: boolean;',
    '  processId: string;\n  x: number;\n  y: number;\n  width: number;\n  height: number;\n  minimized: boolean;\n  maximized: boolean;',
)
decl = decl.replace('    stat(path: string): Promise<RunOsResource>;','    stat(path: string): Promise<RunOsResource | null>;')
decl = decl.replace('    list(path?: string): Promise<readonly RunOsResource[]>;','    list(path: string): Promise<readonly RunOsResource[]>;')
decl = decl.replace(
    '    createDirectory(path: string): Promise<RunOsResource>;\n    list(path: string): Promise<readonly RunOsResource[]>;',
    '    createDirectory(path: string): Promise<RunOsResource>;\n    list(path: string): Promise<readonly RunOsResource[]>;\n    copy(sourcePath: string, destinationPath: string): Promise<RunOsResource>;\n    move(sourcePath: string, destinationPath: string): Promise<RunOsResource>;\n    remove(path: string): Promise<void>;',
)
decl_path.write_text(decl)

# Correct v1 docs to the canonical copy/move destination-directory semantics.
v1_path = Path("apps/plasmon/src/scripting/V1.md")
v1 = v1_path.read_text()
v1 = v1.replace(
    '| `cp` | Copy a file/directory using canonical Plasmon semantics | `os.fs.copy()` |\n| `mv` | Move/rename using canonical Plasmon semantics | `os.fs.move()` |',
    '| `cp` | Copy a resource into an existing destination directory | `os.fs.copy()` |\n| `mv` | Move a resource into an existing destination directory | `os.fs.move()` |',
)
v1 = v1.replace(
    '`cp`, `mv`, and `rm` must not invent Unix filesystem semantics. They delegate to Plasmon\'s real copy/move/remove authorities, including collision, protection, Trash, identity, and policy behavior.',
    '`cp`, `mv`, and `rm` must not invent Unix filesystem semantics. In v1, `cp SOURCE DESTDIR` and `mv SOURCE DESTDIR` require `DESTDIR` to be an existing directory and preserve the source name, matching the canonical OsApi contract. `rm` uses normal Plasmon removal (Recycle Bin), not permanent deletion. Collision, protection, identity, and Trash policy remain production-owned.',
)
v1 = v1.replace('cp /Packages/base/default.txt /Documents/Templates/default.txt','cp /Packages/base/default.txt /Documents/Templates')
v1 = v1.replace('    "/Documents/Templates/default.txt",\n  );','    "/Documents/Templates",\n  );')
v1_path.write_text(v1)

# Remove experiment-only compatibility authority now that #631 is our parent.
for obsolete in [
    "apps/plasmon/src/os/integration/experimentalOsApi.ts",
    "apps/plasmon/src/scripting/os-api/types.ts",
    ".github/workflows/experiment-cmd-adopt-pr631.yml",
]:
    file = Path(obsolete)
    if file.exists():
        file.unlink()
