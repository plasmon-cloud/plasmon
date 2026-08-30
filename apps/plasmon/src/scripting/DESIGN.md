# `.cmd` / `.run` design context

This document records the design decisions behind the `experiment/cmd` branch so a developer can continue the work without the original design conversation.

It is experimental design context, not a claim that the branch is already release-ready. Current repository contracts and the canonical production `OsApi` outrank temporary compatibility code on this branch.

## 1. Problem being solved

Plasmon needs a small command/scripting surface for three related jobs:

1. an interactive Terminal for ordinary filesystem/application operations;
2. readable command files for simple automation and provisioning;
3. a real programming language for automation that exceeds shell convenience syntax.

Trying to solve all three with Bash compatibility would create a large parser/runtime project, duplicate many concepts that TypeScript already handles well, and tempt the shell to invent Linux semantics that Plasmon does not actually possess.

The chosen split is therefore:

```text
.cmd = small shell-like convenience language
.run = real TypeScript + implicit Plasmon RunContext
.ts  = ordinary TypeScript, no implicit Plasmon runtime context
```

## 2. Architectural invariant

The durable dependency direction is:

```text
OsApi           durable production OS capabilities
   ^
   |
Command layer   command names, cwd, pipelines, redirects, status
   ^
   |
RunContext      execution-scoped OS + shell + stdio + args + cancellation
   ^
   |
.run runtime    real TypeScript compilation/execution
   ^
   |
.cmd            small syntax that transpiles to readable .run
```

Test support is a separate peer concern. Test-only powers do not belong in the production `OsApi` merely because they are convenient.

### Why this matters

The shell should be a client of the OS, not a second OS implementation. If a command needs a legitimate operation that cannot be expressed through production semantics, the correct question is whether the canonical OS API is missing a capability. The wrong answer is to reach into private stores/services from every built-in command or to grow a permanent scripting-only API shadow.

## 3. `.cmd` must genuinely transpile to `.run`

The experiment intentionally requires this path:

```text
.cmd source
  -> parse
  -> transpile
  -> readable .run TypeScript
  -> TypeScript compiler
  -> RunContext / command layer / OsApi
```

Do not optimize `.cmd` execution into a hidden direct-AST interpreter that makes the generated `.run` cosmetic. The readable transpilation is part of the product:

- users can learn `.run` by seeing what their `.cmd` becomes;
- Explorer can expose **Transpile to .run** as a useful action;
- users can graduate from linear shell syntax into TypeScript without changing the underlying OS capability model;
- debugging has one conceptual execution model rather than separate shell and script engines.

Generated code should favor readability over terseness.

## 4. Why `.run` is TypeScript

Plasmon already ships Monaco and can use its TypeScript worker. `.run` therefore gets a mature language, diagnostics, completion, hover/type information, functions, loops, conditionals, objects, arrays, async/await, and ordinary structured error handling without implementing another programming language.

The runtime supplies implicit globals/context roughly equivalent to:

```ts
interface RunContext {
  os: OsApi;
  commands: CommandFactory;
  shell: ShellApi;
  args: readonly string[];
  stdin: InputReader;
  stdout: TextWriter;
  stderr: TextWriter;
  signal: AbortSignal;
  print(...values: unknown[]): void;
}
```

The exact contracts may evolve, but the separation does not: `.run` programming features belong to TypeScript; durable OS authority belongs to `OsApi`; shell mechanics belong above `OsApi`.

## 5. Why `.cmd` is intentionally smaller than Bash

The first useful grammar is limited to the parts that make interactive command use and linear scripts pleasant:

- words/arguments;
- single/double quotes;
- simple escaping;
- line comments;
- newline sequencing;
- pipelines;
- stdout overwrite redirection;
- cwd-aware paths;
- exit status.

Features such as variables, command substitution, `&&`, `||`, globbing, aliases, append/input/fd redirects, and jobs can be added deliberately in later stages. Shell functions, loops, conditionals, arrays, and other programming-language features should face a higher bar because `.run` already solves them better.

Unsupported syntax should fail clearly. A small explicit language is preferable to a parser that accepts Bash-looking text but executes it incorrectly.

## 6. Command semantics: familiar names, native behavior

Command names can be familiar without pretending Plasmon is Linux.

### Filesystem

All filesystem commands must use canonical filesystem/`OsApi` operations. The command layer resolves cwd and presents results, but it does not own resource identity, collision policy, protection, Trash policy, persistence, or case rules.

Examples:

- `rm` means normal Plasmon removal and must respect Recycle Bin/protection semantics.
- `mv` must use real move/rename semantics rather than reconstructing a resource by read/delete/write.
- `cp` must preserve canonical copy semantics and identity rules.
- `ls` needs a legitimate directory-listing API; do not implement it by reaching into a private filesystem store.
- case behavior follows the canonical Plasmon filesystem/path model. The shell must not add its own Linux-style case-sensitive namespace on top.

### Application/process behavior

- `open` delegates to the shared open/association service.
- `ps` reports Plasmon process records, not fake POSIX processes.
- future `kill` requires real production process-control authority; listing processes does not imply permission/control APIs.

### Security concepts that must not be fabricated

Do not add fake Unix root/sudo, UID/GID, chmod/chown, executable bits, symlink/inode semantics, raw Linux interfaces/sockets, systemd logs, or kernel metrics unless Plasmon/Neutron eventually exposes a truthful analogous product concept.

## 7. Script activation and security posture

The desired desktop interaction is executable-by-file-type:

- normal activation/double-click of `.cmd` runs it;
- normal activation/double-click of `.run` runs it;
- both expose an obvious **Edit** action;
- `.cmd` additionally exposes **Transpile to .run**.

This follows the user expectation that a script file behaves like an executable resource rather than always opening as Notepad text.

There is no need to invent a Unix executable bit solely to gate this behavior. Plasmon already has file associations and capability/security authorities. If downloaded/shared scripts later need provenance warnings or trust/quarantine treatment, that should be designed from actual resource origin/capability semantics, not copied from Unix permissions or Windows PowerShell friction by default.

Inspectability is important: **Edit** should remain one click away so a user can read a script before running it.

## 8. Shebang decision

A shebang such as `#!/bin/bash` exists on Unix primarily so the OS can choose an interpreter when executing a file. Plasmon already knows the interpreter from the `.cmd` or `.run` association.

Therefore v1 does **not** require a shebang. Starter templates should not imply one is necessary.

A future shebang-like line would need an independent purpose, for example portability metadata or choosing among multiple command runtimes. Until such a purpose exists, it is noise.

## 9. Terminal design

The first prototype used simpler browser form/input behavior. Dogfooding showed that a terminal should behave like a terminal, particularly for focus, selection, history, completion, control keys, and future interactive applications.

The current direction is xterm-backed presentation with command execution still owned by the scripting service/command runtime.

Terminal responsibilities:

- terminal rendering and input;
- prompt/cwd presentation;
- history navigation;
- completion interaction;
- selection/copy;
- control-key translation such as eventual Ctrl-C;
- lifecycle of the interactive session.

Terminal should not contain duplicate implementations of `ls`, path rules, pipelines, or filesystem mutations.

Successful Unix-like mutation commands should normally be quiet. Users infer success from the next prompt and can inspect state with another command. Errors must be explicit and readable.

## 10. Editing and creation UX

Dogfooding exposed that runtime capability without file lifecycle UX is not a usable scripting feature.

The v1 interaction target includes:

### Explorer

- **New Command Script (.cmd)** with a useful starter template;
- **New Run Script (.run)** with a useful starter template;
- **Run** and **Edit** actions for both executable types;
- **Transpile to .run** for `.cmd`;
- normal double-click activation executes the script.

Longer term, these actions should come from shared file/action semantics so Desktop and other file surfaces do not grow divergent behavior.

### Terminal

`edit PATH` is the first integration point for editing from the shell. It opens the existing native Text Editor. This is preferable to immediately implementing a second editor.

A small Nano-style terminal application is desirable later because it supports terminal-centric workflows and exercises the interactive xterm/application boundary. Vim parity is not required.

## 11. Monaco language experience

Two different editor experiences are required.

### `.cmd`

Generic shell highlighting is not enough because the supported language is specifically Plasmon Command, not Bash.

Monaco integration should use the real command catalog for:

- command-name completion;
- hover summaries;
- usage/options documentation;
- later, option and path completion.

The same metadata should feed Terminal `help`/`man` so documentation cannot drift independently between the shell and editor.

If Monaco displays a language name, it should eventually identify the language as Plasmon Command/`.cmd`, not advertise full shell/Bash compatibility.

### `.run`

`.run` should receive TypeScript language services plus declarations for the implicit `RunContext` globals such as `os`. Typing `os.` should produce real typed completion from the runtime contracts.

The packaged TS worker is intentionally reused. Do not add a second TypeScript compiler solely for scripting.

## 12. Package provisioning

A major v1 goal is that scripts can participate in a basic Plasmon installation/provisioning workflow.

Desired shell surface:

```sh
pkg list
pkg install <package-or-source>
pkg remove <package>
```

This is blocked until there is a truthful production authority to call. The command runtime must not invent its own package database or bypass Neutron package/install ownership.

The intended division is:

- `.cmd` for linear provisioning steps;
- `.run` for conditional/idempotent logic;
- production package/filesystem APIs for actual authority.

## 13. Version strategy

### v1

Prove the architecture and make it usable end-to-end: core commands, real `.run`, `.cmd` transpilation, package provisioning, Terminal, executable associations, New/Run/Edit/Transpile UX, Monaco discoverability, deterministic tests, and a fully passing packaged-browser path.

### v2

Add everyday shell ergonomics: aliases, common composition/expansion/redirection, richer completion/help, terminal-native Nano-style editing, robust cancellation, arguments, history/diagnostic polish, and a deliberate trust/provenance model for externally sourced scripts.

### v3

Add capabilities that require broader OS/runtime authority: jobs/background execution, process control, network/HTTP, archives/storage inspection, scheduling, larger optional command applications, and reusable `.run` modules/libraries.

Root `todo.md` is the detailed feature inventory.

## 14. Testing strategy

The scripting effort is also a proof of the broader Plasmon testing direction: most deterministic behavior should be testable below Playwright.

Use:

- parser tests for grammar and unsupported syntax;
- transpiler tests for readable generated `.run`;
- command/runtime tests for cwd, status, pipes, redirects, and command semantics;
- canonical/headless OS tests for legitimate production API behavior;
- RTL only for React action/menu wiring;
- packaged browser tests only for actual browser/installed-runtime boundaries: iframe focus, xterm input, Blob/module/runtime restrictions, Monaco workers, file activation, and installed package assets.

The packaged smoke should prove at least:

1. Terminal launches and accepts input;
2. a simple command executes;
3. Explorer can create or manipulate a `.cmd`;
4. `.cmd` has Run/Edit/Transpile actions;
5. execution follows `.cmd -> .run -> runtime`;
6. the generated `.run` opens as TypeScript;
7. `.run` Monaco completion sees runtime globals and `OsApi` members.

A browser test failure caused only by a locator ambiguity is still a failed gate, but it should be fixed in the test rather than changing correct product UX. The latest packaged run reached the `.cmd` menu and failed because Playwright's non-exact `Run` role query matched both `Run` and `Transpile to .run`; the next test change should use an exact `Run` match and continue the smoke.

## 15. Known integration cleanup

The experiment was started before the canonical production `OsApi` work was available. As a result, it currently includes temporary compatibility types and an experimental production-services adapter.

When rebasing/integrating onto the canonical API:

1. delete the duplicate scripting `os-api` type layer;
2. use canonical production contracts directly;
3. replace the experimental adapter with the canonical production adapter/composition path;
4. reconcile process/window/resource DTO differences instead of preserving duplicate shapes;
5. add only legitimate missing operations such as filesystem listing to the canonical API;
6. keep command/runtime/stdio/cwd concerns out of `OsApi`;
7. rerun deterministic, build/package, and packaged-browser gates.

This cleanup is architectural, not optional polish. The experiment should not ship with two competing definitions of the OS semantic API.

## 16. Decision rule for future additions

When considering a new feature, ask in this order:

1. **Is this a real OS capability?** Put it behind the canonical production authority/`OsApi` if it is a durable legitimate operation.
2. **Is this shell/session behavior?** Keep it in the command/runtime layer.
3. **Is this programming-language control flow/data logic?** Prefer `.run` TypeScript.
4. **Is this browser presentation/input?** Keep it in Terminal/Monaco/File Manager UI adapters.
5. **Is this only useful to tests?** Keep it in test support rather than production API.
6. **Does the requested Unix behavior actually exist in Plasmon/Neutron?** If not, define a truthful native concept or do not implement it.

That rule is the main guardrail for growing `.cmd` / `.run` without turning the experiment into a second OS, a Bash clone, or a test-only façade.
