import test from "node:test";
import assert from "node:assert/strict";
import { getInvitationReturnPath } from "../src/lib/invitation-return-path";

test("accepts generated invitation paths", () => {
  const path = `/invite/${"a".repeat(41)}_-`;
  assert.equal(getInvitationReturnPath(path), path);
});

test("rejects external, encoded, and unrelated destinations", () => {
  for (const path of [null, "", "https://evil.test", "//evil.test", "/admin", "/invite/../admin", `/invite/${"a".repeat(43)}?next=https://evil.test`, "/invite/%2f%2fevil.test"]) {
    assert.equal(getInvitationReturnPath(path), null);
  }
});
