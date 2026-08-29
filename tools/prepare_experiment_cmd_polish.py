from pathlib import Path

path = Path("tools/experiment_cmd_polish.py")
text = path.read_text()
replacements = [
    ("    '''export interface ShellCommandHelp {", "    r'''export interface ShellCommandHelp {"),
    ("    '''import { VISIBLE_SHELL_COMMANDS, shellCommandHelp } from \"../command/catalog.ts\";", "    r'''import { VISIBLE_SHELL_COMMANDS, shellCommandHelp } from \"../command/catalog.ts\";"),
    ("    '''import { useEffect, useRef, useState, type CSSProperties } from \"react\";", "    r'''import { useEffect, useRef, useState, type CSSProperties } from \"react\";"),
]
for old, new in replacements:
    if text.count(old) != 1:
        raise SystemExit(f"expected one escaping target, got {text.count(old)}: {old}")
    text = text.replace(old, new, 1)
path.write_text(text)
print("Prepared dogfood polish generator escaping")
