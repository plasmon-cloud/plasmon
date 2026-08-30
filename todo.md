# `.cmd` / `.run` roadmap and acceptance ledger

This is the working backlog for `experiment/cmd`. It records the desired product surface and the concrete dogfood acceptance requirements so future developers do not need the original chat to reconstruct intent.

The version labels are capability stages, not Plasmon release numbers.

Status convention:

- `[x]` implemented and covered at the lowest practical deterministic layer;
- `[~]` implementation exists but still needs packaged-browser or manual interaction proof;
- `[ ]` desired but not implemented;
- `[BLOCKED]` required product capability cannot be truthfully implemented by this scripting layer yet.

Read with:

- `apps/plasmon/src/scripting/README.md` — subsystem orientation;
- `apps/plasmon/src/scripting/DESIGN.md` — architecture/rationale;
- `apps/plasmon/src/scripting/V1.md` — original frozen v1 language contract;
- `apps/plasmon/src/scripting/VOICE_DOGFOOD_ACCEPTANCE.md` — line-by-line reconciliation of the two voice dogfood passes.

The dogfood pass expanded the original v1 usability contract. Where this file and the older `V1.md` differ on usability scope, this ledger is the active experiment target.

# v1 — useful Plasmon shell and executable scripts

## Voice-dogfood acceptance ledger

Every concrete issue/expectation from the two dogfood voice notes is represented here.

### Terminal interaction and presentation

- [~] **Recognizable Terminal taskbar icon.** `native:terminal` uses the dedicated terminal SVG; final packaged/manual proof must show it actually renders in the taskbar rather than falling back/appearing blank.
- [~] **Autofocus on launch.** Opening Terminal must put keyboard focus in xterm immediately, PuTTY-style, with no extra click.
- [~] **Focus retained after Enter.** Every completed command must return a prompt that is immediately typeable; Enter must not strand focus.
- [~] **Window/content click restores typing focus.** Clicking back into Terminal must restore xterm input without resetting cwd/history/session state.
- [~] **Terminal text selection works.** Output must be selectable with normal pointer interaction.
- [~] **Standard copy/paste works.** Use ordinary browser/OS terminal clipboard conventions; do not invent Enter-to-copy unless deliberately designed later.
- [x] **Use a real terminal surface.** xterm owns presentation/input; command/runtime semantics stay independent of xterm.
- [x] **cwd is obvious.** Prompt visibly contains cwd, changes after `cd`, and `pwd` remains available.
- [x] **Successful mutation commands may be quiet.** `mkdir`, `mv`, `rm`, etc. follow normal Unix-style silence on success, but the next prompt must visibly return and `help` explains the convention.
- [x] **Errors are explicit.** Failures return readable stderr and user-facing terminology says `OS API`, not implementation spelling such as `OsApi`.
- [x] **Filesystem case behavior is deliberate.** The shell inherits canonical Plasmon filesystem/path case semantics; it does not invent a second Linux-style case-sensitive namespace.

### Commands discovered during dogfood

- [x] `ls` is a core command and works without flags.
- [x] `ls -a`, `ls -l`, `ls -h`, and combined forms such as `ls -lah`.
- [x] `touch` for simple create-if-missing behavior without fake Unix timestamp semantics.
- [x] pipes with `|`.
- [x] overwrite redirection with `>` so commands such as `echo hello > hello.txt` create/write files.
- [x] `open PATH` remains intentionally Plasmon-native and is documented as desktop-open behavior analogous to `xdg-open`/macOS `open`, not a claim of GNU coreutils parity.
- [x] pretty default `help`, including the explicit note that successful mutation commands are normally silent.
- [x] every registered command has `man COMMAND` / `help COMMAND` generated from the same command metadata.
- [x] `true` and `false` remain available for exit status composition but are hidden from beginner/default help.
- [~] `exit [STATUS]` closes/ends the interactive Terminal session; deterministic behavior exists, packaged interaction proof remains.
- [x] `mv SOURCE DESTINATION` supports real move **and rename** behavior rather than only “move into existing directory”.
- [x] quoted paths with spaces are part of the command grammar; filenames such as `"File Manager.sys"` must be quoted like an ordinary shell.
- [x] protected resources remain protected through `rm`/`mv`/`cp`; shell flags never bypass canonical policy.

### Common-option compatibility audit

The v1 goal is not GNU compatibility. It is that familiar commands have the common flags users will naturally try **when those flags have truthful Plasmon semantics**, and unsupported flags fail clearly instead of being silently ignored.

Frozen v1 option matrix:

- [x] `ls -a -l -h` and combined forms;
- [x] `cat -n`;
- [x] `mkdir -p`;
- [x] `cp -r` / `cp -R` as familiar spellings for canonical directory copy;
- [x] `rm -r` / `-R` / `-f`, including combined `-rf`;
- [x] `grep -i` / `-n`, including combined `-in`;
- [x] `head -n N`;
- [x] `tail -n N`;
- [x] `wc -l` / `-w` / `-c`, including combined forms;
- [x] `sort -r`;
- [x] `uniq -c`;
- [x] `tee -a`.

Commands without a useful truthful v1 flag surface (`pwd`, `cd`, `touch`, `mv`, `echo`, `ps`, `clear`, `history`, `open`, `edit`, `help`, `man`, `exit`) reject unsupported options/extra arguments with useful guidance instead of faking POSIX/GNU behavior.

### Script-file and editor dogfood

- [x] no shebang/hashbang is required; `.cmd`/`.run` associations already choose the runtime.
- [~] double-click/normal activation of `.cmd` executes it instead of opening generic text; packaged proof remains.
- [~] double-click/normal activation of `.run` executes it; packaged proof remains.
- [~] right-click `.cmd` exposes **Run**, **Edit**, and **Transpile to .run**; packaged proof remains.
- [~] right-click `.run` exposes **Run** and **Edit**; packaged proof remains.
- [~] Explorer background **New** creates **Command Script (.cmd)** and **Run Script (.run)** templates; packaged proof remains.
- [x] templates explain the language and do not imply a shebang is necessary.
- [x] `edit PATH` opens the existing native Text Editor, providing a v1 terminal-to-editor workflow without building a second editor.
- [x] `.cmd` command-name completion is based on the real Plasmon command catalog.
- [ ] `.cmd` option completion is based on the same command metadata as `man`/`help`.
- [x] `.cmd` command hover describes the real Plasmon command/usage rather than generic Bash behavior.
- [ ] visible editor mode for `.cmd` says **Plasmon Command (.cmd)** where the editor shows a language label; Monaco may reuse its shell tokenizer internally.
- [x] `.run` is edited as TypeScript and receives typed completion for implicit runtime globals/`OsApi`.
- [ ] keep `.run` ambient command declarations synchronized with every v1 command factory (`touch`, `edit`, `man`, etc.).
- [x] Nano is **not required for v1** because `edit PATH` reaches the real native editor; a terminal-native Nano-style application is a v2 usability feature.
- [x] aliases are **not required for v1**; they are v2 because they require expansion, recursion, quoting, and session-persistence semantics rather than basic file editing.

## Architecture and runtime

- [x] `.cmd` is a small shell-like convenience language, not Bash compatibility.
- [x] `.cmd` parses locally and genuinely transpiles to readable `.run` TypeScript before execution.
- [x] `.run` is real TypeScript with an implicit `RunContext`, not a private intermediate DSL.
- [x] `OsApi`, `RunContext`, command/runtime mechanics, browser presentation, and test-only powers remain separate layers.
- [x] the experiment consumes canonical production `src/os/api` contracts/adapter; the old duplicate compatibility contract/adapter has been removed. `src/scripting/os-api/declarations.ts` is only a Monaco declaration projection and must stay synchronized with canonical contracts until generation replaces it.
- [x] canonical `os.fs.list()` exists and backs `ls`; hidden-entry selection remains a production list option, while formatting/sorting are shell concerns.
- [x] canonical filesystem operations used by v1 include stat/exists/list/readText/writeText/createDirectory/copy/move/rename/remove.
- [x] canonical open operations used by v1 include default `open` and explicit `openWith` for `edit`.
- [x] reuse the packaged Monaco TypeScript worker/compiler for `.run`; no second TS compiler or runtime CDN dependency.
- [x] keep the `.cmd` parser local and intentionally small; no runtime shell-parser download.
- [x] `RunContext` carries an `AbortSignal`; full interactive Ctrl-C cancellation behavior is v2 runtime polish.
- [x] scripting never bypasses normal Plasmon/Neutron filesystem, protection, association, process, or installation authorities.

## `.cmd` v1 syntax

- [x] whitespace-separated arguments;
- [x] single-quoted arguments;
- [x] double-quoted arguments;
- [x] basic backslash escaping;
- [x] `#` line comments;
- [x] newline-separated sequencing;
- [x] pipelines `|`;
- [x] overwrite stdout redirection `>`;
- [x] absolute paths and cwd-relative paths;
- [x] command exit status propagation;
- [x] multiline `.cmd` execution is fail-fast by default when a generated pipeline returns nonzero;
- [x] explicit `exit [STATUS]`;
- [x] unsupported shell syntax fails explicitly rather than being silently misparsed;
- [x] no shebang requirement.

## `.run` v1 context

- [x] `os`;
- [x] command factories/registry access;
- [x] shell/pipeline helpers;
- [x] `args`;
- [x] stdin/stdout/stderr abstractions;
- [x] cancellation signal;
- [x] `print(...)`;
- [~] Monaco declarations/completion for the runtime context; declarations work but the v1 command-factory projection must be kept fully synchronized as commands are added.

## v1 command inventory

Filesystem/navigation:

- [x] `pwd`
- [x] `cd`
- [x] `ls`
- [x] `mkdir`
- [x] `touch`
- [x] `cp`
- [x] `mv`
- [x] `rm`
- [x] `cat`
- [x] `open`
- [x] `edit`

Text/pipeline:

- [x] `echo`
- [x] `grep`
- [x] `head`
- [x] `tail` (no live follow in v1)
- [x] `wc`
- [x] `sort`
- [x] `uniq`
- [x] `tee`

Session/OS/help:

- [x] `ps` using truthful Plasmon native process records
- [x] `clear`
- [x] `history`
- [x] `help`
- [x] `man`
- [x] `true`
- [x] `false`
- [x] `exit`

## v1 package/provisioning capability

A useful v1 is intended to drive a basic base-system/application provisioning script, not only manipulate already-installed files.

- [BLOCKED] `pkg list` through one truthful production package/application authority.
- [BLOCKED] `pkg install <package-or-source>` through the real owner-reviewed/Kernel installation authority with a truthful completion contract.
- [BLOCKED] `pkg remove <package>` through a supported production removal authority.
- [x] do **not** invent a scripting-only package database or bypass Neutron installation/security ownership.
- [BLOCKED] prove a complete idempotent package-install/remove base-system example once the production authority exists.
- [x] filesystem/configuration portion of a base-system script is expressible today with `.cmd`; conditionals/idempotence use `.run` TypeScript.

The blocker is architectural: current Neutron exposes discovery/install-offer behavior but not one generalized application-facing list/install/remove package authority. Scripting must report this gap, not fake it.

## Terminal v1 UX

- [x] xterm-backed presentation/input;
- [~] packaged launch focus;
- [~] focus retained after Enter;
- [~] click-to-refocus behavior;
- [x] Up/Down session history;
- [x] Tab completion for registered command names and current terminal completion cases;
- [~] text selection and ordinary copy/paste — xterm provides the surface; final packaged/manual acceptance still required;
- [x] visible cwd prompt;
- [~] `exit` closes the active terminal window/session in packaged UI;
- [x] dedicated Terminal icon asset and app definition;
- [~] icon renders recognizably in the packaged taskbar rather than falling back;
- [x] command errors render in stderr and successful quiet commands return the prompt.

## Script-file lifecycle and discoverability

- [x] `.cmd` and `.run` classifications/associations;
- [~] normal activation executes `.cmd`;
- [~] normal activation executes `.run`;
- [~] `.cmd` Run/Edit/Transpile actions;
- [~] `.run` Run/Edit actions;
- [~] Explorer New `.cmd` / New `.run` starter files;
- [x] safe `.cmd` -> sibling `.run` transpile with overwrite refusal;
- [x] `.run` opens/edits as TypeScript;
- [x] `edit PATH` opens native Text Editor;
- [ ] broader Desktop/other file-surface action convergence is useful but is **not a v1 blocker**; move to v2/shared-file-action cleanup unless a concrete v1 surface is broken.

## Monaco/editor v1 UX

- [x] `.cmd` uses shell tokenization only as an implementation detail and installs Plasmon-specific completion/hover providers;
- [x] command-name completion from command catalog;
- [ ] option completion from command catalog metadata;
- [x] hover/usage from command catalog;
- [ ] visible status/mode label says `Plasmon Command (.cmd)`;
- [x] `.run` TypeScript language services;
- [x] `os.` completion exposes canonical production API members;
- [ ] ambient `RunCommandFactory` declaration contains every v1 command factory.
- [x] filesystem path completion in Monaco is **not required for v1**; it moves to v2 alongside richer context-aware completion.

## v1 verification gate

- [x] deterministic parser/transpiler/runtime/command tests;
- [x] focused UI tests for Explorer script actions;
- [x] fast Bun suite passed on the pre-ledger dogfood head;
- [x] slim build and TypeScript-worker packaging passed on the pre-ledger dogfood head;
- [ ] fix packaged Playwright `Run` locator to exact match so it does not collide with `Transpile to .run`;
- [ ] packaged smoke proves Terminal taskbar icon asset/binding is present;
- [ ] packaged smoke proves Terminal autofocus and focus retention after Enter;
- [ ] packaged/manual acceptance proves selection/copy/paste behaves like a normal terminal;
- [ ] packaged smoke proves simple Terminal command and cwd update;
- [ ] packaged smoke proves New `.cmd`, Run/Edit/Transpile actions, generated `.run`, `.run` Edit, and TypeScript `os.` completion;
- [ ] packaged smoke proves normal activation executes `.cmd` and `.run` or a focused deterministic/browser test proves the association path without duplicating semantics;
- [ ] final deterministic suite passes after all v1 ledger changes;
- [ ] final slim/package/worker checks pass after all v1 ledger changes;
- [ ] sync/merge the **current** #631 head again before final acceptance while #631 remains open, then rerun gates; once #631 lands on `release/0.1.0-r3`, switch the experiment base relationship to R3.
- [BLOCKED] package-provisioning acceptance remains blocked until production installation/removal authority exists.

# v2 — shell ergonomics and everyday scripting

v2 should make `.cmd` comfortable for repeated human use without turning it into a Bash clone. If a feature becomes programming-language complexity, prefer `.run` TypeScript.

## Language/expansion

- [ ] `;` command separators;
- [ ] `&&` / `||` short-circuit semantics;
- [ ] shell variables and `$VAR` expansion with a deliberately small environment model;
- [ ] command substitution `$(...)` if parser clarity can be preserved;
- [ ] append redirection `>>` backed by a truthful append/write contract;
- [ ] stdin redirection `<`;
- [ ] stderr/basic fd redirection such as `2>` only after stdio routing is modeled cleanly;
- [ ] globbing `*`/`?` with explicit Plasmon hidden-resource, case, escaping, and ordering semantics;
- [ ] aliases plus `alias`/`unalias`, recursion protection, quoting rules, and a session-persistence decision;
- [ ] command/script invocation by path with clear `.cmd` versus `.run` resolution;
- [ ] settle PATH/command resolution before `which`/`type`.

## Completion/help

- [ ] context-aware option completion beyond the v1 command/option baseline;
- [ ] filesystem path completion in Monaco and Terminal using canonical path semantics;
- [ ] alias/script-file completion;
- [ ] richer examples in hover/man from one metadata source;
- [ ] concise usage hints consistently attached to argument/option errors.

## Additional commands

- [ ] `which` / `type` after command resolution is defined;
- [ ] `diff`;
- [ ] `cut`;
- [ ] `tr`;
- [ ] `xargs` with intentionally bounded quoting semantics;
- [ ] interactive pager such as `less` once terminal session input is mature;
- [ ] truthful Plasmon/Neutron/runtime information commands where useful.

## Editing

- [x] v1 baseline: `edit PATH` opens native Text Editor;
- [ ] lightweight terminal-native Nano-style editor/application;
- [ ] Vim is not required merely for parity.

## Runtime/process polish

- [ ] robust Ctrl-C cancellation across running pipelines and `.run` scripts;
- [ ] script arguments when launched from Terminal/File Manager;
- [ ] useful exit-code presentation/programmatic access;
- [ ] decide whether command history persists across Terminal sessions;
- [ ] friendlier runtime diagnostics with optional developer stack details;
- [ ] shared semantic Run/Edit/New actions across Explorer/Desktop/other file surfaces.

## Trust/execution UX

- [ ] provenance/trust treatment for downloaded/shared executable `.cmd`/`.run` resources if needed;
- [ ] base any warning/quarantine model on real Plasmon/Neutron provenance/capability semantics, never a fake Unix executable bit;
- [ ] keep Edit readily available so executable scripts are easy to inspect.

# v3 — advanced automation and richer OS capabilities

These land only when the corresponding legitimate production authority exists.

## Jobs/process control

- [ ] background `&`;
- [ ] `jobs` table;
- [ ] `fg` / `bg` if the runtime can model them honestly;
- [ ] `kill`/process termination only after production process-control authority exists;
- [ ] ownership/cancellation rules when Terminal closes during active work.

## Network/archive/storage

- [ ] `curl`/`wget`-class HTTP commands behind an explicit network capability/security model;
- [ ] archive create/extract (`tar`-class UX) after safe binary/archive APIs exist;
- [ ] `df`/`du`-class storage inspection only with truthful capacity/quota/recursive-size semantics;
- [ ] link/shortcut manipulation using real Plasmon shortcut/resource semantics, never fake Unix inode/symlink behavior.

## Scheduling/automation

- [ ] persistent scheduled execution (`at`/`cron`-class) after authorization, persistence, wake/execution, logging, and failure semantics are defined;
- [ ] scheduled/background scripts retain the same capability boundaries as interactive scripts;
- [ ] durable execution/log/history surface for scheduled automation.

## Larger optional command applications/languages

- [ ] `find`-class recursive query/action support if justified;
- [ ] `sed`-class stream editing only if a second mini-language is justified;
- [ ] `awk`-class processing only if justified; `.run` remains the preferred programmable escape hatch;
- [ ] richer terminal applications after the xterm/application boundary is mature.

## `.run` growth

- [ ] reusable local modules/imports with defined filesystem/module resolution;
- [ ] script libraries/packages without accidentally exposing arbitrary browser globals as API;
- [ ] richer typed OS capabilities as canonical `OsApi` grows;
- [ ] debugger/diagnostic affordances if Monaco/runtime can support them cleanly;
- [ ] explicit long-running task lifecycle/progress/event APIs when production subsystems expose them.

# Intentional non-goals across all versions

Do not add these merely to make the shell look Linux-like:

- fake `sudo`/`su` or root-user model;
- `chmod`/`chown` without a matching real authority/security model;
- fake Linux network interfaces/socket tables (`ip`, `ss`, `netstat`, raw `ping`) where the runtime does not expose them;
- fake systemd/kernel logs (`journalctl`, `dmesg`); future logging commands report native Plasmon/Neutron logs;
- fake Linux `uname`, `free`, uptime, inode, symlink, UID/GID, permission-bit, or executable-bit semantics;
- full Bash compatibility as a goal. `.run` TypeScript exists so real control flow/programming does not force `.cmd` to become Bash.
