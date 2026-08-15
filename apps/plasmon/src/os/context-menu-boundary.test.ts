import { describe, expect, test } from "bun:test";
import { resolveFirstPartyContextMenuOwnership } from "./context-menu-boundary.ts";

describe("first-party context-menu ownership", () => {
  test("claims only owned non-editable non-foreign surfaces", () => {
    expect(resolveFirstPartyContextMenuOwnership({ owned: true, editable: false, foreign: false })).toBe("claim");
    expect(resolveFirstPartyContextMenuOwnership({ owned: false, editable: false, foreign: false })).toBe("pass");
    expect(resolveFirstPartyContextMenuOwnership({ owned: true, editable: true, foreign: false })).toBe("pass");
    expect(resolveFirstPartyContextMenuOwnership({ owned: true, editable: false, foreign: true })).toBe("pass");
  });
});
