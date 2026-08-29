# Plasmon command experiment

Status: experimental design for `experiment/cmd`; not a production contract.

## Goal

Give Plasmon one scriptable command surface that can power a user-facing Terminal, automation, package/profile setup, and deterministic tests without creating a second OS implementation.

The user-facing application is **Terminal** (`Terminal.sys`). The shell language is **Plasmon Shell** (`psh`). The reusable headless authority is `CommandService`.

The important architecture is:

```text
shell source
  -> shell parser AST
  -> parser-independent CommandProgram IR (TypeScript data)
  -> CommandService / CommandSession
  -> typed Plasmon command primitives
  -> existing Plasmon services
       FsService / filesystem open / Process / associations / Neutron adapter / ...
```

The runtime does **not** generate TypeScript source and `eval` it. TypeScript is the implementation and typed authoring language, not a second runtime. A diagnostic emitter may render a `CommandProgram` as readable TypeScript-like calls so a shell script can be inspected, tested, or migrated to direct TypeScript automation, but execution interprets the typed IR directly.

This avoids CSP/eval problems, preserves structured errors and cancellation, and prevents generated source from becoming an alternate authority.

## Why an intermediate IR

An advanced shell parser and Plasmon OS primitives solve different problems.

A shell parser owns syntax such as quoting, pipelines, redirects, conditionals, loops, functions, substitutions, and expansions. Plasmon owns filesystem identity, opening, application lifecycle, preferences, packages, and Neutron capabilities.

The parser-specific AST must therefore be lowered into a small stable command IR before product behavior runs. That gives Plasmon:

- one execution model even if the parser library changes;
- a typed surface usable directly by TypeScript automation and tests;
- deterministic tests for command semantics without React or a terminal emulator;
- a place to implement cancellation, stdio, exit codes, environment, cwd, and redirection consistently;
- no shell-library access to private Plasmon stores or React components.

## Proposed core model

`CommandSession` is stateful user/session context:

- current working directory stored as a stable `NodeId`, not a mutable path;
- environment variables;
- shell functions/aliases when those are implemented;
- cancellation scope;
- no privileged/root bypass.

`CommandProgram` is parser-independent syntax/flow. The intended mature shape includes:

- sequence;
- simple invocation;
- pipeline;
- `&&` / `||` conditionals;
- redirects;
- assignments and expansion;
- `if`, `for`, `while`, `case`;
- function declaration/call;
- grouped/subshell execution.

The initial experiment implements only the bounded subset required to prove the architecture: simple commands, quotes, pipelines, output redirection, and `&&` / `||`.

`CommandDefinition` maps a command name to a typed implementation. Command definitions call public Plasmon services or a narrow automation facade over those services. They do not contain UI logic.

## TypeScript automation surface

The command middle layer should also be useful without shell syntax. A future public scripting API can expose the same operations directly, conceptually:

```ts
await os.fs.mkdir("/Documents/Projects");
const text = await os.fs.readText("/Documents/README.txt");
await os.open("/Documents/README.txt");
```

Shell commands become adapters over those typed operations:

```text
mkdir /Documents/Projects
  -> invocation("mkdir", ["/Documents/Projects"])
  -> command definition
  -> typed filesystem operation
  -> FsService
```

Tests can use either level deliberately:

- direct typed operations when testing product semantics;
- `CommandProgram` when testing command composition;
- shell text only when testing shell behavior.

This prevents tests from becoming stringly typed while still making the command layer a useful black-box integration surface.

## Filesystem rules

Shell paths are presentation/input. Execution resolves them through `FsService` and keeps cwd as stable `NodeId`.

Commands must not bypass filesystem policy:

- reads/writes use `FsService`;
- opening uses the canonical filesystem/open dispatcher;
- protected resources remain protected;
- a future `rm` should use the owning delete/Trash policy rather than silently calling a lower private store;
- installed `.neutron` projections remain projections and are not uninstalled by deleting a path.

The experiment starts with commands that have unambiguous authority: `pwd`, `cd`, `ls`, `cat`, `echo`, `mkdir`, `grep`, `open`, `help`, `true`, and `false`.

## Stdio and pipelines

The durable target is byte-oriented asynchronous streams so browser-WASM commands and long-running commands can eventually participate without buffering entire outputs.

The first experiment may use bounded text buffers internally to prove command composition. The public model must keep stdin/stdout/stderr distinct and return an explicit numeric exit code so it can move to streaming without changing command semantics.

A pipeline passes stdout from the left command to stdin of the right command. Stderr does not enter the pipe unless a future redirect explicitly requests it.

## Shell compatibility strategy

`psh` is Bash-like, not Bash, until compatibility is actually demonstrated.

The parser is an adapter. The preferred advanced-parser experiment is a modern TypeScript parser that produces a typed POSIX/Bash-family AST; `@aliou/sh` is currently an attractive candidate because it is TypeScript, dependency-free, and already models pipelines, logical operators, loops, functions, tests, arithmetic, and Bash-family clauses. Because it is young, Plasmon must not expose its AST as a product contract.

`mvdan/sh` remains a useful reference for shell semantics and compatibility, but compiling a Go interpreter to browser WASM would add another runtime and would make the shell semantics live outside the TypeScript command layer. For this experiment, Plasmon should own execution in TypeScript and use an external parser only for syntax.

The initial implementation uses a deliberately small internal parser behind the same adapter so the command/OS architecture can be tested without adding a package dependency or lockfile churn. Replacing that parser with an advanced parser is a separate experiment step and should be judged by package size, syntax coverage, errors, and compatibility fixtures.

## TypeScript diagnostic emission

A `CommandProgram` may be rendered as a readable TypeScript representation, for example:

```text
echo "hello plasmon" | grep plasmon
```

can be explained conceptually as:

```ts
await command.pipeline([
  command.invoke("echo", ["hello plasmon"]),
  command.invoke("grep", ["plasmon"]),
]);
```

This emitter is for inspection, documentation, migration, and test equivalence. It is not evaluated and cannot gain authority beyond `CommandService`.

A useful later Terminal command is `compile --typescript <shell>` or an equivalent developer command that displays this representation.

## Terminal.sys

`Terminal.sys` is a normal Plasmon-native application registered through `NativeApplicationRegistry` and launched through Process/Windowing. The app is only an adapter:

```text
keyboard / terminal rendering
  -> CommandSession.run(source)
  -> stdout/stderr presentation
```

The Terminal must not own command semantics, filesystem mutation, application launch policy, or package policy.

The first UI can be a small accessible monospace terminal surface. `@xterm/xterm` is a good later rendering adapter when terminal escape sequences, cursor addressing, interactive browser-WASM programs, or richer terminal behavior are actually needed. Xterm is not itself the shell.

## Composition

`createPlasmonServices()` should construct the command authority from the same production services already used by Desktop/FileManager/native apps and expose it on `PlasmonServices`.

The Terminal loader receives that service by dependency injection. No global singleton and no test-only service graph.

`createHeadlessPlasmonEnvironment()` automatically gains the same command service because it already calls production `createPlasmonServices()`. A small convenience helper such as `runCommand()` is acceptable, but feature behavior must remain in production `CommandService`.

## Testing plan

### Pure/model

- parser tokenization/quoting and operator precedence for the supported subset;
- AST -> `CommandProgram` lowering;
- TypeScript diagnostic emitter;
- exit-code behavior for sequences, pipelines and `&&` / `||`;
- unknown-command and malformed-command errors.

### Headless production composition

Using `createHeadlessPlasmonEnvironment()`:

- `mkdir` creates real filesystem nodes;
- `cd` stores stable cwd identity and `pwd` reflects a rename/move correctly through `pathOf`;
- `echo ... > file` persists through real `FsService`;
- `cat file | grep value` composes stdout/stdin;
- `open file` reaches canonical association/open/process behavior rather than a Terminal-specific launcher;
- filesystem protection errors surface truthfully;
- running the same `CommandProgram` directly and via parsed shell yields equivalent product state.

### React adapter

Use RTL/Happy DOM for:

- launchable Terminal app rendering;
- entering a command;
- stdout/stderr presentation;
- prompt/cwd refresh;
- keyboard submit/history behavior that does not require a real terminal engine.

No Playwright is required for the initial experiment. Add a real-browser test only if xterm, browser-WASM, focus mechanics, or another genuine browser boundary later becomes part of the claim.

## Security and authority

The command layer is not root.

- It receives only the same services Plasmon already exposes to production composition.
- It does not bypass filesystem/resource protection.
- It does not `eval`, use `new Function`, or execute generated JavaScript/TypeScript.
- It does not expose arbitrary Neutron management-canister authority.
- It does not treat shell scripts as trusted package manifests.
- Future networking must go through an accepted bounded network/Neutron capability rather than an unreviewed `fetch` escape hatch.
- Future package installation must delegate to real Neutron/package authority rather than modifying `/Apps` or Program Files directly.

## Package and WASM direction

This experiment intentionally does not implement `apt`, `.plasmon`, or WASM execution, but the command model is designed to host them later.

A command definition can eventually choose an execution adapter:

```text
shell builtin / TypeScript command
browser-WASM command
Neutron/headless Element command
future canister-WASM-backed command
```

All of them should present the same command contract: argv, cwd, env, stdin/stdout/stderr, cancellation, and exit status. That keeps shell syntax independent of where computation executes.

## Initial acceptance slice

The first implementation is successful when all of the following are true:

1. `Terminal.sys` is a real launchable native system application.
2. `createPlasmonServices()` exposes one headless `CommandService` used by Terminal and tests.
3. `psh` parses and executes simple commands, quotes, `|`, `>`, `&&`, and `||` through parser-independent IR.
4. `pwd`, `cd`, `ls`, `cat`, `echo`, `mkdir`, `grep`, `open`, `help`, `true`, and `false` run against production Plasmon services/pure command implementations.
5. `echo "Hello Plasmon" > /Documents/hello.txt` creates/writes a real filesystem file.
6. `cat /Documents/hello.txt | grep Plasmon` returns the expected pipeline output.
7. `open /Documents/hello.txt` uses the canonical opening path and creates the normal Text process/window where available.
8. The same command graph is executable directly as typed `CommandProgram` without shell text.
9. A diagnostic TypeScript representation can be emitted without evaluating generated code.
10. Deterministic command/OS claims are proven below Playwright.

## Explicit non-goals for the first slice

- full Bash compatibility;
- command substitution, globbing, arithmetic, arrays, functions, loops, jobs, signals, or subprocess emulation;
- `curl | psh`;
- package installation;
- root/sudo semantics;
- arbitrary browser networking;
- browser-WASM or canister-WASM execution;
- xterm/curses compatibility;
- replacing existing GUI services with shell-owned implementations.
