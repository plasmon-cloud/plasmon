from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if new in text:
        return
    if old not in text:
        raise RuntimeError(f"Expected finish marker not found in {path}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


# Generic FileManager knows only that an injected semantic action is available.
replace_once(
    "apps/plasmon/src/os/file-manager/FileManagerContextMenu.tsx",
    '  | "download"\n  | "cut"',
    '  | "download"\n  | "transpileRun"\n  | "cut"',
)
replace_once(
    "apps/plasmon/src/os/file-manager/FileManagerContextMenu.tsx",
    '  canDownload: boolean;\n  canCreateShortcut:',
    '  canDownload: boolean;\n  canTranspileCmd: boolean;\n  canCreateShortcut:',
)
replace_once(
    "apps/plasmon/src/os/file-manager/FileManagerContextMenu.tsx",
    '''          {props.node.kind === "file" ? (
            <button
              type="button"
              role="menuitem"
              disabled={!props.canDownload}
              title={props.canDownload ? undefined : "Preparing download"}
              onClick={() => props.onAction("download")}
            >
              Download
            </button>
          ) : null}
          <div className="fm-menu-separator" role="separator" />''',
    '''          {props.node.kind === "file" ? (
            <button
              type="button"
              role="menuitem"
              disabled={!props.canDownload}
              title={props.canDownload ? undefined : "Preparing download"}
              onClick={() => props.onAction("download")}
            >
              Download
            </button>
          ) : null}
          {props.canTranspileCmd ? (
            <button type="button" role="menuitem" onClick={() => props.onAction("transpileRun")}>
              Transpile to .run
            </button>
          ) : null}
          <div className="fm-menu-separator" role="separator" />''',
)

replace_once(
    "apps/plasmon/src/os/file-manager/FileManager.tsx",
    '  onOpenDirectory?: (node: FsNode) => void | Promise<void>;\n  onSnapshot?:',
    '  onOpenDirectory?: (node: FsNode) => void | Promise<void>;\n  onTranspileCmd?: (node: FsNode) => void | Promise<void>;\n  onSnapshot?:',
)
replace_once(
    "apps/plasmon/src/os/file-manager/FileManager.tsx",
    '  onOpenDirectory,\n  onSnapshot,',
    '  onOpenDirectory,\n  onTranspileCmd,\n  onSnapshot,',
)
replace_once(
    "apps/plasmon/src/os/file-manager/FileManager.tsx",
    '''  const operationPresentation = presentFileOperation(operation);
  const canPaste = Boolean(clipboard.snapshot());''',
    '''  const operationPresentation = presentFileOperation(operation);
  const canPaste = Boolean(clipboard.snapshot());
  const canTranspileCmd = Boolean(
    contextNode
      && contextNode.kind === "file"
      && contextNode.name.toLowerCase().endsWith(".cmd")
      && onTranspileCmd,
  );''',
)
replace_once(
    "apps/plasmon/src/os/file-manager/FileManager.tsx",
    '''    if (action === "download") {
      void commands.downloadNode(contextNode);
      return;
    }
    if (action === "cut") {''',
    '''    if (action === "download") {
      void commands.downloadNode(contextNode);
      return;
    }
    if (action === "transpileRun") {
      closeContextMenu();
      if (!onTranspileCmd || !canTranspileCmd) return;
      void Promise.resolve(onTranspileCmd(contextNode))
        .then(() => directory.refresh())
        .catch((cause: unknown) => directory.setError(cause instanceof Error ? cause.message : String(cause)));
      return;
    }
    if (action === "cut") {''',
)
replace_once(
    "apps/plasmon/src/os/file-manager/FileManager.tsx",
    '          canDownload={contextNode?.kind === "file" && commands.isDownloadReady(contextNode)}\n          canCreateShortcut=',
    '          canDownload={contextNode?.kind === "file" && commands.isDownloadReady(contextNode)}\n          canTranspileCmd={canTranspileCmd}\n          canCreateShortcut=',
)

# Explorer receives a semantic transpile authority from production composition.
replace_once(
    "apps/plasmon/src/native-apps/explorer/ExplorerApp.tsx",
    '  hiddenVisibility: HiddenVisibilityPreferenceStore;\n}',
    '  hiddenVisibility: HiddenVisibilityPreferenceStore;\n  transpileCmdFile?: (nodeId: NodeId) => Promise<void>;\n}',
)
replace_once(
    "apps/plasmon/src/native-apps/explorer/ExplorerApp.tsx",
    '  hiddenVisibility,\n}: ExplorerAppProps)',
    '  hiddenVisibility,\n  transpileCmdFile,\n}: ExplorerAppProps)',
)
replace_once(
    "apps/plasmon/src/native-apps/explorer/ExplorerApp.tsx",
    '              onOpenDirectory={(node) => navigate(node.id)}\n              onSnapshot={handleSnapshot}',
    '              onOpenDirectory={(node) => navigate(node.id)}\n              {...(transpileCmdFile ? { onTranspileCmd: (node: FsNode) => transpileCmdFile(node.id) } : {})}\n              onSnapshot={handleSnapshot}',
)

replace_once(
    "apps/plasmon/src/native-apps/explorer/index.ts",
    '  FsEventSource,\n  NativeAppDefinition,',
    '  FsEventSource,\n  NativeAppDefinition,\n  NodeId,',
)
replace_once(
    "apps/plasmon/src/native-apps/explorer/index.ts",
    '  hiddenVisibility: HiddenVisibilityPreferenceStore;\n}',
    '  hiddenVisibility: HiddenVisibilityPreferenceStore;\n  transpileCmdFile?: (nodeId: NodeId) => Promise<void>;\n}',
)
replace_once(
    "apps/plasmon/src/native-apps/explorer/index.ts",
    '      ...(dependencies.clipboard ? { clipboard: dependencies.clipboard } : {}),\n    });',
    '      ...(dependencies.clipboard ? { clipboard: dependencies.clipboard } : {}),\n      ...(dependencies.transpileCmdFile ? { transpileCmdFile: dependencies.transpileCmdFile } : {}),\n    });',
)

# Once ScriptingService exists, replace Explorer's early bootstrap loader with
# an equivalent loader that additionally exposes the semantic transpile action.
replace_once(
    "apps/plasmon/src/os/integration/services.ts",
    '''  const scripting = new ScriptingService({ os });
  if (!isCoreProfile) {
    nativeApps.setLoader(terminalAppDefinition.id, createTerminalNativeLoader({ scripting }));
  }
  nativeApps.setLoader(
    recycleBinAppDefinition.id,''',
    '''  const scripting = new ScriptingService({ os });
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
    recycleBinAppDefinition.id,''',
)

# Focused deterministic proof for parser, command behavior, filesystem transpile,
# registration/classification, and the .run ambient API declarations.
write("apps/plasmon/src/scripting/experiment.test.ts", '''import { expect, test } from "bun:test";
import { createHeadlessPlasmonEnvironment } from "../../test/headlessEnvironment.ts";
import { classifyResource } from "../os/fs/index.ts";
import { DEFAULT_SHELL_PREFERENCES } from "../os/shell/preferences.ts";
import { SimpleCmdParser } from "./cmd/simple.ts";
import { transpileCmdToRun } from "./cmd/transpile.ts";
import { CommandSession } from "./command/runtime.ts";
import { RUN_CONTEXT_DECLARATIONS } from "./os-api/declarations.ts";

test(".cmd parser lowers quotes, pipelines, and redirection to readable .run TypeScript", async () => {
  const parser = new SimpleCmdParser();
  const program = await parser.parse('echo "Hello Plasmon" | grep Plasmon > result.txt');
  expect(program).toEqual({
    pipelines: [{
      commands: [
        { name: "echo", args: ["Hello Plasmon"] },
        { name: "grep", args: ["Plasmon"] },
      ],
      stdoutPath: "result.txt",
    }],
  });
  const run = transpileCmdToRun(program);
  expect(run).toContain('commands.echo(["Hello Plasmon"])');
  expect(run).toContain('commands.grep(["Plasmon"])');
  expect(run).toContain(']).writeTo("result.txt")');
  await expect(parser.parse("echo $HOME")).rejects.toThrow("does not yet support shell operator");
});

test("production OsApi and command session provide deterministic filesystem/open behavior", async () => {
  const env = createHeadlessPlasmonEnvironment();
  try {
    await env.ready;
    await env.services.os.fs.createDirectory("/Documents");
    const output: string[] = [];
    const errors: string[] = [];
    const command = new CommandSession(env.services.os, {
      stdout: { write: (text) => output.push(text) },
      stderr: { write: (text) => errors.push(text) },
    });

    const redirected = await command.shell.pipeline([
      command.commands.echo(["Hello Plasmon"]),
    ]).writeTo("/Documents/hello.txt");
    expect(redirected.exitCode).toBe(0);
    expect(await env.services.os.fs.readText("/Documents/hello.txt")).toBe("Hello Plasmon\\n");

    const piped = await command.shell.pipeline([
      command.commands.cat(["/Documents/hello.txt"]),
      command.commands.grep(["Plasmon"]),
    ]).run();
    expect(piped).toEqual({ exitCode: 0, stdout: "Hello Plasmon\\n", stderr: "" });
    expect(output.at(-1)).toBe("Hello Plasmon\\n");
    expect(errors).toEqual([]);

    const opened = await env.services.os.open("/Documents/hello.txt");
    expect(opened.resource.path).toBe("/Documents/hello.txt");
    expect(opened.processId).toBeDefined();
    expect(env.services.nativeApps.get("native:terminal")?.name).toBe("Terminal");
  } finally {
    env.dispose();
  }
});

test("transpileCmdFile creates a sibling .run without overwriting existing output", async () => {
  const env = createHeadlessPlasmonEnvironment();
  try {
    await env.ready;
    await env.services.os.fs.createDirectory("/Documents");
    await env.services.os.fs.writeText("/Documents/demo.cmd", "echo Hello");
    const destination = await env.services.scripting.transpileCmdFile("/Documents/demo.cmd");
    expect(destination).toBe("/Documents/demo.run");
    expect(await env.services.os.fs.readText(destination)).toContain('commands.echo(["Hello"])');
    await expect(env.services.scripting.transpileCmdFile("/Documents/demo.cmd")).rejects.toThrow(
      "Refusing to overwrite existing /Documents/demo.run",
    );
  } finally {
    env.dispose();
  }
});

test(".run/.cmd classification, taskbar default, and ambient declarations expose the experiment", () => {
  const run = classifyResource({ name: "demo.run", kind: "file", metadata: {} });
  const cmd = classifyResource({ name: "demo.cmd", kind: "file", metadata: {} });
  expect(run.type.language).toBe("typescript");
  expect(cmd.type.language).toBe("shell");
  expect(DEFAULT_SHELL_PREFERENCES.pinnedNative).toContain("native:terminal");
  expect(RUN_CONTEXT_DECLARATIONS).toContain("declare const os: RunOsApi");
  expect(RUN_CONTEXT_DECLARATIONS).toContain("declare const commands: RunCommandFactory");
  expect(RUN_CONTEXT_DECLARATIONS).toContain("declare const shell: RunShellApi");
});
''')

write("apps/plasmon/test/rtl/experiment-cmd-context.test.tsx", '''import { expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import type { FsNode } from "../../src/os/contracts/index.ts";
import { FileManagerContextMenu } from "../../src/os/file-manager/FileManagerContextMenu.tsx";

const cmdNode: FsNode = {
  id: "file:cmd",
  parentId: "dir:documents",
  name: "demo.cmd",
  kind: "file",
  mime: "application/x-sh",
  size: 10,
  createdAt: 1,
  modifiedAt: 1,
  metadata: {},
};

test(".cmd context menu exposes the injected Transpile to .run action", () => {
  const actions: string[] = [];
  render(
    <div>
      <FileManagerContextMenu
        state={{ x: 0, y: 0, nodeId: cmdNode.id }}
        node={cmdNode}
        canOpenWith={true}
        canDownload={true}
        canTranspileCmd={true}
        canCreateShortcut={true}
        operationRunning={false}
        canPaste={false}
        onAction={(action) => actions.push(action)}
      />
    </div>,
  );
  const action = screen.getByRole("menuitem", { name: "Transpile to .run" });
  fireEvent.click(action);
  expect(actions).toContain("transpileRun");
});
''')

print("experiment finishing slice applied")
