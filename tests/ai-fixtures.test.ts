import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import dataset from "./fixtures/ai/questions.json";

test("evaluation cases have unique identities, expected answers and existing PDF references", () => {
  assert.equal(dataset.cases.length, 25);
  assert.equal(new Set(dataset.cases.map((item) => item.id)).size, 25);
  for (const item of dataset.cases) {
    assert.ok(item.question.trim());
    assert.ok(item.expected_answer.trim());
    for (const source of item.expected_sources) {
      const path = join("tests/fixtures/ai", source.file);
      assert.ok(existsSync(path));
      assert.equal(readFileSync(path).subarray(0, 5).toString(), "%PDF-");
      assert.ok(source.page > 0);
    }
  }
});
