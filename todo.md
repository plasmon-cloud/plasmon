# `.cmd` / `.run` roadmap

This is the working backlog for the `experiment/cmd` branch. It records the desired product surface discussed during the experiment so future developers do not need the original chat to reconstruct intent.

The version labels describe capability stages, not release numbers for Plasmon itself.

Status convention:

- `[x]` implemented on this experiment branch and covered at least by deterministic tests/build checks;
- `[~]` partially implemented, implemented with a temporary dependency, or still missing required packaged/browser proof;
- `[ ]` desired but not implemented.

The detailed v1 language contract is in `apps/plasmon/src/scripting/V1.md`. The design and architectural rationale are in `apps/plasmon/src/scripting/README.md` and `apps/plasmon/src/scripting/DESIGN.md`.

## v1 — useful Plasmon shell and executable scripts

### Architecture and runtime

- [x] `.cmd` is a small Bash-like convenience language, not Bash compatibility.
- [x] `.cmd` parses into a local AST and genuinely transpiles to readable `.run` TypeScript before execution.
- [x] `.run` is real TypeScript with an implicit `RunContext`, not a private intermediate DSL.
- [x] Keep `OsApi`, `RunContext`, command/runtime mechanics, and test-only powers as separate layers.
- [~] Consume the canonical production `OsApi` as the durable OS capability boundary. The branch still contains temporary scripting compatibility types/adapter that must be removed after rebasing onto the canonical API work.
- [ ] Add the legitimate canonical `os.fs.list()` capability needed by `ls` if it is still absent when the experiment is rebased.
- [x] Reuse the packaged Monaco TypeScript worker/compiler for `.run`; do not add a second compiler or runtime CDN dependency.
- [x] Keep the `.cmd` parser local and small; no runtime download of a shell parser.
- [x] Support cancellation plumbing through `AbortSignal` in `RunContext`.
- [x] Preserve normal Plasmon/Neutron capability and filesystem authorities; scripting must never become a parallel privileged OS implementation.

### `.cmd` v1 syntax

- [x] whitespace-separated command arguments;
- [x] single-quoted arguments;
- [x] double-quoted arguments;
- [x] basic backslash escaping;
- [x] `#` line comments;
- [x] newline-separated command sequencing;
- [x] pipelines with `|`;
- [x] stdout overwrite redirection with `>`;
- [x] absolute Plasmon paths and relative paths resolved against session cwd;
- [x] command exit status propagation;
- [x] explicit `exit` command/status;
- [x] unsupported shell syntax fails explicitly instead of being silently misparsed;
- [x] no shebang requirement. A leading `#!` is not needed to choose the runtime because the `.cmd`/`.run` file association already does that.

### `.run` v1 context

- [x] expose `os`;
- [x] expose command factories/registry access;
- [x] expose shell/pipeline helpers;
- [x] expose `args`;
- [x] expose stdin/stdout/stderr abstractions;
- [x] expose cancellation signal;
- [x] expose a simple `print(...)` convenience;
- [x] provide Monaco TypeScript declarations/completion for the implicit runtime context.

### v1 commands — filesystem/navigation

- [x] `pwd`;
- [x] `cd`;
- [x] `ls`, including common human-friendly flags such as `-l`, `-a`, and combined forms such as `-lah` where meaningful;
- [x] `mkdir`, including `-p` behavior where it can be expressed truthfully through Plasmon filesystem semantics;
- [x] `touch` for simple file creation without pretending to implement Unix timestamp semantics;
- [x] `cp` through canonical filesystem copy semantics;
- [x] `mv` through canonical filesystem move/rename semantics;
- [x] `rm` through canonical Plasmon removal/Recycle Bin semantics, including familiar convenience flags where they do not bypass product policy;
- [x] `cat`;
- [x] `open` through the shared open/association service;
- [x] `edit PATH` to open a resource in the normal Plasmon Text Editor;

### v1 commands — text/pipelines

- [x] `echo`;
- [x] `grep`, with a small useful option set such as case-insensitive and line-number output;
- [x] `head`;
- [x] `tail` without live-follow mode;
- [x] `wc`;
- [x] `sort`;
- [x] `uniq`;
- [x] `tee`;

### v1 commands — session/OS help

- [x] `ps` using Plasmon process records;
- [x] `clear`;
- [x] `history`;
- [x] `help` backed by command metadata;
- [x] `man COMMAND`/equivalent command-specific help backed by the same metadata rather than a separate manual database;
- [x] `true` and `false` for status composition, but do not clutter the normal beginner help list;
- [x] `exit`;
- [x] commands that succeed normally remain quiet like Unix tools unless they have meaningful output to report;
- [x] errors use Plasmon terminology such as "OS API" rather than exposing internal experimental names.

### v1 package/provisioning capability

A useful v1 should be capable of driving a basic system/application provisioning script, not only manipulating already-installed files.

- [ ] `pkg list` through a truthful production package/application authority;
- [ ] `pkg install <package-or-source>` through the production installation path;
- [ ] `pkg remove <package>` through the production removal path;
- [ ] do not invent a scripting-only package database or bypass Neutron installation/security ownership;
- [ ] prove a small idempotent base-system provisioning example using `.cmd` for linear steps and `.run` for conditionals.

### Terminal v1 UX

- [x] real terminal presentation using xterm rather than a plain form/text-area imitation;
- [~] reliable keyboard focus and input inside the installed Plasmon iframe. Deterministic/UI tests pass, but the final packaged-browser smoke still needs a clean pass after the latest interaction changes;
- [x] command history and Up/Down recall;
- [x] Tab completion for registered commands and useful path/argument cases;
- [x] text selection and ordinary copy behavior;
- [x] visible cwd/prompt behavior;
- [x] `exit` closes/ends the active terminal session appropriately;
- [ ] Ctrl-C cancellation should be visibly and consistently proven against a cancellable command/script, not only represented in the runtime types.

### Script-file lifecycle and discoverability

- [x] `.cmd` and `.run` have explicit file classifications/associations;
- [x] double-click/normal activation executes `.cmd` and `.run` instead of silently opening them as generic text;
- [x] right-click `.cmd` exposes **Run**, **Edit**, and **Transpile to .run**;
- [x] right-click `.run` exposes **Run** and **Edit**;
- [x] Explorer background **New** can create **Command Script (.cmd)** and **Run Script (.run)** starter files;
- [x] starter templates explain the intended language and that no shebang is required;
- [x] `.cmd` can be manually transpiled to a sibling `.run` file and refuses unsafe overwrite by default;
- [x] `.run` can be opened and edited as TypeScript;
- [ ] settle whether Desktop and every other file surface should expose the same Run/Edit/New actions through one shared semantic action model rather than Explorer-only wiring.

### Monaco/editor v1 UX

- [x] `.cmd` is detected as the Plasmon command language rather than relying solely on a generic shell-script association;
- [x] `.cmd` command-name completion for the actual registered Plasmon commands;
- [x] `.cmd` hover/help text sourced from the command catalog so users can discover syntax/options;
- [x] `.run` uses TypeScript language services and completion for `os`, shell, commands, and context globals;
- [ ] expand `.cmd` completion beyond command names to useful command options and filesystem path arguments;
- [ ] make the language identity visibly say Plasmon Command/`.cmd` where Monaco UI exposes a language label, instead of implying full Bash compatibility.

### v1 verification/cleanup gate

- [x] deterministic parser/transpiler/runtime/command tests;
- [x] focused UI tests for Explorer script actions;
- [x] fast Bun suite passes on the clean branch head used for the dogfood pass;
- [x] slim build and Monaco worker packaging checks pass on that head;
- [~] packaged Neutron/PocketIC browser smoke reaches the real Explorer script menu, but the latest run failed on a Playwright locator ambiguity between `Run` and `Transpile to .run`; fix the test to use an exact `Run` match and continue the remainder of the packaged smoke;
- [ ] packaged smoke must prove Terminal input, `.cmd` execution, manual transpile, `.run` editing, and `.run` TypeScript completion on the final branch head;
- [ ] rebase/integrate with the canonical production `OsApi`, delete duplicate experimental API types/adapters, reconcile DTO differences, and rerun all gates.

## v2 — shell ergonomics and everyday scripting

v2 should make `.cmd` comfortable for repeated human use without turning it into a Bash clone. When a feature becomes programming-language complexity rather than shell ergonomics, prefer `.run`.

### Language/expansion

- [ ] `;` command separators;
- [ ] `&&` and `||` with real exit-status short-circuit semantics;
- [ ] shell variables and `$VAR` expansion with a deliberately small, documented environment model;
- [ ] command substitution `$(...)` if it can be implemented without compromising parser clarity;
- [ ] append redirection `>>` backed by a truthful append/write contract;
- [ ] stdin redirection `<`;
- [ ] stderr/basic fd redirection such as `2>` only after stdio routing is modeled cleanly;
- [ ] globbing `*`/`?` with explicit Plasmon hidden-resource, case, escaping, and ordering semantics;
- [ ] aliases with recursion protection, quoting rules, session persistence decision, and `alias`/`unalias` commands;
- [ ] command/script invocation by path with clear `.cmd` versus `.run` resolution;
- [ ] settle a PATH/command-resolution model before adding `which`/`type`.

### Completion and help

- [ ] context-aware command option completion;
- [ ] filesystem path completion using the same canonical path semantics as execution;
- [ ] completion for aliases and script files;
- [ ] richer hover/man examples generated from one command metadata source;
- [ ] command usage errors consistently include a concise usage hint;

### Additional commands

- [ ] `which` / `type` after command resolution is defined;
- [ ] `diff`;
- [ ] `cut`;
- [ ] `tr`;
- [ ] `xargs` with intentionally bounded quoting semantics;
- [ ] an interactive pager such as `less` if xterm session input is mature enough;
- [ ] truthful system-information commands for Plasmon/Neutron/runtime state where useful, without emulating Linux values that do not exist.

### Editing

- [x] v1 baseline: `edit PATH` opens the native Text Editor;
- [ ] add a lightweight terminal-native `nano`-style editor/application for users who want to stay in Terminal;
- [ ] do not add Vim merely for parity; it is not a requirement for the scripting feature.

### Runtime/process polish

- [ ] robust Ctrl-C cancellation across pipelines and `.run` scripts;
- [ ] explicit script arguments when launched from Terminal/File Manager;
- [ ] surface useful exit codes from script execution in Terminal and programmatic callers;
- [ ] decide whether command history persists across Terminal sessions;
- [ ] expose script/runtime diagnostics in a user-friendly way while keeping implementation stack traces optional/developer-facing.

### Trust and execution UX

- [ ] define provenance/trust treatment for downloaded/shared executable `.cmd` and `.run` files if normal activation remains executable-by-type;
- [ ] any warning/quarantine model must be based on actual Plasmon/Neutron provenance/capability semantics, not a fake Unix executable bit;
- [ ] keep **Edit** readily available so executable script files are never difficult to inspect before running.

## v3 — advanced automation and richer OS capabilities

v3 may add features that require broader legitimate OS/runtime capabilities. These should only land when the production authority exists; the shell must not fake them.

### Jobs and process control

- [ ] background execution with `&`;
- [ ] job table and `jobs`;
- [ ] foreground/background control (`fg`/`bg`) if the runtime can model it honestly;
- [ ] process termination commands such as `kill` only after production process-control authority exists;
- [ ] clear ownership/cancellation behavior when a Terminal window closes while work is active.

### Network and archive capabilities

- [ ] `curl`/`wget`-class HTTP commands only behind an explicit network capability/security model;
- [ ] archive create/extract support (`tar`-class UX) only after safe binary/archive APIs exist;
- [ ] storage inspection (`df`/`du`-class UX) only when truthful quota/capacity/recursive-size semantics exist;
- [ ] shortcut/link manipulation only using real Plasmon shortcut/resource semantics, never fake Unix inode/symlink behavior.

### Scheduling and automation

- [ ] persistent scheduled script execution (`at`/`cron`-class capability) only after authorization, persistence, wake/execution, logging, and failure semantics are defined;
- [ ] background/scheduled scripts must retain the same capability boundaries as interactive scripts;
- [ ] provide a durable execution/log/history surface for scheduled automation.

### Larger optional command applications/languages

These are optional v3 candidates, not promises of POSIX/GNU compatibility.

- [ ] `find`-class recursive query/action support if there is a compelling use case;
- [ ] `sed`-class stream editing only if maintaining a second mini-language is justified;
- [ ] `awk`-class processing only if justified; `.run` TypeScript remains the preferred programmable escape hatch;
- [ ] richer terminal applications may be added independently once the xterm/runtime application boundary is mature.

### `.run` growth

- [ ] reusable local modules/imports with a defined filesystem/module-resolution model;
- [ ] script libraries/packages without exposing arbitrary host/browser globals as an accidental API;
- [ ] richer typed OS capabilities as canonical `OsApi` grows;
- [ ] debugger/diagnostic affordances if Monaco/runtime integration can support them cleanly;
- [ ] explicit long-running task lifecycle and progress/event APIs where production subsystems expose them.

## Intentional non-goals across all versions

Do not add these merely to make the shell look Linux-like:

- `sudo`/`su` or a fake root user model;
- `chmod`/`chown` without a real matching Plasmon/Neutron authority model;
- fake Linux network interfaces/socket tables (`ip`, `ss`, `netstat`, `ping`) where the underlying runtime does not expose those semantics;
- fake `systemd`/kernel logs (`journalctl`, `dmesg`); future logging commands should report native Plasmon/Neutron logs;
- fake Linux `uname`, `free`, uptime, inode, symlink, UID/GID, permission-bit, or executable-bit semantics;
- full Bash compatibility as a goal. `.run` TypeScript exists specifically so control flow and real programming do not force `.cmd` to become Bash.
