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
