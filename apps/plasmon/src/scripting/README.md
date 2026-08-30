# Plasmon scripting experiment

This directory contains the experimental `.cmd` / `.run` scripting stack on `experiment/cmd`.

The product idea is deliberately two-level:

- **`.cmd`** is a small, familiar shell-like language for interactive commands, linear scripts, pipelines, and basic provisioning.
- **`.run`** is real TypeScript with an implicit Plasmon runtime context for conditionals, loops, functions, data structures, reusable logic, and direct typed OS automation.

`.cmd` is not intended to become a Bash clone. When shell grammar starts turning into a programming language, the preferred answer is `.run`.

## Read first

For work in this directory, read:

1. repository and Plasmon `AGENTS.md` files;
2. `apps/plasmon/TESTING.md`;
3. this file;
4. `DESIGN.md` for architecture and UX decisions;
5. `V1.md` for the original v1 execution/language contract;
6. root `todo.md` for the current v1/v2/v3 backlog and dogfood-driven scope changes.

`V1.md` predates the latest usability dogfood. The core execution contract still applies, but root `todo.md` is authoritative for the experiment backlog where later discussion moved items such as `touch`, `man`, `edit`, executable associations, creation templates, and Monaco help into the v1 target.

## Core execution path

```text
Terminal / File activation
        |
        v
      .cmd
        |
        | parse small shell syntax
        v
    command AST
        |
        | transpile
        v
 readable .run TypeScript
        |
        | compile with packaged Monaco TS worker
        v
     RunContext
        |
        +--> CommandSession / CommandRegistry / pipelines / cwd / stdio
        |
        +--> canonical production OsApi
                    |
                    v
          real Plasmon authorities
```

The transpilation step is a product requirement. `.cmd` execution must not secretly bypass generated `.run` through an unrelated IR fast path. A user should be able to transpile a `.cmd`, inspect the result, edit the TypeScript, and run the `.run` file directly.

## Layer ownership

### `OsApi`

The durable production semantic API for legitimate OS operations. It should expose capabilities such as filesystem operations, opening resources, and process/window inspection through production authorities.

It must **not** contain shell commands, shell cwd, pipes, redirects, Terminal history, or arbitrary test-only powers.

The experiment currently carries compatibility code under `scripting/os-api` and an experimental integration adapter. Those are temporary. When the branch is based on the canonical production `OsApi`, delete the duplicate contract/adapter and consume the canonical API directly. If scripting needs a legitimate missing OS operation, add it to the canonical API rather than preserving a shadow API.

### `RunContext`

The execution context supplied implicitly to `.run` TypeScript. It owns execution-scoped concerns such as:

- `os`;
- command access;
- shell/pipeline helpers;
- `args`;
- stdin/stdout/stderr;
- cancellation signal;
- convenience printing.

This is the scripting/runtime layer, not the OS authority layer.

### Command layer

Owns command registration, help metadata, cwd-aware argument resolution, pipelines, text processing, redirection, exit status, and built-in command behavior.

Commands should call `OsApi` for real OS operations and remain pure/runtime-local where no OS operation is required. A command named like a Unix tool does not grant permission to invent Unix semantics that Plasmon does not have.

### Terminal

Terminal is presentation and interactive-session ownership. It uses xterm for terminal behavior and the scripting service for execution. It should not become the only implementation of command semantics.

## Current source map

- `cmd/simple.ts` — intentionally small `.cmd` parser.
- `cmd/types.ts` — parser/AST types.
- `cmd/transpile.ts` — readable `.cmd` to `.run` transpilation.
- `cmd/monaco.ts` — `.cmd` Monaco completion/hover integration.
- `command/catalog.ts` — command metadata used for discoverability/help.
- `command/runtime.ts` — command session, built-ins, cwd, pipelines, and stdio behavior.
- `run/context.ts` — `RunContext` shape.
- `run/compiler.ts` — compiler abstraction.
- `run/monacoCompiler.ts` — packaged Monaco TypeScript-worker compiler.
- `run/monacoTypes.ts` — TypeScript declarations for implicit `.run` globals.
- `run/runtime.ts` — `.run` compile/execute bridge.
- `service.ts` — scripting composition/session service and file execution/transpilation entry points.
- `experiment.test.ts` and command-focused tests — deterministic experiment coverage.

Integration with Terminal, Explorer, associations, Monaco, services, packaging, and browser smoke lives in the corresponding owning subsystems rather than being duplicated under this directory.

## File behavior

### `.cmd`

A `.cmd` file is an executable Plasmon command script by association. Normal activation should run it. The user must also have an obvious **Edit** action and a **Transpile to .run** action.

A shebang is not required. The file extension/association already selects the Plasmon command runtime. A future shebang feature would need a separate reason such as portable metadata; it should not be cargo-culted from Unix.

### `.run`

A `.run` file is executable TypeScript with implicit `RunContext`. Normal activation should run it; **Edit** opens it as TypeScript in the editor.

`.ts` remains ordinary TypeScript. It does not automatically receive the OS runtime context merely because `.run` uses TypeScript syntax.

## Product semantics versus Unix syntax

The shell borrows familiar command names and compact syntax, but production behavior remains Plasmon behavior.

Examples:

- `rm` follows canonical Plasmon removal/Recycle Bin policy rather than becoming a privileged permanent-delete backdoor.
- `open` uses the shared association/open service.
- filesystem collision, protection, identity, and path semantics belong to the filesystem subsystem.
- case behavior follows canonical Plasmon filesystem/path semantics; the shell does not overlay a second case-sensitivity model.
- no fake Unix permission bits, users/groups, root/sudo, symlinks/inodes, process environment, or Linux network/kernel state should be introduced only for command-name familiarity.

## User-facing discoverability

A scripting feature is incomplete if a user can only use it after reading source code.

The v1 UX therefore includes:

- creation of starter `.cmd` and `.run` files from Explorer;
- normal activation that executes scripts;
- explicit **Run** and **Edit** context actions;
- manual `.cmd` to `.run` transpilation;
- `.cmd` command completion and hover/help sourced from the real command catalog;
- `.run` TypeScript completion for the implicit runtime context;
- Terminal `help`/`man` backed by the same command metadata;
- `edit PATH` as the initial Terminal-to-editor bridge.

A terminal-native editor such as a small Nano-style application is a useful follow-on, but the shell should first integrate correctly with the existing native Text Editor.

## Verification expectations

Use the lowest layer that can prove the claim:

- parser/transpiler/command/runtime semantics: Bun tests;
- Explorer/React action wiring: focused RTL/UI tests;
- TypeScript worker packaging: package/build checks;
- xterm focus/input, installed iframe behavior, real packaged execution, and Monaco worker behavior: packaged browser smoke.

Do not claim the packaged scripting workflow is green because deterministic tests passed. The current experiment has passed the fast tests/build/worker checks, while the packaged browser gate still needs a complete clean pass on the final head.

## Roadmap

Root `todo.md` is the complete working v1/v2/v3 list. The broad intent is:

- **v1:** useful executable scripts, basic shell, real `.run`, editor/file-manager discoverability, package provisioning, and a proven packaged path;
- **v2:** aliases, common shell composition/expansion, richer completion/help, terminal-native editing, cancellation and trust polish;
- **v3:** jobs/background work and capabilities that require broader legitimate OS support such as network, archives, process control, scheduling, and reusable `.run` modules.

Across all versions, `.run` remains the programmable escape hatch and canonical `OsApi` remains the durable OS capability boundary.
