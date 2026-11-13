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

test("invalid embedding dimensions are rejected before retrieval", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ embeddings: [{ values: [1, 2] }] }));
  await assert.rejects(() => embedTutorQuestion("Median?"), /tidak valid/);
});

test("stream setup has a deadline even if fetch never resolves", async (t) => {
  const { streamTutorAnswer } = await import("../src/lib/tutor-ai/gemini");
  t.mock.method(globalThis, "fetch", () => new Promise(() => {}));
  const stream = streamTutorAnswer({ systemInstruction: "Tutor", prompt: "Median?", timeoutMs: 30 });
  await assert.rejects(() => stream.next(), { name: "TimeoutError" });
});

test("a stalled stream read is covered by the same total deadline", async (t) => {
  const { streamTutorAnswer } = await import("../src/lib/tutor-ai/gemini");
  t.mock.method(globalThis, "fetch", async () => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('data: {"candidates":[{"content":{"parts":[{"text":"Awal jawaban"}]}}]}\n\n'));
    },
  }), { headers: { "Content-Type": "text/event-stream" } }));
  const stream = streamTutorAnswer({ systemInstruction: "Tutor", prompt: "Median?", timeoutMs: 100 });
  assert.equal((await stream.next()).value, "Awal jawaban");
  await assert.rejects(() => stream.next(), { name: "TimeoutError" });
});

test("caller cancellation stops a pending provider call", async (t) => {
  const { streamTutorAnswer } = await import("../src/lib/tutor-ai/gemini");
  t.mock.method(globalThis, "fetch", () => new Promise(() => {}));
  const cancellation = new AbortController();
  const stream = streamTutorAnswer({ systemInstruction: "Tutor", prompt: "Median?", signal: cancellation.signal });
  const pending = stream.next();
  cancellation.abort();
  await assert.rejects(() => pending, { name: "AbortError" });
});

test("truncated or empty provider responses cannot be treated as complete", async (t) => {
  const { streamTutorAnswer, generateTutorAnswer } = await import("../src/lib/tutor-ai/gemini");
  const response = { candidates: [{ content: { parts: [{ text: "Belum selesai" }] }, finishReason: "MAX_TOKENS" }] };
  t.mock.method(globalThis, "fetch", async (url: unknown) => String(url).includes("streamGenerateContent")
    ? new Response(`data: ${JSON.stringify(response)}\n\n`, { headers: { "Content-Type": "text/event-stream" } })
    : Response.json({ candidates: [{ content: { parts: [] }, finishReason: "STOP" }] }));
  const stream = streamTutorAnswer({ systemInstruction: "Tutor", prompt: "Median?" });
  assert.equal((await stream.next()).value, "Belum selesai");
  await assert.rejects(() => stream.next(), /normal/);
  await assert.rejects(() => generateTutorAnswer({ systemInstruction: "Tutor", prompt: "Median?" }), /kosong/);
});
