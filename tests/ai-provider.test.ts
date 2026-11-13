import test from "node:test";
import assert from "node:assert/strict";
import { embedTutorQuestion } from "../src/lib/tutor-ai/gemini";
import { embedMaterialChunk } from "../src/lib/material-processing/embedding";

process.env.GEMINI_API_KEY = "synthetic-test-key-never-use-live";

test("Embedding 2 uses task prefixes and omits unsupported taskType on the actual HTTP request", async (t) => {
  const requests: Array<Record<string, unknown>> = [];
  t.mock.method(globalThis, "fetch", async (_url: unknown, init: RequestInit) => {
    requests.push(JSON.parse(String(init.body)));
    return Response.json({ embeddings: [{ values: Array(768).fill(0.1) }] });
  });
  await embedTutorQuestion("Berapa nilai akhir Rani?");
  await embedMaterialChunk("Penilaian", "Nilai akhir Rani adalah 78.");
  const query = JSON.stringify(requests[0]);
  assert.match(query, /task: question answering \| query: Berapa nilai akhir Rani\?/);
  assert.doesNotMatch(query, /taskType/);
  assert.doesNotMatch(JSON.stringify(requests[1]), /taskType/);
  assert.match(JSON.stringify(requests[1]), /title: Penilaian \| text: Nilai akhir Rani adalah 78\./);
});
