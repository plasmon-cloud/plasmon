import { describe, expect, test } from "bun:test";
import { shellCommandHelp } from "../command/catalog.ts";
import { cmdCommandCompletions, cmdHoverHelp, cmdOptionCompletions } from "./monaco.ts";

describe("Plasmon Command Monaco help", () => {
  test("offers supported command names without hidden status helpers", () => {
    const labels = cmdCommandCompletions("").map((entry) => entry.name);
    expect(labels).toContain("ls");
    expect(labels).toContain("touch");
    expect(labels).toContain("man");
    expect(labels).not.toContain("true");
    expect(labels).not.toContain("false");
  });

  test("offers familiar ls flags after `ls -`", () => {
    const labels = cmdOptionCompletions("ls", "-").map((option) => option.flag);
    expect(labels).toContain("-l");
    expect(labels).toContain("-a");
    expect(labels).toContain("-la");
  });

  test("filters options by the text already typed", () => {
    expect(cmdOptionCompletions("cat", "-n").map((option) => option.flag)).toEqual(["-n"]);
    expect(cmdOptionCompletions("cat", "-x")).toEqual([]);
  });

  test("hover uses the same catalog entry as man/help", () => {
    const catalogEntry = shellCommandHelp("ls");
    expect(catalogEntry).not.toBeNull();
    expect(cmdHoverHelp("ls")).toBe(catalogEntry);
    expect(cmdHoverHelp("not-a-command")).toBeNull();
  });
});
