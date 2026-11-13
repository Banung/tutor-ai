import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/synthetic_no_database";
process.env.GEMINI_API_KEY = "synthetic-test-key-never-use-live";

const chunk = {
  chunkId: "chunk-1", materialId: "material-1", sessionId: "lesson-1",
  pageNumber: 2, chunkIndex: 0, content: "Nilai Rani adalah 78.", similarity: 0.8,
  materialTitle: "Penilaian", fileName: "01-statistika-digital.pdf", sessionTitle: "Penilaian",
};

async function harness(t: TestContext, options: {
  chunks?: typeof chunk[];
  selected?: string[];
  history?: Array<{ senderType: string; content: string }>;
  answer?: string;
  denyAccess?: boolean;
  transactionFailure?: boolean;
  finishReason?: string;
  streamHang?: boolean;
} = {}) {
  const { default: prisma } = await import("../src/lib/prisma");
  function replace(target: object, key: string, value: unknown) {
    const record = target as Record<string, unknown>;
    const original = record[key];
    record[key] = value;
    t.after(() => { record[key] = original; });
  }
  const { askTutorStream } = await import("../src/lib/tutor-ai/service");
  const saved: Array<Record<string, unknown>> = [];
  const deleted: unknown[] = [];
  const queries: Array<{ strings: string[]; values: unknown[] }> = [];
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  replace(prisma.user, "findUnique", async () => ({ id: "student", name: "Rani", role: "mahasiswa", academicLevel: "S1" }));
  replace(prisma.course, "findFirst", async () => options.denyAccess ? null : ({ id: "course", title: "Statistika Dasar", description: null, isActive: true }));
  replace(prisma.material, "findMany", async () => [{ id: "material-1", title: "Penilaian", fileName: chunk.fileName, pageCount: 3, chunkCount: 4, createdAt: new Date(), courseSession: { id: "lesson-1", title: "Penilaian", orderNumber: 1 } }] );
  replace(prisma.aiChatSession, "findFirst", async () => ({ id: "chat", messages: [] }));
  replace(prisma.aiChatSession, "update", async () => ({}));
  replace(prisma.aiChatMessage, "findFirst", async () => ({ content: JSON.stringify(options.selected ?? ["material-1"]) }));
  replace(prisma.aiChatMessage, "findMany", async () => [...(options.history ?? [])].reverse());
  replace(prisma.aiChatMessage, "create", async ({ data }: { data: Record<string, unknown> }) => { saved.push(data); return data; });
  replace(prisma.aiChatMessage, "delete", async (args: unknown) => { deleted.push(args); return {}; });
  replace(prisma.tutorPromptConfig, "findUnique", async () => null);
  replace(prisma, "$transaction", async (callback: (tx: typeof prisma) => Promise<unknown>) => { if (options.transactionFailure) throw new Error("synthetic transaction failure"); return callback(prisma); });
  replace(prisma, "$queryRaw", async (strings: TemplateStringsArray, ...values: unknown[]) => { queries.push({ strings: [...strings], values }); return options.chunks ?? [chunk]; });
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    requests.push({ url: String(url), body });
    if (String(url).toLowerCase().includes("embedcontent")) {
      return Response.json({ embeddings: [{ values: Array(768).fill(0.1) }] });
    }
    const response = { candidates: [{ content: { role: "model", parts: [{ text: options.answer ?? "Nilai Rani 78. [Sumber 1]" }] }, finishReason: options.finishReason ?? "STOP" }] };
    if (String(url).includes("streamGenerateContent")) {
      if (options.streamHang) return new Promise<Response>(() => {});
      return new Response(`data: ${JSON.stringify(response)}\n\n`, { headers: { "Content-Type": "text/event-stream" } });
    }
    return Response.json({ candidates: [{ content: { role: "model", parts: [{ text: "Berapa nilai akhir Rani?" }] }, finishReason: "STOP" }] });
  });
  return {
    saved, deleted, requests, queries,
    stream: (content: string, signal?: AbortSignal) => askTutorStream({ courseId: "course", userId: "student", sessionId: "chat", content, signal }),
    ask: async (content: string, signal?: AbortSignal) => {
      const stream = await askTutorStream({ courseId: "course", userId: "student", sessionId: "chat", content, signal });
      return new Response(stream).text();
    },
  };
}

test("answer generation receives evidence after character 1400 of a retrieved chunk", async (t) => {
  const h = await harness(t, { chunks: [{ ...chunk, content: "Pengantar. ".repeat(160) + "KODE-AKHIR: MERANTI-42." }] });
  const events = await h.ask("Apa kode akhirnya?");
  const request = h.requests.find((r) => r.url.includes("streamGenerateContent"));
  assert.ok(request);
  assert.match(JSON.stringify(request.body), /KODE-AKHIR: MERANTI-42/);
  assert.match(events, /event: done/);
});

test("a greeting works without selected PDFs and makes no provider calls", async (t) => {
  const h = await harness(t, { selected: [] });
  const events = await h.ask("Halo!");
  assert.match(events, /Halo/);
  assert.equal(h.requests.length, 0);
  assert.equal(h.saved.filter((m) => m.senderType === "ai").length, 1);
});

test("empty retrieval abstains without asking the generator to invent an answer", async (t) => {
  const h = await harness(t, { chunks: [] });
  const events = await h.ask("Siapa nama dosennya?");
  assert.match(events, /belum cukup/);
  assert.equal(h.requests.length, 1, "only the query embedding is needed");
});

test("follow-up retrieval uses conversation context before embedding", async (t) => {
  const h = await harness(t, { history: [{ senderType: "user", content: "Berapa nilai akhir Rani?" }, { senderType: "ai", content: "Nilai akhir Rani 78." }] });
  await h.ask("Kenapa begitu?");
  const embedding = h.requests.find((r) => r.url.toLowerCase().includes("embedcontent"));
  assert.ok(embedding);
  assert.match(JSON.stringify(embedding.body), /query: Berapa nilai akhir Rani/);
  assert.ok(h.requests[0].url.includes("generateContent"), "rewrite happens before embedding");
});

test("source metadata includes only references actually cited by the answer", async (t) => {
  const h = await harness(t, { answer: "Pertanyaan ini perlu diperjelas." });
  await h.ask("Apa maksudnya?");
  const ai = h.saved.find((m) => m.senderType === "ai");
  assert.deepEqual((ai?.ragSources as { sources: unknown[] }).sources, []);
});

test("out-of-range citations are rejected and never persisted as successful answers", async (t) => {
  const h = await harness(t, { answer: "Rani mendapat 78. [Sumber 99]" });
  const events = await h.ask("Berapa nilai Rani?");
  assert.match(events, /event: error/);
  assert.doesNotMatch(events, /event: done/);
  assert.equal(h.saved.filter((m) => m.senderType === "ai").length, 0);
  assert.equal(h.deleted.length, 1);
});

test("course access is checked before provider calls and message writes", async (t) => {
  const h = await harness(t, { denyAccess: true });
  await assert.rejects(() => h.ask("Apa itu median?"), /belum enroll/);
  assert.equal(h.requests.length, 0);
  assert.equal(h.saved.length, 0);
});

test("retrieval SQL scopes evidence to the course and selected ready materials", async (t) => {
  const h = await harness(t);
  await h.ask("Berapa nilai Rani?");
  assert.equal(h.queries.length, 1);
  const query = h.queries[0];
  assert.ok(query.values.includes("course"));
  assert.match(JSON.stringify(query.values), /material-1/);
  assert.match(query.strings.join("?"), /c\."courseId" =/);
  assert.match(query.strings.join("?"), /m\."id" IN/);
  assert.match(query.strings.join("?"), /m\."processingStatus" = 'ready'/);
});

test("mixed greeting and academic question still retrieves evidence", async (t) => {
  const h = await harness(t);
  await h.ask("Halo, berapa nilai Rani?");
  assert.equal(h.queries.length, 1);
});

test("deselected materials cannot answer a factual question", async (t) => {
  const h = await harness(t, { selected: [] });
  const events = await h.ask("Berapa nilai Rani?");
  assert.match(events, /belum cukup/);
  assert.equal(h.requests.length, 0);
  assert.equal(h.queries.length, 0);
});

test("partial provider output fails without saving an answer or orphaning the user turn", async (t) => {
  const h = await harness(t, { finishReason: "MAX_TOKENS" });
  const events = await h.ask("Berapa nilai Rani?");
  assert.match(events, /event: text/);
  assert.match(events, /event: error/);
  assert.doesNotMatch(events, /event: done/);
  assert.equal(h.saved.filter((m) => m.senderType === "ai").length, 0);
  assert.equal(h.deleted.length, 1);
});

test("persistence failure never sends success and cleans up the pending turn", async (t) => {
  const h = await harness(t, { transactionFailure: true });
  const events = await h.ask("Berapa nilai Rani?");
  assert.match(events, /event: error/);
  assert.doesNotMatch(events, /event: done/);
  assert.equal(h.deleted.length, 1);
});

test("an already aborted request writes nothing", async (t) => {
  const h = await harness(t);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(() => h.ask("Berapa nilai Rani?", controller.signal), { name: "AbortError" });
  assert.equal(h.saved.length, 0);
});

test("request abort closes a stalled response and cleans up its pending turn", async (t) => {
  const h = await harness(t, { streamHang: true });
  const controller = new AbortController();
  const pending = h.ask("Berapa nilai Rani?", controller.signal);
  const timer = setTimeout(() => controller.abort(), 100);
  try {
    const events = await pending;
    assert.doesNotMatch(events, /event: done/);
    assert.equal(h.deleted.length, 1);
  } finally { clearTimeout(timer); }
});

test("reader cancellation also aborts a stalled provider and cleans up", async (t) => {
  const h = await harness(t, { streamHang: true });
  const stream = await h.stream("Berapa nilai Rani?");
  await stream.cancel();
  // Cleanup runs in the producer after cancellation; wait for that observable effect.
  for (let attempt = 0; attempt < 20 && !h.deleted.length; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(h.deleted.length, 1);
});

test("weak matches below the existing threshold produce an evidence fallback", async (t) => {
  const h = await harness(t, { chunks: [{ ...chunk, similarity: 0.49 }] });
  const events = await h.ask("Materinya membahas apa?");
  assert.match(events, /belum cukup/);
  assert.equal(h.requests.length, 1);
});

test("cited source numbers retain their original context identity", async (t) => {
  const h = await harness(t, {
    chunks: [chunk, { ...chunk, chunkId: "chunk-2", pageNumber: 3 }],
    answer: "Lihat aturan pada halaman berikutnya. [Sumber 2]",
  });
  await h.ask("Di mana aturannya?");
  const ai = h.saved.find((m) => m.senderType === "ai");
  const sources = (ai?.ragSources as { sources: Array<{ chunkId: string; sourceNumber: number }> }).sources;
  assert.equal(sources.length, 1);
  assert.equal(sources[0].chunkId, "chunk-2");
  assert.equal(sources[0].sourceNumber, 2);
});
