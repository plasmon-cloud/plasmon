# Plasmon scripting

Plasmon supports two complementary script formats:

- **`.cmd`** is a small, shell-like command language for interactive commands,
  linear scripts, pipelines, and redirected output.
- **`.run`** is TypeScript with an implicit Plasmon runtime context for
  conditionals, loops, functions, data structures, and typed OS operations.

`.cmd` is intentionally focused rather than a Bash implementation. Use `.run`
when a workflow needs general programming language features.

## Using scripts

Explorer can create command and run scripts. A script can be opened with its
associated application, run from its context menu, or opened for editing.
Command scripts can also be transpiled to an adjacent `.run` file. Transpiled
source is ordinary, readable TypeScript and may be edited before it is run.

The Terminal provides command completion and `help`/`man` documentation from
the same command catalog used by the runtime. `.cmd` files are identified as
**Plasmon Command** in the editor; `.run` files use TypeScript with completion
for the implicit runtime values.

## `.cmd` syntax

Supported syntax includes:

- whitespace-separated arguments with single- or double-quoted strings;
- backslash escapes and `#` comments at the start of a command;
- pipelines with `|`;
- stdout redirection with `>`;
- one command per line.

The command runtime supports filesystem operations, text processing, resource
opening, process inspection, session history, and help. Filesystem mutations,
opening, and removal always use the normal Plasmon authorities, including
identity, protection, association, and Recycle Bin policy.

Unsupported shell operators fail clearly. `.cmd` execution is fail-fast: a
non-zero pipeline status stops the generated script.

## `.run` runtime

A `.run` module receives these ambient values:

- `os` — the production OS API for filesystem, open, process, and window
  operations;
- `commands` and `shell` — command factories and pipelines;
- `args`, `stdin`, `stdout`, `stderr`, and `signal` — execution context;
- `print()` — a convenience function that writes one line to stdout.

`.ts` files remain ordinary TypeScript and do not receive these bindings.

## Architecture

The scripting layer owns parsing, transpilation, command sessions, and the
`.run` execution bridge. `OsApi` remains the stable capability boundary and is
implemented by the existing Plasmon filesystem, association, process, window,
and open authorities. Terminal and Explorer provide presentation and file
lifecycle integration without reimplementing those authorities.

Focused parser, runtime, service, Monaco, and UI tests live beside the
implementation. Packaged browser tests cover the Monaco worker and installed
script activation path where real browser behavior is required.
