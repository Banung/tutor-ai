import { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";
import {
  buildTutorActionSuggestions,
  parsePersistedSuggestedActions,
  persistedSuggestedActionSchema,
  type PersistedSuggestedAction,
} from "@/lib/tutor-ai/action-suggestions";
import { TutorAiServiceError } from "@/lib/tutor-ai/error";
import { generateTutorAnswer } from "@/lib/tutor-ai/gemini";
import { getSessionOrThrow, getTutorAccess } from "@/lib/tutor-ai/service";

type RawSourceSnippet = {
  materialTitle?: unknown;
  pageNumber?: unknown;
  snippet?: unknown;
};

function extractGroundedSnippets(ragSources: unknown) {
  if (!ragSources || typeof ragSources !== "object" || Array.isArray(ragSources)) {
    return [] as Array<{ materialTitle: string; pageNumber: number; snippet: string }>;
  }

  const rawSources = (ragSources as { sources?: unknown }).sources;
  if (!Array.isArray(rawSources)) return [];

  const snippets: Array<{ materialTitle: string; pageNumber: number; snippet: string }> = [];
  for (const item of rawSources as RawSourceSnippet[]) {
    if (
      typeof item.materialTitle === "string" &&
      typeof item.pageNumber === "number" &&
      typeof item.snippet === "string"
    ) {
      snippets.push({
        materialTitle: item.materialTitle,
        pageNumber: item.pageNumber,
        snippet: item.snippet.slice(0, 420),
      });
    }
    if (snippets.length >= 4) break;
  }
  return snippets;
}

function parseSuggestionsFromLlmJson(rawText: string): PersistedSuggestedAction[] {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleaned);
  } catch {
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!arrayMatch) return [];
    try {
      parsedJson = JSON.parse(arrayMatch[0]);
    } catch {
      return [];
    }
  }

  const candidateArray = Array.isArray(parsedJson)
    ? parsedJson
    : parsedJson &&
        typeof parsedJson === "object" &&
        "suggestedActions" in parsedJson &&
        Array.isArray((parsedJson as { suggestedActions?: unknown }).suggestedActions)
      ? (parsedJson as { suggestedActions: unknown[] }).suggestedActions
      : [];

  const validated: PersistedSuggestedAction[] = [];
  for (const item of candidateArray) {
    const res = persistedSuggestedActionSchema.safeParse(item);
    if (res.success) {
      validated.push(res.data);
    }
    if (validated.length >= 3) break;
  }

  return validated;
}

function toDeterministicPersistedSuggestions(input: {
  messageId: string;
  answerContent: string;
  questionContent?: string;
  sourcesCount: number;
}): PersistedSuggestedAction[] {
  return buildTutorActionSuggestions({
    messageId: input.messageId,
    answerContent: input.answerContent,
    questionContent: input.questionContent,
    sourcesCount: input.sourcesCount,
  }).map((card) => ({
    label: card.title,
    prompt: card.prompt ?? card.title,
    target: card.target,
    ...(card.artifactType ? { artifactType: card.artifactType } : {}),
  }));
}

/**
 * Generate up to 3 adaptive contextual suggestion cards for a grounded AI message
 * using Gemini and cache them into `aiChatMessage.ragSources.suggestedActions`.
 */
export async function generateAndCacheMessageSuggestions(input: {
  courseId: string;
  userId: string;
  sessionId: string;
  messageId: string;
  signal?: AbortSignal;
}): Promise<{ suggestedActions: PersistedSuggestedAction[]; cached: boolean }> {
  await getTutorAccess(input.courseId, input.userId);
  const session = await getSessionOrThrow({
    courseId: input.courseId,
    userId: input.userId,
    sessionId: input.sessionId,
  });

  const answerIndex = session.messages.findIndex(
    (msg) => msg.id === input.messageId && msg.senderType === "ai"
  );
  const answer = session.messages[answerIndex];
  if (!answer) {
    throw new TutorAiServiceError("Jawaban Tutor AI tidak ditemukan.", 404);
  }

  const existingMeta =
    answer.ragSources && typeof answer.ragSources === "object" && !Array.isArray(answer.ragSources)
      ? (answer.ragSources as Record<string, unknown>)
      : {};

  if (existingMeta.intent === "summary") {
    throw new TutorAiServiceError("Saran tindak lanjut hanya untuk jawaban chat.", 400);
  }

  const snippets = extractGroundedSnippets(answer.ragSources);
  if (snippets.length === 0) {
    throw new TutorAiServiceError("Jawaban ini belum memiliki sumber materi untuk saran.", 400);
  }

  const cached = parsePersistedSuggestedActions(answer.ragSources);
  if (cached.length >= 2) {
    return { suggestedActions: cached, cached: true };
  }

  const precedingUser = session.messages
    .slice(0, answerIndex)
    .reverse()
    .find((msg) => msg.senderType === "user");

  const systemInstruction = `Kamu merancang 3 kartu saran tindak lanjut yang singkat, tajam, dan kontekstual di bawah jawaban Tutor AI (seperti Gemini/NotebookLM).
Gunakan bahasa yang sama dengan pertanyaan mahasiswa (umumnya Bahasa Indonesia akademik yang natural).
Balas HANYA JSON array berisi tepat 3 objek valid tanpa teks tambahan di luar JSON:
1) Item pertama WAJIB {"target": "studio", "artifactType": "SUMMARY", "label": "...", "prompt": "..."} berupa ajakan ringkas & spesifik merangkum topik inti jawaban ini ke panel Studio (label maksimal 58 karakter, contoh: "Ringkas perbandingan Merge & Quick Sort ke Studio").
2) Item ke-2 dan ke-3 {"target": "chat", "label": "...", "prompt": "..."} (atau boleh 1 item "studio" dengan artifactType "QUIZ" / "FLASHCARDS" bila sangat pas untuk latihan) adalah pertanyaan lanjutan yang sangat relevan dengan kutipan PDF dan konteks diskusi.
Aturan ketat:
- Label singkat dan mudah dipindai (maksimal 74 karakter, tanpa awalan label seperti "[Tabel]" atau emoji).
- Prompt jelas dan lengkap (1 kalimat instruksi untuk Tutor AI saat diklik).
- JANGAN mengulang format atau poin yang sudah dijawab penuh pada respons Tutor AI di bawah.
- Dasarkan topik lanjutan pada kutipan PDF yang tersedia agar mahasiswa terbantu mengeksplorasi detail penting berikutnya.`;

  const promptPayload = JSON.stringify({
    pertanyaanMahasiswa: precedingUser?.content.slice(0, 500) ?? "",
    jawabanTutor: answer.content.slice(0, 1800),
    kutipanMateri: snippets,
  });

  try {
    const rawLlm = await generateTutorAnswer({
      systemInstruction,
      prompt: promptPayload,
      signal: input.signal,
      timeoutMs: 12_000,
      maxOutputTokens: 512,
    });

    const parsed = parseSuggestionsFromLlmJson(rawLlm);
    const hasSummary = parsed.some(
      (item) => item.target === "studio" && item.artifactType === "SUMMARY"
    );
    const followUps = parsed.filter(
      (item) => !(item.target === "studio" && item.artifactType === "SUMMARY")
    );

    if (parsed.length >= 2 && followUps.length >= 1) {
      const normalizedSummary: PersistedSuggestedAction = hasSummary
        ? parsed.find((item) => item.target === "studio" && item.artifactType === "SUMMARY")!
        : {
            label: "Ringkas topik ini ke Studio",
            prompt: "Buat ringkasan belajar mendalam tentang topik di atas.",
            target: "studio",
            artifactType: "SUMMARY",
          };
      const finalActions = [normalizedSummary, ...followUps.slice(0, 2)];

      await prisma.aiChatMessage.update({
        where: { id: answer.id },
        data: {
          ragSources: {
            ...existingMeta,
            suggestedActions: finalActions,
          } as unknown as Prisma.InputJsonValue,
        },
      });

      return { suggestedActions: finalActions, cached: false };
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
  }

  return {
    suggestedActions: toDeterministicPersistedSuggestions({
      messageId: answer.id,
      answerContent: answer.content,
      questionContent: precedingUser?.content,
      sourcesCount: snippets.length,
    }),
    cached: false,
  };
}
