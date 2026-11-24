import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";
import { embedTutorQuestion, generateTutorAnswer } from "@/lib/tutor-ai/gemini";
import { MAX_TUTOR_SUMMARY_CONTEXT_CHUNKS } from "@/lib/tutor-ai/retrieval-config";
import {
  TUTOR_STUDIO_TYPE_META,
  type TutorStudioArtifactDto,
  type TutorStudioArtifactType,
  type TutorStudioGeneratableType,
  type TutorStudioScope,
  type TutorStudioSource,
  tutorStudioSourceSchema,
} from "@/lib/tutor-ai/studio-schema";
import {
  TutorAiServiceError,
  buildContextBlock,
  buildSummaryRetrievalQuestion,
  buildSystemInstruction,
  getSessionOrThrow,
  getStoredSelectedMaterialIds,
  getSummaryAnchor,
  getTutorAccess,
  groupRetrievedChunksByPage,
  listReadyMaterialsForCourse,
  retrieveRelevantChunks,
  toRagSource,
  type ReadyMaterial,
  type RetrievedPageSource,
} from "@/lib/tutor-ai/service";

const STUDIO_GENERATION_GUIDANCE: Record<
  TutorStudioGeneratableType,
  {
    retrievalPrefix: string;
    promptTitle: string;
    instruction: string;
    maxOutputTokens: number;
  }
> = {
  SUMMARY: {
    retrievalPrefix: "Konsep utama, definisi, mekanisme, dan keterkaitan materi",
    promptTitle: "Ringkasan Belajar Mendalam",
    instruction: `Buat artikel ringkasan belajar yang utuh, terstruktur, dan mendalam dalam bahasa Indonesia (atau ikuti bahasa topik bila relevan).
Awali baris pertama dengan satu judul H1 (# Judul Topik yang Spesifik dan Jelas).
Lalu susun pembahasan dalam subjudul (## ...) yang mengalir runtut: pengantar singkat, penjelasan inti dan definisi, cara kerja atau konsep lanjutan, perbandingan/contoh bila ada di sumber, serta sintesis penutup.
Cantumkan sitasi [Sumber N] pada klaim yang didukung potongan PDF. Targetkan sekitar 650 sampai 1050 kata, namun jangan mengarang detail jika bukti terbatas.`,
    maxOutputTokens: 4096,
  },
  QUIZ: {
    retrievalPrefix: "Konsep kunci, rumus, definisi, dan penerapan untuk soal evaluasi",
    promptTitle: "Kuis Latihan Materi",
    instruction: `Buat paket kuis latihan yang menguji pemahaman (bukan sekadar hafalan kata) berdasarkan konteks PDF yang diberikan.
Awali baris pertama dengan satu judul H1 (# Kuis Latihan: Topik Materi).
Sajikan 5 soal bervariasi (campuran Pilihan Ganda A-D dan Uraian/Analisis Singkat) di bagian "## Daftar Soal".
Setelah semua soal, buat bagian terpisah "## Kunci Jawaban & Pembahasan" yang menuliskan jawaban benar, alasan ringkas, serta sitasi [Sumber N] untuk setiap nomor soal.`,
    maxOutputTokens: 4096,
  },
  FLASHCARDS: {
    retrievalPrefix: "Istilah penting, definisi inti, prinsip dasar, dan rumus kunci materi",
    promptTitle: "Dek Flashcard Konsep",
    instruction: `Buat 6 sampai 8 flashcard belajar aktif (active recall) dari konsep terpenting di konteks PDF yang diberikan.
Awali baris pertama dengan satu judul H1 (# Flashcard: Topik Materi).
Format setiap kartu secara seragam menggunakan subjudul:
### Kartu N: Nama Konsep Singkat
- **Pertanyaan:** Pertanyaan uji ingat yang tajam dan spesifik.
- **Jawaban Inti:** Jawaban ringkas, akurat, dan mudah diingat beserta sitasi [Sumber N].`,
    maxOutputTokens: 3072,
  },
};

function parseStoredSources(raw: Prisma.JsonValue): TutorStudioSource[] {
  if (!Array.isArray(raw)) return [];
  const parsed: TutorStudioSource[] = [];
  for (const item of raw) {
    const result = tutorStudioSourceSchema.safeParse(item);
    if (result.success) {
      parsed.push(result.data);
    }
  }
  return parsed;
}

function parseStoredStringArray(raw: Prisma.JsonValue): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

type TutorStudioArtifactRecord = {
  id: string;
  courseId: string;
  userId: string;
  chatSessionId: string | null;
  sourceMessageId: string | null;
  type: TutorStudioArtifactType;
  title: string;
  content: string;
  sources: Prisma.JsonValue;
  materialTitles: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
};

function toStudioArtifactDto(row: TutorStudioArtifactRecord): TutorStudioArtifactDto {
  return {
    id: row.id,
    courseId: row.courseId,
    userId: row.userId,
    chatSessionId: row.chatSessionId,
    sourceMessageId: row.sourceMessageId,
    type: row.type,
    title: row.title,
    content: row.content,
    sources: parseStoredSources(row.sources),
    materialTitles: parseStoredStringArray(row.materialTitles),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function extractTitleAndContent(
  rawMarkdown: string,
  fallbackTitle: string
): { title: string; content: string } {
  const normalized = rawMarkdown.replace(/\r\n/g, "\n").trim();
  const lines = normalized.split("\n");
  const firstNonEmptyIndex = lines.findIndex((line) => line.trim().length > 0);

  if (firstNonEmptyIndex !== -1) {
    const firstLine = lines[firstNonEmptyIndex].trim();
    const h1Match = firstLine.match(/^#\s+(.+)$/);
    if (h1Match?.[1]) {
      const cleanedTitle = h1Match[1]
        .replace(/[*_`]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 115);
      const remainingBody = [
        ...lines.slice(0, firstNonEmptyIndex),
        ...lines.slice(firstNonEmptyIndex + 1),
      ]
        .join("\n")
        .trim();

      if (cleanedTitle.length > 0 && remainingBody.length > 0) {
        return { title: cleanedTitle, content: remainingBody };
      }
    }
  }

  return {
    title: fallbackTitle.slice(0, 115),
    content: normalized,
  };
}

function deriveNoteFallbackTitle(
  content: string,
  precedingQuestion?: string
): string {
  const cleanedQuestion = (precedingQuestion ?? "")
    .replace(/\s+/g, " ")
    .replace(/[?!.]+$/g, "")
    .trim();
  if (cleanedQuestion.length >= 6) {
    return cleanedQuestion.slice(0, 110);
  }

  const headingMatch = content.match(/^#{1,3}\s+(.+)$/m);
  if (headingMatch?.[1]) {
    return headingMatch[1].replace(/[*_`]/g, "").trim().slice(0, 110);
  }

  const firstSentence = content
    .replace(/\[Sumber\s+\d+\]/gi, "")
    .replace(/[#>*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return firstSentence.slice(0, 80) || "Catatan Tutor AI";
}

function collectCitedStudioSources(
  markdownContent: string,
  pageSources: RetrievedPageSource[]
): { content: string; sources: TutorStudioSource[] } {
  const pageByNumber = new Map<number, RetrievedPageSource>(
    pageSources.map((page) => [page.sourceNumber, page])
  );
  const citedNumbers = new Set<number>();

  const sanitizedContent = markdownContent.replace(
    /\[((?:Sumber\s+\d+)(?:\s*,\s*(?:Sumber\s+)?\d+)*)\]/gi,
    (fullMatch, group: string) => {
      const validNums = [...group.matchAll(/(?:Sumber\s+)?(\d+)/gi)]
        .map((match) => Number(match[1]))
        .filter((num) => pageByNumber.has(num));

      if (validNums.length === 0) {
        return "";
      }

      const uniqueNums = [...new Set(validNums)];
      uniqueNums.forEach((num) => citedNumbers.add(num));
      return uniqueNums.map((num) => `[Sumber ${num}]`).join(", ");
    }
  );

  const chosenPages =
    citedNumbers.size > 0
      ? pageSources.filter((page) => citedNumbers.has(page.sourceNumber))
      : pageSources.slice(0, 4);

  const sources: TutorStudioSource[] = chosenPages.flatMap((page) =>
    page.chunks.map((chunk) => ({
      ...toRagSource(chunk),
      sourceNumber: page.sourceNumber,
    }))
  );

  return {
    content: sanitizedContent.replace(/\s{2,}/g, (match) =>
      match.includes("\n") ? match : " "
    ).trim(),
    sources,
  };
}

function buildFallbackArtifactTitle(
  type: TutorStudioGeneratableType,
  topic: string | undefined,
  materials: ReadyMaterial[]
): string {
  const prefix = TUTOR_STUDIO_TYPE_META[type].label;
  const cleanTopic = topic?.replace(/\s+/g, " ").trim();
  if (cleanTopic) {
    return `${prefix}: ${cleanTopic}`.slice(0, 115);
  }
  if (materials.length === 1) {
    return `${prefix}: ${materials[0].title}`.slice(0, 115);
  }
  return `${prefix} Materi (${materials.length} PDF)`.slice(0, 115);
}

/** List saved Studio artifacts for the enrolled student in a course, optionally filtered by session or type. */
export async function listTutorStudioArtifacts(input: {
  courseId: string;
  userId: string;
  scope?: TutorStudioScope;
  chatSessionId?: string;
  type?: TutorStudioArtifactType;
}): Promise<TutorStudioArtifactDto[]> {
  await getTutorAccess(input.courseId, input.userId);

  if (input.scope === "session" && !input.chatSessionId) {
    return [];
  }

  const rows = await prisma.tutorStudioArtifact.findMany({
    where: {
      courseId: input.courseId,
      userId: input.userId,
      ...(input.scope === "session" && input.chatSessionId
        ? { chatSessionId: input.chatSessionId }
        : {}),
      ...(input.type ? { type: input.type } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  return rows.map(toStudioArtifactDto);
}

/** Fetch a single Studio artifact belonging to the authenticated student inside the course. */
export async function getTutorStudioArtifact(input: {
  courseId: string;
  userId: string;
  artifactId: string;
}): Promise<TutorStudioArtifactDto> {
  await getTutorAccess(input.courseId, input.userId);

  const row = await prisma.tutorStudioArtifact.findFirst({
    where: {
      id: input.artifactId,
      courseId: input.courseId,
      userId: input.userId,
    },
  });

  if (!row) {
    throw new TutorAiServiceError("Artefak Studio tidak ditemukan.", 404);
  }

  return toStudioArtifactDto(row);
}

/** Save an AI chat response as a NOTE artifact in Studio (idempotent per sourceMessageId). */
export async function saveMessageToStudioNote(input: {
  courseId: string;
  userId: string;
  chatSessionId?: string | null;
  sourceMessageId?: string | null;
  title?: string;
  content: string;
  sources?: TutorStudioSource[];
}): Promise<{ artifact: TutorStudioArtifactDto; alreadyExisted: boolean }> {
  await getTutorAccess(input.courseId, input.userId);

  if (input.sourceMessageId) {
    const existing = await prisma.tutorStudioArtifact.findFirst({
      where: {
        courseId: input.courseId,
        userId: input.userId,
        type: "NOTE",
        sourceMessageId: input.sourceMessageId,
      },
    });
    if (existing) {
      return { artifact: toStudioArtifactDto(existing), alreadyExisted: true };
    }
  }

  let resolvedSources = input.sources ?? [];
  let precedingQuestion: string | undefined;

  if (input.chatSessionId) {
    const session = await getSessionOrThrow({
      courseId: input.courseId,
      userId: input.userId,
      sessionId: input.chatSessionId,
    });

    if (input.sourceMessageId) {
      const msgIndex = session.messages.findIndex(
        (msg) => msg.id === input.sourceMessageId && msg.senderType === "ai"
      );
      if (msgIndex >= 0) {
        const prevUser = session.messages
          .slice(0, msgIndex)
          .reverse()
          .find((msg) => msg.senderType === "user");
        precedingQuestion = prevUser?.content;

        if (resolvedSources.length === 0) {
          const ragMeta = session.messages[msgIndex].ragSources;
          if (ragMeta && typeof ragMeta === "object" && !Array.isArray(ragMeta)) {
            const rawSources = (ragMeta as { sources?: unknown }).sources;
            if (Array.isArray(rawSources)) {
              resolvedSources = rawSources
                .map((item) => tutorStudioSourceSchema.safeParse(item))
                .filter((res): res is { success: true; data: TutorStudioSource } => res.success)
                .map((res) => res.data);
            }
          }
        }
      }
    }
  }

  const materialIds = [...new Set(resolvedSources.map((source) => source.materialId))];
  const materialTitles = [...new Set(resolvedSources.map((source) => source.materialTitle))];
  const resolvedTitle = (
    input.title?.trim() || deriveNoteFallbackTitle(input.content, precedingQuestion)
  ).slice(0, 120);

  const created = await prisma.tutorStudioArtifact.create({
    data: {
      courseId: input.courseId,
      userId: input.userId,
      chatSessionId: input.chatSessionId ?? null,
      sourceMessageId: input.sourceMessageId ?? null,
      type: "NOTE",
      title: resolvedTitle,
      content: input.content.trim(),
      sources: resolvedSources as unknown as Prisma.InputJsonValue,
      materialIds: materialIds as unknown as Prisma.InputJsonValue,
      materialTitles: materialTitles as unknown as Prisma.InputJsonValue,
    },
  });

  return { artifact: toStudioArtifactDto(created), alreadyExisted: false };
}

/**
 * Generate a Studio artifact (SUMMARY, QUIZ, or FLASHCARDS) grounded in selected course PDFs
 * and optional anchor message context without polluting the chat message stream.
 */
export async function generateTutorStudioArtifact(input: {
  courseId: string;
  userId: string;
  type: TutorStudioGeneratableType;
  chatSessionId?: string | null;
  anchorMessageId?: string | null;
  materialIds?: string[];
  topic?: string;
  signal?: AbortSignal;
}): Promise<{ artifact: TutorStudioArtifactDto; alreadyExisted: boolean }> {
  const { user, course } = await getTutorAccess(input.courseId, input.userId);
  const readyMaterials = await listReadyMaterialsForCourse(input.courseId);

  if (readyMaterials.length === 0) {
    throw new TutorAiServiceError(
      "Belum ada materi PDF yang siap digunakan di course ini.",
      400
    );
  }

  const readyIds = readyMaterials.map((material) => material.id);
  const readyIdSet = new Set(readyIds);

  let session: Awaited<ReturnType<typeof getSessionOrThrow>> | null = null;
  if (input.chatSessionId) {
    session = await getSessionOrThrow({
      courseId: input.courseId,
      userId: input.userId,
      sessionId: input.chatSessionId,
    });
  }

  if (input.anchorMessageId) {
    const existing = await prisma.tutorStudioArtifact.findFirst({
      where: {
        courseId: input.courseId,
        userId: input.userId,
        type: input.type,
        sourceMessageId: input.anchorMessageId,
      },
    });
    if (existing) {
      return { artifact: toStudioArtifactDto(existing), alreadyExisted: true };
    }
  }

  let selectedMaterialIds: string[];
  if (input.materialIds && input.materialIds.length > 0) {
    selectedMaterialIds = input.materialIds.filter((id) => readyIdSet.has(id));
    if (selectedMaterialIds.length === 0) {
      throw new TutorAiServiceError(
        "Materi PDF yang dipilih tidak tersedia atau belum siap.",
        400
      );
    }
  } else if (session) {
    selectedMaterialIds = await getStoredSelectedMaterialIds(
      session.id,
      readyIds
    );
  } else {
    selectedMaterialIds = readyIds;
  }

  const activeMaterials = readyMaterials.filter((material) =>
    selectedMaterialIds.includes(material.id)
  );
  const guidance = STUDIO_GENERATION_GUIDANCE[input.type];

  let anchorExchange: { senderType: string; content: string }[] = [];
  if (input.anchorMessageId) {
    if (!session) {
      throw new TutorAiServiceError(
        "Sesi chat diperlukan untuk membuat artefak dari pesan ini.",
        400
      );
    }
    anchorExchange = getSummaryAnchor(session.messages, input.anchorMessageId);
  }

  const cleanTopic = input.topic?.trim();
  const baseFocus =
    cleanTopic ||
    anchorExchange[0]?.content ||
    activeMaterials.map((material) => material.title).join(", ");

  const retrievalQuery =
    anchorExchange.length > 0
      ? `${guidance.retrievalPrefix}\n${buildSummaryRetrievalQuestion(
          anchorExchange,
          baseFocus
        )}`
      : `${guidance.retrievalPrefix}: ${baseFocus}`;

  const embedding = await embedTutorQuestion(retrievalQuery, input.signal);
  const chunks = await retrieveRelevantChunks({
    courseId: input.courseId,
    selectedMaterialIds,
    questionEmbedding: embedding,
    limit: MAX_TUTOR_SUMMARY_CONTEXT_CHUNKS,
  });

  if (chunks.length === 0) {
    throw new TutorAiServiceError(
      "Belum ditemukan bagian materi PDF terpilih yang cukup relevan untuk disusun di Studio.",
      422
    );
  }

  const systemInstruction = await buildSystemInstruction(user, "chat");
  const anchorContextBlock =
    anchorExchange.length > 0
      ? [
          "Fokus pertanyaan dan jawaban chat acuan (hanya untuk menentukan fokus topik, bukan bukti fakta):",
          JSON.stringify(anchorExchange),
          "",
        ].join("\n")
      : cleanTopic
        ? `Fokus topik permintaan mahasiswa: ${JSON.stringify(cleanTopic)}\n\n`
        : "";

  const prompt = [
    `Course (data): ${JSON.stringify(course.title)}`,
    course.description
      ? `Deskripsi course (data): ${JSON.stringify(course.description)}`
      : null,
    "",
    "Materi PDF aktif yang dijadikan acuan:",
    activeMaterials
      .map((material, index) => `${index + 1}. ${material.title} (${material.fileName})`)
      .join("\n"),
    "",
    anchorContextBlock + "Konteks retrieved dari PDF (gunakan ini sebagai satu-satunya bukti fakta):",
    buildContextBlock(chunks),
    "",
    `Tugas Studio: ${guidance.promptTitle}`,
    guidance.instruction,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const generatedRaw = await generateTutorAnswer({
    systemInstruction,
    prompt,
    signal: input.signal,
    timeoutMs: 90_000,
    maxOutputTokens: guidance.maxOutputTokens,
  });

  const fallbackTitle = buildFallbackArtifactTitle(
    input.type,
    cleanTopic || anchorExchange[0]?.content,
    activeMaterials
  );
  const { title, content } = extractTitleAndContent(generatedRaw, fallbackTitle);
  const pageSources = groupRetrievedChunksByPage(chunks);
  const cited = collectCitedStudioSources(content, pageSources);
  const materialTitles = [
    ...new Set(
      cited.sources.length > 0
        ? cited.sources.map((source) => source.materialTitle)
        : activeMaterials.map((material) => material.title)
    ),
  ];

  const created = await prisma.tutorStudioArtifact.create({
    data: {
      courseId: input.courseId,
      userId: input.userId,
      chatSessionId: session?.id ?? null,
      sourceMessageId: input.anchorMessageId ?? null,
      type: input.type,
      title,
      content: cited.content,
      sources: cited.sources as unknown as Prisma.InputJsonValue,
      materialIds: selectedMaterialIds as unknown as Prisma.InputJsonValue,
      materialTitles: materialTitles as unknown as Prisma.InputJsonValue,
    },
  });

  return { artifact: toStudioArtifactDto(created), alreadyExisted: false };
}

/** Rename a saved Studio artifact owned by the authenticated student. */
export async function renameTutorStudioArtifact(input: {
  courseId: string;
  userId: string;
  artifactId: string;
  title: string;
}): Promise<TutorStudioArtifactDto> {
  await getTutorAccess(input.courseId, input.userId);

  const existing = await prisma.tutorStudioArtifact.findFirst({
    where: {
      id: input.artifactId,
      courseId: input.courseId,
      userId: input.userId,
    },
    select: { id: true },
  });

  if (!existing) {
    throw new TutorAiServiceError("Artefak Studio tidak ditemukan.", 404);
  }

  const updated = await prisma.tutorStudioArtifact.update({
    where: { id: existing.id },
    data: { title: input.title.trim().slice(0, 120) },
  });

  return toStudioArtifactDto(updated);
}

/** Delete a saved Studio artifact owned by the authenticated student. */
export async function deleteTutorStudioArtifact(input: {
  courseId: string;
  userId: string;
  artifactId: string;
}): Promise<{ id: string }> {
  await getTutorAccess(input.courseId, input.userId);

  const existing = await prisma.tutorStudioArtifact.findFirst({
    where: {
      id: input.artifactId,
      courseId: input.courseId,
      userId: input.userId,
    },
    select: { id: true },
  });

  if (!existing) {
    throw new TutorAiServiceError("Artefak Studio tidak ditemukan.", 404);
  }

  await prisma.tutorStudioArtifact.delete({
    where: { id: existing.id },
  });

  return { id: existing.id };
}
