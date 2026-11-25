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
  academicLevel?: "S1" | "S2" | "S3";
  academicStyle?: string;
  responseMode?: "chat" | "avatar";
  chunks?: typeof chunk[];
  availableMaterialIds?: string[];
  selected?: string[];
  history?: Array<{ senderType: string; content: string }>;
  answer?: string;
  denyAccess?: boolean;
  denySession?: boolean;
  transactionFailure?: boolean;
  finishReason?: string;
  streamHang?: boolean;
  retrievalFailure?: boolean;
  generationTimeout?: boolean;
} = {}) {
  const { default: prisma } = await import("../src/lib/prisma");
  function replace(target: object, key: string, value: unknown) {
    const record = target as Record<string, unknown>;
    const original = record[key];
    record[key] = value;
    t.after(() => { record[key] = original; });
  }
  const { askTutorStream } = await import("../src/lib/tutor-ai/service");
  let markProviderStarted: () => void = () => {};
  const providerStarted = new Promise<void>((resolve) => { markProviderStarted = resolve; });
  const saved: Array<Record<string, unknown>> = [];
  const deleted: unknown[] = [];
  const runs: Array<Record<string, unknown>> = [];
  const responseRunModel = (prisma as unknown as { aiResponseRun?: object }).aiResponseRun;
  if (responseRunModel) {
    replace(responseRunModel, "create", async ({ data }: { data: Record<string, unknown> }) => {
      if (runs.some((run) => run.requestId === data.requestId)) {
        const { Prisma } = await import("../src/app/generated/prisma/client");
        throw new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" });
      }
      const run = { status: "running", ...data }; runs.push(run); return run;
    });
    replace(responseRunModel, "update", async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const run = runs.find((run) => run.id === where.id)!; Object.assign(run, data); return run;
    });
    replace(responseRunModel, "findUnique", async ({ where }: { where: { aiChatSessionId_requestId: { requestId: string } } }) => runs.find((run) => run.requestId === where.aiChatSessionId_requestId.requestId) ?? null);
    replace(responseRunModel, "findFirst", async ({ where }: { where: { id: string } }) => runs.find((run) => run.id === where.id && ["failed", "cancelled", "timed_out"].includes(String(run.status))) ?? null);
  }
  const materialQueries: Array<{ where: Record<string, unknown> }> = [];
  const queries: Array<{ strings: string[]; values: unknown[] }> = [];
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  replace(prisma.user, "findUnique", async () => ({ id: "student", name: "Rani", role: "mahasiswa", academicLevel: options.academicLevel ?? "S1" }));
  replace(prisma.course, "findFirst", async () => options.denyAccess ? null : ({ id: "course", title: "Statistika Dasar", description: null, isActive: true }));
  replace(prisma.material, "findMany", async (args: { where: Record<string, unknown> }) => {
    materialQueries.push(args);
    return (options.availableMaterialIds ?? ["material-1"]).map((id, index) => {
      const materialChunk = options.chunks?.find((candidate) => candidate.materialId === id) ?? chunk;
      return {
        id, title: materialChunk.materialTitle, fileName: materialChunk.fileName,
        pageCount: 3, chunkCount: 4, createdAt: new Date(),
        courseSession: { id: materialChunk.sessionId, title: materialChunk.sessionTitle, orderNumber: index + 1 },
      };
    });
  });
  replace(prisma.aiChatSession, "findFirst", async () => options.denySession ? null : ({ id: "chat", messages: [] }));
  replace(prisma.aiChatSession, "update", async () => ({}));
  replace(prisma.aiChatMessage, "findFirst", async () => ({ content: JSON.stringify(options.selected ?? ["material-1"]) }));
  replace(prisma.aiChatMessage, "findMany", async () => [...(options.history ?? [])].reverse());
  replace(prisma.aiChatMessage, "create", async ({ data }: { data: Record<string, unknown> }) => { saved.push(data); return data; });
  replace(prisma.aiChatMessage, "delete", async (args: unknown) => { deleted.push(args); return {}; });
  replace(prisma.tutorPromptConfig, "findUnique", async () => options.academicStyle ? { promptContent: options.academicStyle } : null);
  replace(prisma, "$transaction", async (callback: (tx: typeof prisma) => Promise<unknown>) => { if (options.transactionFailure) throw new Error("synthetic transaction failure"); return callback(prisma); });
  replace(prisma, "$queryRaw", async (strings: TemplateStringsArray, ...values: unknown[]) => { if (strings.join("").includes("ai_answer_correction")) return []; queries.push({ strings: [...strings], values }); if (options.retrievalFailure) throw new DOMException("synthetic deadline", "TimeoutError"); return options.chunks ?? [chunk]; });
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    requests.push({ url: String(url), body });
    if (String(url).toLowerCase().includes("embedcontent")) {
      return Response.json({ embeddings: [{ values: Array(768).fill(0.1) }] });
    }
    const response = { usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 10, totalTokenCount: 30 }, candidates: [{ content: { role: "model", parts: [{ text: options.answer ?? "Nilai Rani 78. [Sumber 1]" }] }, finishReason: options.finishReason ?? "STOP" }] };
    if (String(url).includes("streamGenerateContent")) {
      markProviderStarted();
      if (options.generationTimeout) throw new DOMException("synthetic timeout", "TimeoutError");
      if (options.streamHang) return new Promise<Response>(() => {});
      return new Response(`data: ${JSON.stringify(response)}\n\n`, { headers: { "Content-Type": "text/event-stream" } });
    }
    return Response.json({ candidates: [{ content: { role: "model", parts: [{ text: "Berapa nilai akhir Rani?" }] }, finishReason: "STOP" }] });
  });
  return {
    saved, deleted, requests, queries, materialQueries, providerStarted, runs,
    readRun: async (requestId: string) => {
      const { getTutorResponseRun } = await import("../src/lib/tutor-ai/service");
      return getTutorResponseRun({ courseId: "course", userId: "student", sessionId: "chat", requestId });
    },
    request: (requestId: string, retryOfRunId?: string) => askTutorStream({ courseId: "course", userId: "student", sessionId: "chat", content: "Berapa nilai Rani?", requestId, retryOfRunId }),
    stream: (content: string, signal?: AbortSignal) => askTutorStream({ courseId: "course", userId: "student", sessionId: "chat", content, signal, responseMode: options.responseMode }),
    ask: async (content: string, signal?: AbortSignal) => {
      const stream = await askTutorStream({ courseId: "course", userId: "student", sessionId: "chat", content, signal, responseMode: options.responseMode });
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
  await h.providerStarted;
  controller.abort();
  const events = await pending;
  assert.doesNotMatch(events, /event: done/);
  assert.equal(h.deleted.length, 1);
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
  const secondMaterialChunk = {
    ...chunk,
    chunkId: "chunk-2",
    materialId: "material-2",
    pageNumber: 3,
    materialTitle: "Penilaian Lanjutan",
    fileName: "02-statistika-digital.pdf",
  };
  const h = await harness(t, {
    chunks: [chunk, secondMaterialChunk],
    availableMaterialIds: ["material-1", "material-2"],
    selected: ["material-1", "material-2"],
    answer: "Lihat aturan pada halaman berikutnya. [2, 2]",
  });
  const events = await h.ask("Di mana aturannya?");
  assert.match(events, /event: metadata/);
  assert.match(events, /event: done/);
  const ai = h.saved.find((m) => m.senderType === "ai");
  const sources = (ai?.ragSources as { sources: Array<{ chunkId: string; sourceNumber: number }> }).sources;
  assert.equal(sources.length, 1);
  assert.equal(sources[0].chunkId, "chunk-2");
  assert.equal(sources[0].sourceNumber, 2);
});


test("only materials embedded with the current model and dimensions are offered as ready", async (t) => {
  const h = await harness(t);
  await h.ask("Apa itu median?");
  assert.equal(h.materialQueries[0].where.embeddingModel, "gemini-embedding-2");
  assert.equal(h.materialQueries[0].where.embeddingDimensions, 768);
});


test("the provider receives concise-first rules after a legacy academic prompt without overwriting it", async (t) => {
  const legacy = "Panduan custom: selalu jelaskan panjang, beri analogi dan motivasi.";
  const h = await harness(t, { academicLevel: "S3", academicStyle: legacy });
  await h.ask("Apa definisi rata-rata?");
  const request = h.requests.find((r) => r.url.includes("streamGenerateContent"));
  assert.ok(request);
  const system = JSON.stringify(request.body.systemInstruction);
  assert.ok(system.includes(legacy), "admin academic guidance must be retained");
  assert.ok(system.indexOf("Prioritas gaya respons") > system.indexOf(legacy));
  assert.match(system, /1-3 kalimat/);
  assert.match(system, /80 kata/);
  assert.match(system, /detail|rinci/);
  assert.match(system, /Jangan membuka atau menutup jawaban dengan sapaan/);
});

test("a detailed follow-up still receives the request for depth and no-greeting rules", async (t) => {
  const h = await harness(t, { history: [{ senderType: "user", content: "Apa itu mean?" }, { senderType: "ai", content: "Mean adalah rata-rata." }] });
  await h.ask("Jelaskan lebih rinci dengan contoh dan langkah perhitungan.");
  const request = h.requests.find((r) => r.url.includes("streamGenerateContent"));
  assert.ok(request);
  assert.match(JSON.stringify(request.body.contents), /Jelaskan lebih rinci dengan contoh/);
  assert.match(JSON.stringify(request.body.systemInstruction), /tidak berlaku.*rinci/);
  assert.match(JSON.stringify(request.body.systemInstruction), /Jangan membuka atau menutup jawaban dengan sapaan/);
});

test("avatar responses retain their own spoken limit and citation guardrails", async (t) => {
  const h = await harness(t, { responseMode: "avatar" });
  await h.ask("Apa itu mean?");
  const request = h.requests.find((r) => r.url.includes("streamGenerateContent"));
  assert.ok(request);
  const system = JSON.stringify(request.body.systemInstruction);
  assert.match(system, /maksimal 45 kata/);
  assert.doesNotMatch(system, /80 kata/);
  assert.match(system, /Jangan membuka atau menutup jawaban dengan sapaan/);
  assert.match(system, /wajib gunakan sitasi/);
});


test("completed runs preserve configuration, full evidence and persisted message identities", async (t) => {
  const h = await harness(t);
  const events = await h.ask("Berapa nilai Rani?");
  const run = h.runs[0];
  assert.equal(run.status, "completed");
  assert.equal(run.answerMessageId, h.saved.find((m) => m.senderType === "ai")?.id);
  assert.equal(run.userMessageId, h.saved.find((m) => m.senderType === "user")?.id);
  assert.match(JSON.stringify(run.configuration), /systemInstruction/);
  assert.match(JSON.stringify(run.evidence), /Nilai Rani adalah 78/);
  assert.deepEqual(run.tokenUsage, { promptTokenCount: 20, candidatesTokenCount: 10, totalTokenCount: 30 });
  assert.ok(run.finishedAt);
  assert.equal(typeof run.durationMs, "number");
  assert.match(events, new RegExp(String(run.id)));
});

test("retrieval timeout leaves a terminal run without creating messages", async (t) => {
  const h = await harness(t, { retrievalFailure: true });
  await assert.rejects(() => h.ask("Berapa nilai Rani?"), { name: "TimeoutError" });
  assert.equal(h.runs[0].status, "timed_out");
  assert.equal(h.runs[0].stage, "retrieval");
  assert.equal(h.saved.length, 0);
});

test("partial generation leaves a failed run and retry links a new attempt", async (t) => {
  const h = await harness(t, { finishReason: "MAX_TOKENS" });
  await h.ask("Berapa nilai Rani?");
  assert.equal(h.runs[0].status, "failed");
  assert.equal(h.runs[0].errorCategory, "generation_error");
  await new Response(await h.request("retry-request", String(h.runs[0].id))).text();
  assert.equal(h.runs.length, 2);
  assert.equal(h.runs[1].retryOfRunId, h.runs[0].id);
});

test("duplicate request IDs never create another answer or invoke the provider again", async (t) => {
  const h = await harness(t);
  await new Response(await h.request("same-request")).text();
  const calls = h.requests.length;
  await assert.rejects(() => h.request("same-request"), (error: unknown) => (error as { status: number }).status === 409);
  assert.equal(h.runs.length, 1);
  assert.equal(h.requests.length, calls);
  assert.equal(h.saved.filter((m) => m.senderType === "ai").length, 1);
});

test("cancellation persists a cancelled run", async (t) => {
  const h = await harness(t, { streamHang: true });
  const controller = new AbortController();
  const result = h.ask("Berapa nilai Rani?", controller.signal);
  await h.providerStarted;
  controller.abort();
  await result;
  assert.equal(h.runs[0].status, "cancelled");
  assert.equal(h.runs[0].answerMessageId, undefined);
});

test("access denial creates no run and invalid retry cannot reference another chat", async (t) => {
  const h = await harness(t, { denyAccess: true });
  await assert.rejects(() => h.ask("Berapa nilai Rani?"));
  assert.equal(h.runs.length, 0);
});

test("retry references must identify a failed run in the same session", async (t) => {
  const h = await harness(t);
  await assert.rejects(() => h.request("retry-request", "foreign-run"), (error: unknown) => (error as { status: number }).status === 409);
  assert.equal(h.runs.length, 0);
});


test("generation deadline is recorded separately from retrieval and provider errors", async (t) => {
  const h = await harness(t, { generationTimeout: true });
  await h.ask("Berapa nilai Rani?");
  assert.equal(h.runs[0].status, "timed_out");
  assert.equal(h.runs[0].stage, "generation");
  assert.equal(h.saved.filter((m) => m.senderType === "ai").length, 0);
});

test("a duplicate while the first run is active cannot start a second generation", async (t) => {
  const h = await harness(t, { streamHang: true });
  const stream = await h.request("active-request");
  await h.providerStarted;
  await assert.rejects(() => h.request("active-request"), (error: unknown) => (error as { status: number }).status === 409);
  assert.equal(h.runs.length, 1);
  await stream.cancel();
});

test("run inspection returns saved snapshots and reports unknown request IDs", async (t) => {
  const h = await harness(t);
  await new Response(await h.request("inspect-request")).text();
  const run = await h.readRun("inspect-request");
  assert.equal(run.status, "completed");
  await assert.rejects(() => h.readRun("unknown-request"), (error: unknown) => (error as { status: number }).status === 404);
});

test("run inspection checks course access before exposing snapshots", async (t) => {
  const h = await harness(t, { denyAccess: true });
  await assert.rejects(() => h.readRun("private-request"), /belum enroll/);
});


test("another student's session cannot expose run snapshots or create attempts", async (t) => {
  const h = await harness(t, { denySession: true });
  await assert.rejects(() => h.readRun("private-request"), (error: unknown) => (error as { status: number }).status === 404);
  await assert.rejects(() => h.ask("Berapa nilai Rani?"), (error: unknown) => (error as { status: number }).status === 404);
  assert.equal(h.runs.length, 0);
  assert.equal(h.requests.length, 0);
});
