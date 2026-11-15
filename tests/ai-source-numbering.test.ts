import test from "node:test";
import assert from "node:assert/strict";
import { buildChunkSourceNumbers, getCorrectionSourceNumbers } from "../src/lib/tutor-ai/source-numbering";

test("corrections cite document numbers even when multiple chunks precede another PDF", () => {
  const numbers = buildChunkSourceNumbers([
    { chunkId: "a1", materialId: "a" },
    { chunkId: "a2", materialId: "a" },
    { chunkId: "b1", materialId: "b" },
    { chunkId: "a3", materialId: "a" },
  ]);
  assert.deepEqual([...numbers.values()], [1, 1, 2, 1]);
  assert.deepEqual(getCorrectionSourceNumbers([
    { chunkId: "a1" }, { chunkId: "a2" }, { chunkId: "b1" },
  ], numbers), [1, 2]);
});

test("correction evidence excluded from the context does not create source zero", () => {
  const numbers = buildChunkSourceNumbers([{ chunkId: "a1", materialId: "a" }]);
  assert.deepEqual(getCorrectionSourceNumbers([
    { chunkId: "omitted" }, { chunkId: "a1" },
  ], numbers), [1]);
  assert.deepEqual(getCorrectionSourceNumbers([{ chunkId: "omitted" }], numbers), []);
});
