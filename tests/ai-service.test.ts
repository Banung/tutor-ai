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
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  replace(prisma.user, "findUnique", async () => ({ id: "student", name: "Rani", role: "mahasiswa", academicLevel: "S1" }));
  replace(prisma.course, "findFirst", async () => ({ id: "course", title: "Statistika Dasar", description: null, isActive: true }));
  replace(prisma.material, "findMany", async () => [{ id: "material-1", title: "Penilaian", fileName: chunk.fileName, pageCount: 3, chunkCount: 4, createdAt: new Date(), courseSession: { id: "lesson-1", title: "Penilaian", orderNumber: 1 } }] );
  replace(prisma.aiChatSession, "findFirst", async () => ({ id: "chat", messages: [] }));
  replace(prisma.aiChatSession, "update", async () => ({}));
  replace(prisma.aiChatMessage, "findFirst", async () => ({ content: JSON.stringify(options.selected ?? ["material-1"]) }));
  replace(prisma.aiChatMessage, "findMany", async () => [...(options.history ?? [])].reverse());
  replace(prisma.aiChatMessage, "create", async ({ data }: { data: Record<string, unknown> }) => { saved.push(data); return data; });
  replace(prisma.aiChatMessage, "delete", async (args: unknown) => { deleted.push(args); return {}; });
  replace(prisma.tutorPromptConfig, "findUnique", async () => null);
  replace(prisma, "$transaction", async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma));
  replace(prisma, "$queryRaw", async () => options.chunks ?? [chunk]);
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    requests.push({ url: String(url), body });
    if (String(url).toLowerCase().includes("embedcontent")) {
      return Response.json({ embeddings: [{ values: Array(768).fill(0.1) }] });
    }
    const response = { candidates: [{ content: { role: "model", parts: [{ text: options.answer ?? "Nilai Rani 78. [Sumber 1]" }] }, finishReason: "STOP" }] };
    if (String(url).includes("streamGenerateContent")) {
      return new Response(`data: ${JSON.stringify(response)}\n\n`, { headers: { "Content-Type": "text/event-stream" } });
    }
    return Response.json({ candidates: [{ content: { role: "model", parts: [{ text: "Berapa nilai akhir Rani?" }] }, finishReason: "STOP" }] });
  });
  return {
    saved, deleted, requests,
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
