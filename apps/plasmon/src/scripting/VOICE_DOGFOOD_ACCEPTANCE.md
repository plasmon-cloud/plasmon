# `.cmd` / `.run` dogfood acceptance ledger

This ledger is the explicit reconciliation of the first two voice-dogfood passes against the current experiment. `todo.md` is the authoritative versioned backlog; this file preserves the individual usability observations so none are lost when backlog items are regrouped.

Status meanings: **done** = implemented and deterministically covered where practical; **browser** = implementation exists but the installed browser path still needs proof; **manual** = visual/interaction acceptance needs a human check; **deferred** = deliberately assigned to v2/v3 with rationale; **blocked** = requires a production authority outside the scripting layer.

## Terminal dogfood pass

| Observation / expectation | Required outcome | Current disposition |
| --- | --- | --- |
| Terminal taskbar icon was missing/unrecognizable | Terminal must have recognizable terminal artwork in taskbar/start/search and the asset must package correctly | browser/manual — `native:terminal` uses `SYSTEM_ICON_ASSETS.terminal`; packaged asset exists; final browser/visual proof remains |
| Opening Terminal did not focus typing | xterm input receives focus immediately after launch | browser — implementation calls `terminal.focus()` after fit; packaged assertion required |
| Enter caused input to lose focus | after every completed command the next prompt is immediately typeable | browser — implementation refocuses after submit; packaged assertion required |
| Could not select/copy/paste output | ordinary xterm selection plus standard browser/OS copy and paste must work | browser/manual — xterm surface is present; explicit packaged/manual acceptance still required |
| Window clicking felt strange / typing focus was easy to lose | clicking the Terminal content/window should restore a usable terminal input focus without resetting session state | browser/manual |
| `ls` appeared unavailable | `ls` is a core v1 command | done |
| `cd` gave weak location feedback | prompt visibly includes cwd and changes after `cd`; `pwd` remains available | done; browser proof remains in final smoke |
| `ls -l` did not work | familiar, useful options must exist where they map truthfully; `ls -a/-l/-h` and combined forms are v1 | done |
| commands such as `mkdir` were silent and confusing | keep normal Unix-style silence on success, but always return a prompt and document this clearly in `help`/`man` | done; prompt continuity browser proof remains |
| no `touch` | provide simple create-if-missing `touch` without fake timestamp semantics | done |
| needed pipes/redirection for file creation | `|` and overwrite `>` are v1 and compose through `.run` | done |
| `open` felt non-Linux | retain `open` as a Plasmon-native desktop command and explain that it is analogous to `xdg-open`/macOS `open` | done in command manual metadata |
| `help` was just a bare list | pretty-print command summaries and tell the user how to get manuals | done |
| every command needs a manual | `man COMMAND` and `help COMMAND` use one command metadata source; every registered v1 command has an entry | done; option metadata should remain synchronized |
| `true`/`false` cluttered beginner help | keep status primitives available but hide them from default help | done |
| `exit` did not close Terminal | `exit [STATUS]` terminates/closes the interactive terminal session | done; packaged proof required |
| filesystem looked case-insensitive | make an explicit decision rather than accidentally emulating Linux | done — shell inherits canonical Plasmon filesystem/path case behavior; it does not create a second case-sensitive namespace |
| `mv` to a new filename failed | support move **and rename** while delegating stable identity/protection to canonical filesystem APIs | done; keep quoted-space path coverage |
| protected `rm` correctly failed | preserve protection and Recycle Bin semantics | done |
| error said `OsApi` | user-visible wording is `OS API` | done |
| homemade terminal UX felt wrong; xterm acceptable if not huge | use xterm only for presentation/input, leaving command/runtime independent | done |
| familiar commands need useful flags | audit every v1 command for common flags that are useful and truthful; unsupported flags fail with a usage/manual hint rather than being ignored | done for the frozen v1 option matrix; keep this as a regression check |

### Frozen v1 option matrix from the dogfood requirement

- `ls -a -l -h`, including combinations such as `-lah`;
- `cat -n`;
- `mkdir -p`;
- `cp -r` / `cp -R` as familiar directory-copy spellings over canonical recursive copy semantics;
- `rm -r` / `-R` / `-f`, including combined `-rf`, without bypassing protection/Trash policy;
- `grep -i -n`, including combined `-in`;
- `head -n N`;
- `tail -n N`;
- `wc -l -w -c`, including combinations;
- `sort -r`;
- `uniq -c`;
- `tee -a`.

Commands without meaningful v1 flags (`pwd`, `cd`, `touch`, `mv`, `echo`, `ps`, `clear`, `history`, `open`, `edit`, `help`, `man`, `exit`) must reject unsupported options/extra arguments clearly instead of pretending to implement GNU/POSIX compatibility.

## Script/editor dogfood pass

| Observation / expectation | Required outcome | Current disposition |
| --- | --- | --- |
| `.cmd` had no useful autocomplete | complete actual Plasmon command names; v1 also completes documented options | command completion done; option completion is a v1 ledger item |
| hovering commands gave no help | hover uses the same command catalog as `man` | done |
| editor identified `.cmd` as generic shell | visible editor UX should say **Plasmon Command (.cmd)** while it may reuse Monaco's shell tokenizer internally | v1 item |
| uncertainty about hashbang | no shebang required; extension/association selects runtime | done |
| double-click `.cmd` opened text editor | normal activation executes `.cmd`; Edit remains explicit | done; packaged proof required |
| no right-click Run/Execute | `.cmd`: Run/Edit/Transpile; `.run`: Run/Edit | done; packaged proof required |
| no easy New command/run file | Explorer New offers starter `.cmd` and `.run` templates | done; packaged proof required |
| no obvious way to execute `.run` | `.run` is an executable association and can be run from file actions | done; packaged proof required |
| need to edit files from terminal | `edit PATH` opens the native Text Editor | done |
| Nano would be useful | terminal-native Nano-style editor is v2; v1 already has `edit PATH` and native Monaco/Text Editor | deferred to v2 because an interactive editor is a separate terminal application, not needed to prove scripting |
| aliases would be useful | aliases are v2 | deferred to v2 because they require expansion/session persistence/recursion/quoting semantics rather than basic file editing |
| `.cmd` should teach its own language | starter templates, completion, hover, help/man, and visible language label describe only supported Plasmon Command syntax | mostly done; visible language label/option completion remain v1 checks |

## v1 external blocker

Package provisioning remains blocked by the production authority boundary. The scripting layer must not invent `pkg install/remove` until Plasmon/Neutron exposes a truthful generalized application installation/removal authority. This is an explicit v1 product gap, not permission to create a fake package manager.
