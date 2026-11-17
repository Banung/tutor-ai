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

test("page range corrections cite only matching documents in retained context", () => {
  const chunks = [
    { chunkId: "a1", materialId: "a", pageNumber: 2 },
    { chunkId: "a2", materialId: "a", pageNumber: 3 },
    { chunkId: "b1", materialId: "b", pageNumber: 2 },
  ];
  assert.deepEqual(getCorrectionSourceNumbers([
    { kind: "page_range", materialId: "a", startPage: 2, endPage: 3 },
    { kind: "page_range", materialId: "b", startPage: 5, endPage: 8 },
  ], buildChunkSourceNumbers(chunks), chunks), [1]);
});
