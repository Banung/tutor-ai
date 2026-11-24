import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/synthetic_no_database";
process.env.GEMINI_API_KEY = "synthetic-test-key-never-use-live";

import {
  buildTutorActionSuggestions,
  parsePersistedSuggestedActions,
} from "../src/lib/tutor-ai/action-suggestions";
import {
  buildStudioArtifactMarkdown,
  buildStudioExportFilename,
  buildStudioPrintableHtml,
} from "../src/lib/tutor-ai/studio-export";
import type { TutorStudioArtifactDto } from "../src/lib/tutor-ai/studio-schema";

const SAMPLE_CHUNK = {
  chunkId: "chunk-1",
  materialId: "material-1",
  sessionId: "lesson-1",
  pageNumber: 3,
  chunkIndex: 0,
  content: "Rekursi memecah masalah menjadi submasalah yang lebih kecil dengan base case.",
  similarity: 0.86,
  materialTitle: "Modul Rekursi",
  fileName: "03-rekursi.pdf",
  publicUrl: "https://example.com/03-rekursi.pdf",
  sessionTitle: "Pertemuan 3",
};

type StoredArtifactRow = {
  id: string;
  courseId: string;
  userId: string;
  chatSessionId: string | null;
  sourceMessageId: string | null;
  type: "SUMMARY" | "QUIZ" | "FLASHCARDS" | "NOTE";
  title: string;
  content: string;
  sources: unknown;
  materialIds: unknown;
  materialTitles: unknown;
  createdAt: Date;
  updatedAt: Date;
};

async function createStudioHarness(
  t: TestContext,
  options: {
    generatedText?: string;
    chunks?: Array<typeof SAMPLE_CHUNK>;
    denyAccess?: boolean;
  } = {}
) {
  const { default: prisma } = await import("../src/lib/prisma");
  const studio = await import("../src/lib/tutor-ai/studio");

  function replace(target: object, key: string, value: unknown) {
    const record = target as Record<string, unknown>;
    const original = record[key];
    record[key] = value;
    t.after(() => {
      record[key] = original;
    });
  }

  const storedArtifacts: StoredArtifactRow[] = [];
  const fetchRequests: Array<{ url: string; body: Record<string, unknown> }> = [];
  let seq = 0;

  replace(prisma.user, "findUnique", async () => ({
    id: "student-1",
    name: "Nadia",
    role: "mahasiswa",
    academicLevel: "S1",
  }));

  replace(prisma.course, "findFirst", async () =>
    options.denyAccess
      ? null
      : {
          id: "course-1",
          title: "Algoritma & Pemrograman",
          description: "Materi struktur data dan algoritma dasar",
          isActive: true,
        }
  );

  replace(prisma.material, "findMany", async () => [
    {
      id: "material-1",
      title: "Modul Rekursi",
      fileName: "03-rekursi.pdf",
      pageCount: 12,
      chunkCount: 24,
      createdAt: new Date("2026-11-20T00:00:00Z"),
      courseSession: {
        id: "lesson-1",
        title: "Pertemuan 3",
        orderNumber: 3,
      },
    },
  ]);

  replace(prisma.aiChatSession, "findFirst", async ({ where }: { where: { id?: string; userId?: string; courseId?: string } }) => {
    if (where.id !== "chat-1" || where.userId !== "student-1" || where.courseId !== "course-1") {
      return null;
    }
    return {
      id: "chat-1",
      userId: "student-1",
      courseId: "course-1",
      messages: [
        {
          id: "msg-user-1",
          senderType: "user",
          content: "Bagaimana cara kerja rekursi dan base case?",
          ragSources: null,
          responseTimeMs: null,
          feedbacks: [],
          createdAt: new Date("2026-11-24T01:00:00Z"),
        },
        {
          id: "msg-ai-1",
          senderType: "ai",
          content: "Rekursi memanggil dirinya sendiri hingga menyentuh base case. [Sumber 1]",
          ragSources: {
            intent: "chat",
            sources: [
              {
                chunkId: "chunk-1",
                materialId: "material-1",
                materialTitle: "Modul Rekursi",
                fileName: "03-rekursi.pdf",
                publicUrl: "https://example.com/03-rekursi.pdf",
                sessionTitle: "Pertemuan 3",
                pageNumber: 3,
                chunkIndex: 0,
                similarity: 0.86,
                snippet: "Rekursi memecah masalah menjadi submasalah.",
                sourceNumber: 1,
              },
            ],
          },
          responseTimeMs: 420,
          feedbacks: [],
          createdAt: new Date("2026-11-24T01:00:05Z"),
        },
      ],
    };
  });

  replace(prisma.aiChatMessage, "findFirst", async () => ({
    content: JSON.stringify(["material-1"]),
  }));

  replace(prisma.tutorPromptConfig, "findUnique", async () => null);

  replace(prisma, "$queryRaw", async (strings: TemplateStringsArray) => {
    if (strings.join("").includes("ai_answer_correction")) return [];
    return options.chunks ?? [SAMPLE_CHUNK];
  });

  const studioDelegate = (prisma as unknown as { tutorStudioArtifact: Record<string, unknown> }).tutorStudioArtifact;

  replace(studioDelegate, "findMany", async ({ where }: { where: Record<string, unknown> }) => {
    return storedArtifacts
      .filter((row) => {
        if (where.courseId && row.courseId !== where.courseId) return false;
        if (where.userId && row.userId !== where.userId) return false;
        if (where.chatSessionId && row.chatSessionId !== where.chatSessionId) return false;
        if (where.type && row.type !== where.type) return false;
        return true;
      })
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  });

  replace(studioDelegate, "findFirst", async ({ where }: { where: Record<string, unknown> }) => {
    return (
      storedArtifacts.find((row) => {
        if (where.id && row.id !== where.id) return false;
        if (where.courseId && row.courseId !== where.courseId) return false;
        if (where.userId && row.userId !== where.userId) return false;
        if (where.type && row.type !== where.type) return false;
        if (where.sourceMessageId && row.sourceMessageId !== where.sourceMessageId) return false;
        return true;
      }) ?? null
    );
  });

  replace(studioDelegate, "create", async ({ data }: { data: Omit<StoredArtifactRow, "id" | "createdAt" | "updatedAt"> }) => {
    seq += 1;
    const now = new Date(Date.UTC(2026, 10, 24, 2, 0, seq));
    const created: StoredArtifactRow = {
      id: `artifact-${seq}`,
      ...data,
      createdAt: now,
      updatedAt: now,
    };
    storedArtifacts.push(created);
    return created;
  });

  replace(studioDelegate, "update", async ({ where, data }: { where: { id: string }; data: { title?: string } }) => {
    const row = storedArtifacts.find((item) => item.id === where.id);
    if (!row) throw new Error("Artifact not found");
    if (typeof data.title === "string") row.title = data.title;
    row.updatedAt = new Date();
    return row;
  });

  replace(studioDelegate, "delete", async ({ where }: { where: { id: string } }) => {
    const index = storedArtifacts.findIndex((item) => item.id === where.id);
    if (index === -1) throw new Error("Artifact not found");
    const [removed] = storedArtifacts.splice(index, 1);
    return removed;
  });

  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    const parsedBody = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    fetchRequests.push({ url: String(url), body: parsedBody });

    if (String(url).toLowerCase().includes("embedcontent")) {
      return Response.json({ embeddings: [{ values: Array(768).fill(0.12) }] });
    }

    const defaultMarkdown = [
      "# Memahami Rekursi dan Base Case",
      "",
      "## Konsep Inti",
      "Rekursi memecah masalah besar menjadi submasalah identik yang berhenti saat mencapai base case [Sumber 1].",
      "Abaikan sitasi nyasar jika ada [Sumber 99].",
    ].join("\n");

    return Response.json({
      usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 25, totalTokenCount: 55 },
      candidates: [
        {
          content: {
            role: "model",
            parts: [{ text: options.generatedText ?? defaultMarkdown }],
          },
          finishReason: "STOP",
        },
      ],
    });
  });

  return {
    studio,
    storedArtifacts,
    fetchRequests,
  };
}

test("buildTutorActionSuggestions returns empty list without sources", () => {
  assert.deepEqual(
    buildTutorActionSuggestions({
      messageId: "m-1",
      answerContent: "Halo, ada yang bisa dibantu?",
      questionContent: "Halo",
      sourcesCount: 0,
    }),
    []
  );
});

test("buildTutorActionSuggestions pins summary to Studio first and adapts contextual actions", () => {
  const proceduralSuggestions = buildTutorActionSuggestions({
    messageId: "m-1",
    questionContent: "Bagaimana langkah menghitung kompleksitas Merge Sort vs Quick Sort?",
    answerContent:
      "Kompleksitas rata-rata **Merge Sort** adalah $O(n \\log n)$ sementara **Quick Sort** juga $O(n \\log n)$ tetapi berbeda pada kasus terburuk dan penggunaan memori.",
    sourcesCount: 2,
  });

  assert.equal(proceduralSuggestions[0]?.id, "summary_studio");
  assert.equal(proceduralSuggestions.length, 3);
  assert.ok(proceduralSuggestions.some((item) => item.id === "worked_example"));
  assert.ok(proceduralSuggestions.some((item) => item.id === "comparison_table"));
  assert.match(proceduralSuggestions[1]?.title ?? "", /Merge Sort & Quick Sort/);

  // Prefer persisted LLM adaptive suggestions when provided
  const adaptiveSuggestions = buildTutorActionSuggestions({
    messageId: "m-1",
    questionContent: "Bagaimana Merge Sort bekerja?",
    answerContent: "Merge Sort membagi array lalu menggabungkannya.",
    sourcesCount: 2,
    persistedSuggestions: [
      {
        target: "studio",
        artifactType: "SUMMARY",
        label: "Ringkas mekanisme Merge Sort ke Studio",
        prompt: "Ringkas Merge Sort",
      },
      {
        target: "chat",
        label: "Bagaimana trace rekursi Merge Sort pada 6 elemen?",
        prompt: "Tunjukkan trace rekursi Merge Sort pada 6 angka.",
      },
      {
        target: "chat",
        label: "Kapan Merge Sort lebih unggul dibanding Quick Sort?",
        prompt: "Kapan Merge Sort lebih baik?",
      },
    ],
  });

  assert.equal(adaptiveSuggestions.length, 3);
  assert.equal(adaptiveSuggestions[0]?.title, "Ringkas mekanisme Merge Sort ke Studio");
  assert.equal(adaptiveSuggestions[1]?.id, "adaptive_1");
  assert.equal(adaptiveSuggestions[1]?.title, "Bagaimana trace rekursi Merge Sort pada 6 elemen?");
  assert.equal(adaptiveSuggestions[2]?.id, "adaptive_2");

  // Suppress worked_example when answer already contains a tutorsteps block
  const alreadySteppedSuggestions = buildTutorActionSuggestions({
    messageId: "m-2",
    questionContent: "Hitung algoritma faktorial",
    answerContent: [
      "Berikut langkah pengerjaannya:",
      "```tutorsteps",
      '{"title":"Faktorial","steps":[{"label":"1","detail":"Base case"}]}',
      "```",
    ].join("\n"),
    sourcesCount: 1,
    existingSummaryArtifactId: "sum-saved-1",
  });

  assert.match(alreadySteppedSuggestions[0]?.title ?? "", /^Buka ringkasan/);
  assert.equal(alreadySteppedSuggestions[0]?.alreadySavedArtifactId, "sum-saved-1");
  assert.ok(alreadySteppedSuggestions.length <= 3);
  assert.equal(
    alreadySteppedSuggestions.some((item) => item.id === "worked_example"),
    false
  );
});

test("generateAndCacheMessageSuggestions generates, persists once, and falls back safely", async (t) => {
  const { default: prisma } = await import("../src/lib/prisma");
  const { generateAndCacheMessageSuggestions } = await import("../src/lib/tutor-ai/suggestions");

  function replace(target: object, key: string, value: unknown) {
    const record = target as Record<string, unknown>;
    const original = record[key];
    record[key] = value;
    t.after(() => {
      record[key] = original;
    });
  }

  let storedRagSources: Record<string, unknown> = {
    intent: "chat",
    sources: [
      {
        chunkId: "chunk-1",
        materialId: "material-1",
        materialTitle: "Modul Graph",
        fileName: "graph.pdf",
        publicUrl: null,
        sessionTitle: "Pertemuan 5",
        pageNumber: 4,
        chunkIndex: 0,
        similarity: 0.9,
        snippet: "BFS menelusuri simpul per level menggunakan queue FIFO.",
        sourceNumber: 1,
      },
    ],
  };

  let llmMode: "json" | "invalid" = "json";
  let generateCallCount = 0;

  replace(prisma.user, "findUnique", async () => ({
    id: "student-1",
    name: "Nadia",
    role: "mahasiswa",
    academicLevel: "S1",
  }));

  replace(prisma.course, "findFirst", async () => ({
    id: "course-1",
    title: "Struktur Data",
    description: null,
    isActive: true,
  }));

  replace(prisma.aiChatSession, "findFirst", async () => ({
    id: "chat-1",
    userId: "student-1",
    courseId: "course-1",
    messages: [
      {
        id: "user-1",
        senderType: "user",
        content: "Apa fungsi queue pada algoritma BFS?",
        ragSources: null,
        responseTimeMs: null,
        feedbacks: [],
        createdAt: new Date(),
      },
      {
        id: "ai-1",
        senderType: "ai",
        content: "**BFS** menggunakan struktur **Queue** FIFO untuk menelusuri graf per level [Sumber 1].",
        ragSources: storedRagSources,
        responseTimeMs: 300,
        feedbacks: [],
        createdAt: new Date(),
      },
    ],
  }));

  replace(prisma.aiChatMessage, "update", async ({ data }: { data: { ragSources: Record<string, unknown> } }) => {
    storedRagSources = data.ragSources;
    return { id: "ai-1", ragSources: storedRagSources };
  });

  t.mock.method(globalThis, "fetch", async () => {
    generateCallCount += 1;
    const text =
      llmMode === "json"
        ? JSON.stringify([
            {
              target: "studio",
              artifactType: "SUMMARY",
              label: "Ringkas cara kerja BFS & Queue ke Studio",
              prompt: "Ringkas materi BFS dan penggunaan queue ke Studio.",
            },
            {
              target: "chat",
              label: "Bagaimana trace urutan kunjungan BFS pada graf berbobot?",
              prompt: "Tunjukkan trace urutan kunjungan BFS langkah demi langkah.",
            },
            {
              target: "chat",
              label: "Apa bedanya antrean BFS dengan stack pada DFS?",
              prompt: "Bandingkan queue BFS dan stack DFS berdasarkan materi.",
            },
          ])
        : "bukan json yang valid";

    return Response.json({
      candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }],
    });
  });

  // Invalid LLM output falls back without throwing or persisting broken cache
  llmMode = "invalid";
  const fallbackResult = await generateAndCacheMessageSuggestions({
    courseId: "course-1",
    userId: "student-1",
    sessionId: "chat-1",
    messageId: "ai-1",
  });
  assert.equal(fallbackResult.cached, false);
  assert.equal(fallbackResult.suggestedActions.length, 3);
  assert.equal(parsePersistedSuggestedActions(storedRagSources).length, 0);

  // Valid LLM output generates 3 adaptive cards and persists into ragSources
  llmMode = "json";
  const freshResult = await generateAndCacheMessageSuggestions({
    courseId: "course-1",
    userId: "student-1",
    sessionId: "chat-1",
    messageId: "ai-1",
  });
  assert.equal(freshResult.cached, false);
  assert.equal(freshResult.suggestedActions[0]?.label, "Ringkas cara kerja BFS & Queue ke Studio");
  assert.equal(freshResult.suggestedActions.length, 3);
  assert.equal(parsePersistedSuggestedActions(storedRagSources).length, 3);

  // Subsequent call uses cache without calling Gemini
  const callsAfterPersist = generateCallCount;
  const cachedResult = await generateAndCacheMessageSuggestions({
    courseId: "course-1",
    userId: "student-1",
    sessionId: "chat-1",
    messageId: "ai-1",
  });
  assert.equal(cachedResult.cached, true);
  assert.equal(generateCallCount, callsAfterPersist);
});

test("studio export helpers format filename, Markdown, and escaped printable HTML", () => {
  assert.equal(
    buildStudioExportFilename("Ringkasan: Rekursi & Backtracking!", "md"),
    "ringkasan-rekursi-backtracking.md"
  );
  assert.equal(buildStudioExportFilename("???", "pdf"), "studio-tutor.pdf");

  const sampleArtifact: TutorStudioArtifactDto = {
    id: "art-1",
    courseId: "course-1",
    userId: "student-1",
    chatSessionId: "chat-1",
    sourceMessageId: null,
    type: "QUIZ",
    title: "Kuis <Rekursi> & Stack",
    content: "## Daftar Soal\n1. Apa itu base case? [Sumber 1]",
    sources: [
      {
        chunkId: "c-1",
        materialId: "m-1",
        materialTitle: "Modul Rekursi & Stack",
        fileName: "rekursi.pdf",
        publicUrl: null,
        sessionTitle: "Pertemuan 3",
        pageNumber: 5,
        chunkIndex: 0,
        similarity: 0.9,
        snippet: "Base case menghentikan panggilan rekursif.",
        sourceNumber: 1,
      },
    ],
    materialTitles: ["Modul Rekursi & Stack"],
    createdAt: "2026-11-24T05:00:00.000Z",
    updatedAt: "2026-11-24T05:00:00.000Z",
  };

  const md = buildStudioArtifactMarkdown(sampleArtifact);
  assert.match(md, /^# Kuis <Rekursi> & Stack/);
  assert.match(md, /## Referensi Sumber/);
  assert.match(md, /\[Sumber 1\] Modul Rekursi & Stack \(Pertemuan 3, Halaman 5\)/);

  const html = buildStudioPrintableHtml({
    artifact: sampleArtifact,
    renderedBodyHtml: "<h2>Daftar Soal</h2><p>Apa itu base case?</p>",
  });
  assert.match(html, /&lt;Rekursi&gt; &amp; Stack/);
  assert.match(html, /<h2>Daftar Soal<\/h2><p>Apa itu base case\?<\/p>/);
});

test("studio service generates, saves notes idempotently, filters, renames, and deletes artifacts", async (t) => {
  const h = await createStudioHarness(t);

  // 1. Generate SUMMARY anchored to msg-ai-1, stripping H1 into title and removing invalid [Sumber 99]
  const summaryRes = await h.studio.generateTutorStudioArtifact({
    courseId: "course-1",
    userId: "student-1",
    type: "SUMMARY",
    chatSessionId: "chat-1",
    anchorMessageId: "msg-ai-1",
  });

  assert.equal(summaryRes.alreadyExisted, false);
  assert.equal(summaryRes.artifact.title, "Memahami Rekursi dan Base Case");
  assert.equal(summaryRes.artifact.sources.length, 1);
  assert.equal(summaryRes.artifact.content.includes("[Sumber 1]"), true);
  assert.equal(summaryRes.artifact.content.includes("[Sumber 99]"), false);

  // 2. Calling again with same anchorMessageId returns cached artifact without LLM call
  const fetchCountBefore = h.fetchRequests.length;
  const cachedSummaryRes = await h.studio.generateTutorStudioArtifact({
    courseId: "course-1",
    userId: "student-1",
    type: "SUMMARY",
    chatSessionId: "chat-1",
    anchorMessageId: "msg-ai-1",
  });
  assert.equal(cachedSummaryRes.alreadyExisted, true);
  assert.equal(cachedSummaryRes.artifact.id, summaryRes.artifact.id);
  assert.equal(h.fetchRequests.length, fetchCountBefore);

  // 3. Save chat message as NOTE idempotently with resolved preceding question title & sources
  const noteRes = await h.studio.saveMessageToStudioNote({
    courseId: "course-1",
    userId: "student-1",
    chatSessionId: "chat-1",
    sourceMessageId: "msg-ai-1",
    content: "Rekursi memanggil dirinya sendiri hingga menyentuh base case. [Sumber 1]",
  });
  assert.equal(noteRes.alreadyExisted, false);
  assert.equal(noteRes.artifact.type, "NOTE");
  assert.equal(noteRes.artifact.title, "Bagaimana cara kerja rekursi dan base case");
  assert.equal(noteRes.artifact.sources.length, 1);

  const duplicateNoteRes = await h.studio.saveMessageToStudioNote({
    courseId: "course-1",
    userId: "student-1",
    chatSessionId: "chat-1",
    sourceMessageId: "msg-ai-1",
    content: "Duplicate attempt",
  });
  assert.equal(duplicateNoteRes.alreadyExisted, true);

  // 4. Filter by scope and type
  const notesOnly = await h.studio.listTutorStudioArtifacts({
    courseId: "course-1",
    userId: "student-1",
    scope: "session",
    chatSessionId: "chat-1",
    type: "NOTE",
  });
  assert.equal(notesOnly.length, 1);
  assert.equal(notesOnly[0]?.id, noteRes.artifact.id);

  // 5. Rename & delete
  const renamed = await h.studio.renameTutorStudioArtifact({
    courseId: "course-1",
    userId: "student-1",
    artifactId: noteRes.artifact.id,
    title: "Catatan Inti Rekursi",
  });
  assert.equal(renamed.title, "Catatan Inti Rekursi");

  await h.studio.deleteTutorStudioArtifact({
    courseId: "course-1",
    userId: "student-1",
    artifactId: noteRes.artifact.id,
  });

  await assert.rejects(
    () =>
      h.studio.getTutorStudioArtifact({
        courseId: "course-1",
        userId: "student-1",
        artifactId: noteRes.artifact.id,
      }),
    /tidak ditemukan/i
  );
});
