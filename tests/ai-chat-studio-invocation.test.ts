import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/synthetic_no_database";
process.env.GEMINI_API_KEY = "synthetic-test-key-never-use-live";

import {
  detectChatStudioIntent,
  formatChatStudioLaunchInstruction,
  getDefaultChatStudioLaunchTitle,
  parseChatStudioLaunchMeta,
} from "../src/lib/tutor-ai/chat-studio-intent";

test("detectChatStudioIntent recognizes quiz, flashcard, and summary requests while ignoring informational questions", () => {
  assert.deepEqual(
    detectChatStudioIntent("buatkan quiz mengenai software engineering pressman"),
    { type: "QUIZ", topic: "software engineering pressman" }
  );

  assert.deepEqual(
    detectChatStudioIntent("Tolong buatkan 5 soal kuis tentang Merge Sort vs Quick Sort!"),
    { type: "QUIZ", topic: "Merge Sort vs Quick Sort" }
  );

  assert.deepEqual(detectChatStudioIntent("Buat kuis singkat untuk saya"), {
    type: "QUIZ",
  });

  assert.deepEqual(
    detectChatStudioIntent("buatkan flashcard tentang Divide & Conquer"),
    { type: "FLASHCARDS", topic: "Divide & Conquer" }
  );

  assert.deepEqual(
    detectChatStudioIntent("bikin kartu hafalan dari materi ini dong"),
    { type: "FLASHCARDS" }
  );

  assert.deepEqual(
    detectChatStudioIntent("buatkan panduan belajar tentang analisis kompleksitas"),
    { type: "SUMMARY", topic: "analisis kompleksitas" }
  );

  assert.deepEqual(
    detectChatStudioIntent("Rangkum materi tentang pohon rekursi"),
    { type: "SUMMARY", topic: "pohon rekursi" }
  );

  // Informational queries & in-chat worked examples must remain normal chat prompts
  assert.equal(detectChatStudioIntent("Apa itu kuis dan bagaimana cara kerjanya?"), null);
  assert.equal(detectChatStudioIntent("Jelaskan apa itu Merge Sort!"), null);
  assert.equal(
    detectChatStudioIntent(
      "Buatkan satu contoh soal terkait Merge Sort dan tunjukkan penyelesaiannya menggunakan format kartu langkah (`tutorsteps`)."
    ),
    null
  );
  assert.equal(
    detectChatStudioIntent(
      "Rangkum perbandingan Merge Sort vs Quick Sort ke dalam tabel Markdown"
    ),
    null
  );
});

test("chat studio metadata parser & helper titles validate and format cleanly", () => {
  assert.equal(parseChatStudioLaunchMeta(null), null);
  assert.equal(parseChatStudioLaunchMeta({ intent: "chat" }), null);

  const meta = parseChatStudioLaunchMeta({
    intent: "chat",
    studioLaunch: {
      type: "QUIZ",
      topic: "Divide & Conquer",
      artifactId: "artifact-42",
    },
  });
  assert.deepEqual(meta, {
    type: "QUIZ",
    topic: "Divide & Conquer",
    artifactId: "artifact-42",
  });
  assert.equal(
    getDefaultChatStudioLaunchTitle({ type: "QUIZ", topic: "Divide & Conquer" }),
    "Kuis Latihan: Divide & Conquer"
  );
  assert.equal(
    getDefaultChatStudioLaunchTitle({
      type: "FLASHCARDS",
      title: "Dek Kustom",
      topic: "Recursion",
    }),
    "Dek Kustom"
  );

  const instruction = formatChatStudioLaunchInstruction({
    type: "QUIZ",
    topic: "Divide & Conquer",
  });
  assert.match(instruction, /kuis latihan interaktif/i);
  assert.match(instruction, /Divide & Conquer/);
});

test("askTutorStream attaches studioLaunch metadata for grounded chat quiz prompts and abstains safely without evidence", async (t: TestContext) => {
  const { default: prisma } = await import("../src/lib/prisma");
  const { askTutorStream } = await import("../src/lib/tutor-ai/service");
  const { generateTutorStudioArtifact } = await import("../src/lib/tutor-ai/studio");

  function replace(target: object, key: string, value: unknown) {
    const record = target as Record<string, unknown>;
    const original = record[key];
    record[key] = value;
    t.after(() => {
      record[key] = original;
    });
  }

  const savedMessages: Array<Record<string, unknown>> = [];
  const updatedMessages: Array<Record<string, unknown>> = [];
  const storedArtifacts: Array<Record<string, unknown>> = [];
  const runs: Array<Record<string, unknown>> = [];
  let chunksToReturn: Array<Record<string, unknown>> = [
    {
      chunkId: "c-1",
      materialId: "mat-1",
      sessionId: "sess-1",
      pageNumber: 4,
      chunkIndex: 0,
      content: "Merge Sort membagi array menjadi dua bagian dan menggabungkannya kembali.",
      similarity: 0.91,
      materialTitle: "Modul Divide & Conquer",
      fileName: "divide-conquer.pdf",
      sessionTitle: "Pertemuan 4",
      publicUrl: null,
    },
  ];
  let llmResponseMode: "chat_intro" | "quiz_json" = "chat_intro";

  const responseRunModel = (prisma as unknown as { aiResponseRun?: object }).aiResponseRun;
  if (responseRunModel) {
    replace(responseRunModel, "create", async ({ data }: { data: Record<string, unknown> }) => {
      const run = { status: "running", ...data };
      runs.push(run);
      return run;
    });
    replace(responseRunModel, "update", async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
      const run = runs.find((r) => r.id === where.id);
      if (run) Object.assign(run, data);
      return run ?? data;
    });
  }

  replace(prisma.user, "findUnique", async () => ({
    id: "student-1",
    name: "Andi",
    role: "mahasiswa",
    academicLevel: "S1",
  }));
  replace(prisma.course, "findFirst", async () => ({
    id: "course-1",
    title: "Algoritma",
    description: null,
    isActive: true,
  }));
  replace(prisma.material, "findMany", async () => [
    {
      id: "mat-1",
      title: "Modul Divide & Conquer",
      fileName: "divide-conquer.pdf",
      pageCount: 10,
      chunkCount: 15,
      createdAt: new Date("2026-11-20T00:00:00Z"),
      courseSession: { id: "sess-1", title: "Pertemuan 4", orderNumber: 1 },
    },
  ]);
  replace(prisma.aiChatSession, "findFirst", async () => ({
    id: "chat-1",
    userId: "student-1",
    courseId: "course-1",
    messages: [],
  }));
  replace(prisma.aiChatSession, "update", async () => ({}));
  replace(prisma.aiChatMessage, "findFirst", async ({ where }: { where: Record<string, unknown> }) => {
    if (where.senderType === "ai") {
      return savedMessages.find((m) => m.id === where.id) ?? null;
    }
    return { content: JSON.stringify(["mat-1"]) };
  });
  replace(prisma.aiChatMessage, "findMany", async () => []);
  replace(prisma.aiChatMessage, "create", async ({ data }: { data: Record<string, unknown> }) => {
    savedMessages.push(data);
    return data;
  });
  replace(prisma.aiChatMessage, "update", async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
    updatedMessages.push({ where, data });
    const msg = savedMessages.find((m) => m.id === where.id);
    if (msg) Object.assign(msg, data);
    return msg ?? data;
  });
  replace(prisma.tutorPromptConfig, "findUnique", async () => null);
  replace(prisma, "$transaction", async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma));
  replace(prisma, "$queryRaw", async (strings: TemplateStringsArray) => {
    if (strings.join("").includes("ai_answer_correction")) return [];
    return chunksToReturn;
  });

  const studioDelegate = prisma.tutorStudioArtifact;
  replace(studioDelegate, "findFirst", async ({ where }: { where: { sourceMessageId?: string } }) =>
    storedArtifacts.find((a) => a.sourceMessageId === where.sourceMessageId) ?? null
  );
  replace(studioDelegate, "create", async ({ data }: { data: Record<string, unknown> }) => {
    const now = new Date();
    const row = { id: `art-${storedArtifacts.length + 1}`, ...data, createdAt: now, updatedAt: now };
    storedArtifacts.push(row);
    return row;
  });

  t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
    const u = String(url);
    if (u.toLowerCase().includes("embedcontent")) {
      return Response.json({ embeddings: [{ values: Array(768).fill(0.1) }] });
    }
    if (u.includes("streamGenerateContent")) {
      const payload = {
        usageMetadata: { promptTokenCount: 20, candidatesTokenCount: 15, totalTokenCount: 35 },
        candidates: [
          {
            content: {
              role: "model",
              parts: [
                {
                  text: "Ini kuis latihan mengenai Merge Sort berdasarkan materi Divide & Conquer [Sumber 1].",
                },
              ],
            },
            finishReason: "STOP",
          },
        ],
      };
      return new Response(`data: ${JSON.stringify(payload)}\n\n`, {
        headers: { "Content-Type": "text/event-stream" },
      });
    }
    if (llmResponseMode === "quiz_json") {
      return Response.json({
        usageMetadata: { promptTokenCount: 40, candidatesTokenCount: 50, totalTokenCount: 90 },
        candidates: [
          {
            content: {
              role: "model",
              parts: [
                {
                  text: JSON.stringify({
                    title: "Kuis Latihan: Merge Sort",
                    questions: [
                      {
                        topic: "Divide Step",
                        question: "Bagaimana Merge Sort membagi array?",
                        options: ["Acak", "Tepat dua bagian", "Tiga bagian", "Pivot"],
                        correctIndex: 1,
                        hint: "Seimbang.",
                        explanation: "Array dibagi tepat dua di titik tengah.",
                        sourceNumbers: [1],
                      },
                    ],
                  }),
                },
              ],
            },
            finishReason: "STOP",
          },
        ],
      });
    }
    return Response.json({
      candidates: [{ content: { role: "model", parts: [{ text: "Merge Sort" }] }, finishReason: "STOP" }],
    });
  });

  const streamText = await new Response(
    await askTutorStream({
      courseId: "course-1",
      userId: "student-1",
      sessionId: "chat-1",
      content: "buatkan quiz mengenai Merge Sort",
      responseMode: "chat",
    })
  ).text();

  assert.match(streamText, /event: metadata/);
  assert.match(streamText, /"studioLaunch":\{"type":"QUIZ","topic":"Merge Sort"\}/);

  const aiMessage = savedMessages.find((m) => m.senderType === "ai");
  assert.ok(aiMessage);
  const meta = parseChatStudioLaunchMeta(aiMessage.ragSources);
  assert.deepEqual(meta, { type: "QUIZ", topic: "Merge Sort" });

  // Generating artifact linked via launchMessageId updates sourceMessageId and chat message metadata
  llmResponseMode = "quiz_json";
  const generated = await generateTutorStudioArtifact({
    courseId: "course-1",
    userId: "student-1",
    type: "QUIZ",
    chatSessionId: "chat-1",
    launchMessageId: String(aiMessage.id),
    topic: "Merge Sort",
  });

  assert.equal(generated.artifact.sourceMessageId, aiMessage.id);
  assert.equal(generated.artifact.structuredData?.kind, "QUIZ");
  assert.equal(updatedMessages.length, 1);
  assert.deepEqual(parseChatStudioLaunchMeta(aiMessage.ragSources), {
    type: "QUIZ",
    topic: "Merge Sort",
    title: "Kuis Latihan: Merge Sort",
    artifactId: generated.artifact.id,
  });

  // When retrieval finds zero chunks, no studioLaunch card should be attached
  chunksToReturn = [];
  const noEvidenceText = await new Response(
    await askTutorStream({
      courseId: "course-1",
      userId: "student-1",
      sessionId: "chat-1",
      content: "buatkan quiz mengenai topik tidak ada",
      responseMode: "chat",
    })
  ).text();
  assert.match(noEvidenceText, /belum cukup/);
  assert.doesNotMatch(noEvidenceText, /"studioLaunch"/);
});
