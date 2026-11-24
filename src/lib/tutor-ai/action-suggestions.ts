import { z } from "zod/v4";
import type { TutorStudioGeneratableType } from "./studio-schema";

export type TutorActionSuggestionKind =
  | "summary_studio"
  | "adaptive_1"
  | "adaptive_2"
  | "worked_example"
  | "comparison_table"
  | "flashcards_studio"
  | "quick_quiz_studio"
  | "simplify"
  | "case_study";

export const persistedSuggestedActionSchema = z.object({
  label: z.string().trim().min(6).max(110),
  prompt: z.string().trim().min(6).max(400),
  target: z.enum(["chat", "studio"]),
  artifactType: z.enum(["SUMMARY", "QUIZ", "FLASHCARDS"]).optional(),
});

export type PersistedSuggestedAction = z.infer<
  typeof persistedSuggestedActionSchema
>;

export type TutorActionSuggestion = {
  id: TutorActionSuggestionKind;
  title: string;
  description: string;
  badgeLabel: string;
  target: "studio" | "chat";
  artifactType?: TutorStudioGeneratableType;
  prompt?: string;
  topicHint?: string;
  alreadySavedArtifactId?: string;
};

export type BuildTutorActionSuggestionsInput = {
  messageId: string;
  answerContent: string;
  questionContent?: string;
  sourcesCount: number;
  existingSummaryArtifactId?: string | null;
  existingQuizArtifactId?: string | null;
  existingFlashcardsArtifactId?: string | null;
  persistedSuggestions?: PersistedSuggestedAction[];
};

const MAX_CONTEXTUAL_FOLLOW_UPS = 2;

const MATH_OR_PROCEDURE_RE =
  /(?:\$\$?|\\frac|\\sum|\\int|\\cdot|=|langkah|algoritma|hitung|rumus|persamaan|kompleksitas|pseudocode|kode|fungsi|turunan|integral|matriks|graf|rekursi|simulasi|prosedur)/i;

const COMPARISON_RE =
  /(?:\bvs\b|\bversus\b|dibandingkan|perbandingan|perbedaan|beda\b|kelebihan|kekurangan|keunggulan|keterbatasan|trade-?off|antara\b|manakah\b)/i;

const QUESTION_PREFIX_RE =
  /^(?:tolong\s+)?(?:jelaskan|terangkan|bagaimana|apa\s+itu|apa\s+saja|apa\s+perbedaan|apa|mengapa|kenapa|kapan|di\s+mana|siapa|sebutkan|buatkan|uraikan|bandingkan|how\s+does|how\s+do|how\s+to|what\s+are|what\s+is|why\s+does|why\s+is|explain|compare)\s+/i;

const CONCEPT_STOPWORDS = new Set([
  "kesimpulan",
  "ringkasan",
  "contoh",
  "pengertian",
  "definisi",
  "langkah",
  "konsep",
  "catatan",
  "penting",
  "kelebihan",
  "kekurangan",
  "sumber",
]);

function truncateAtWord(text: string, maxLength: number): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxLength) return cleaned;
  const sliced = cleaned.slice(0, maxLength - 3);
  const lastSpace = sliced.lastIndexOf(" ");
  return `${(lastSpace > maxLength * 0.5 ? sliced.slice(0, lastSpace) : sliced).trim()}...`;
}

/** Extract clean persisted adaptive suggestions embedded inside AiChatMessage.ragSources JSON. */
export function parsePersistedSuggestedActions(
  ragSources: unknown
): PersistedSuggestedAction[] {
  if (!ragSources || typeof ragSources !== "object" || Array.isArray(ragSources)) {
    return [];
  }

  const raw = (ragSources as { suggestedActions?: unknown }).suggestedActions;
  if (!Array.isArray(raw)) {
    return [];
  }

  const parsed: PersistedSuggestedAction[] = [];
  for (const entry of raw) {
    const result = persistedSuggestedActionSchema.safeParse(entry);
    if (result.success) {
      parsed.push(result.data);
    }
    if (parsed.length >= 3) break;
  }
  return parsed;
}

/** Extract up to 2 salient technical terms/entities discussed in the turn. */
export function extractKeyConcepts(
  questionContent: string | undefined,
  answerContent: string
): string | undefined {
  const terms: string[] = [];
  const seen = new Set<string>();

  const boldMatches = answerContent.matchAll(/\*\*([^*\n]{2,42})\*\*/g);
  for (const match of boldMatches) {
    const raw = match[1].replace(/[:.;,]+$/g, "").trim();
    const norm = raw.toLowerCase();
    if (!raw || seen.has(norm) || CONCEPT_STOPWORDS.has(norm)) continue;
    seen.add(norm);
    terms.push(raw);
    if (terms.length >= 2) break;
  }

  if (terms.length === 0 && questionContent) {
    const capMatches = questionContent.matchAll(
      /\b([A-Z][a-zA-Z0-9+-]*(?:\s+[A-Z][a-zA-Z0-9+-]*){0,2})\b/g
    );
    for (const match of capMatches) {
      const raw = match[1].trim();
      const norm = raw.toLowerCase();
      if (
        raw.length < 3 ||
        seen.has(norm) ||
        QUESTION_PREFIX_RE.test(`${raw} `) ||
        CONCEPT_STOPWORDS.has(norm)
      ) {
        continue;
      }
      seen.add(norm);
      terms.push(raw);
      if (terms.length >= 2) break;
    }
  }

  if (terms.length === 0) return undefined;
  return truncateAtWord(terms.join(" & "), 44);
}

/** Extract a concise readable noun/topic phrase from the question or heading. */
export function extractShortTopic(
  questionContent: string | undefined,
  answerContent: string
): string | undefined {
  const strippedQuestion = (questionContent ?? "")
    .replace(/\s+/g, " ")
    .replace(/[?!.]+$/g, "")
    .trim()
    .replace(QUESTION_PREFIX_RE, "")
    .trim();

  if (strippedQuestion.length >= 5) {
    return truncateAtWord(strippedQuestion, 46);
  }

  const headingMatch = answerContent.match(/^#{1,3}\s+(.+)$/m);
  if (headingMatch?.[1]) {
    const cleanedHeading = headingMatch[1].replace(/[*_`]/g, "").trim();
    if (cleanedHeading.length >= 4) {
      return truncateAtWord(cleanedHeading, 46);
    }
  }

  return undefined;
}

/** Derive a concise study topic hint from the preceding question or answer heading. */
export function deriveSuggestionTopic(
  questionContent: string | undefined,
  answerContent: string
): string | undefined {
  const cleanedQuestion = (questionContent ?? "")
    .replace(/\s+/g, " ")
    .replace(/[?!.]+$/g, "")
    .trim();

  if (cleanedQuestion.length >= 6 && cleanedQuestion.length <= 100) {
    return cleanedQuestion;
  }

  if (cleanedQuestion.length > 100) {
    return `${cleanedQuestion.slice(0, 97).trim()}...`;
  }

  const headingMatch = answerContent.match(/^#{1,3}\s+(.+)$/m);
  if (headingMatch?.[1]) {
    return headingMatch[1].replace(/\*\*/g, "").trim().slice(0, 100);
  }

  return undefined;
}

function getExistingArtifactId(
  type: TutorStudioGeneratableType | undefined,
  input: BuildTutorActionSuggestionsInput
): string | undefined {
  if (type === "SUMMARY") return input.existingSummaryArtifactId ?? undefined;
  if (type === "QUIZ") return input.existingQuizArtifactId ?? undefined;
  if (type === "FLASHCARDS") return input.existingFlashcardsArtifactId ?? undefined;
  return undefined;
}

/**
 * Build up to 3 contextual actionable cards for a grounded AI message:
 * Card 1 is always pinned to Summary -> Studio, followed by up to 2 adaptive
 * suggestions (preferring LLM-cached suggestions when available, with topic-aware fallback).
 */
export function buildTutorActionSuggestions(
  input: BuildTutorActionSuggestionsInput
): TutorActionSuggestion[] {
  const trimmedAnswer = input.answerContent.trim();
  if (input.sourcesCount <= 0 || !trimmedAnswer) {
    return [];
  }

  const combinedText = `${input.questionContent ?? ""}\n${trimmedAnswer}`;
  const topicHint = deriveSuggestionTopic(input.questionContent, trimmedAnswer);
  const concepts = extractKeyConcepts(input.questionContent, trimmedAnswer);
  const shortTopic = extractShortTopic(input.questionContent, trimmedAnswer);
  const focusLabel = concepts ?? shortTopic;

  const persisted = input.persistedSuggestions ?? [];
  const persistedSummary = persisted.find(
    (item) => item.target === "studio" && item.artifactType === "SUMMARY"
  );
  const persistedFollowUps = persisted.filter(
    (item) => !(item.target === "studio" && item.artifactType === "SUMMARY")
  );

  const pinnedSummaryCard: TutorActionSuggestion = input.existingSummaryArtifactId
    ? {
        id: "summary_studio",
        title: focusLabel
          ? truncateAtWord(`Buka ringkasan ${focusLabel}`, 68)
          : "Buka ringkasan di Studio",
        description:
          "Ringkasan mendalam untuk jawaban ini sudah tersimpan di panel Studio.",
        badgeLabel: "Tersimpan",
        target: "studio",
        artifactType: "SUMMARY",
        topicHint,
        alreadySavedArtifactId: input.existingSummaryArtifactId,
      }
    : {
        id: "summary_studio",
        title: persistedSummary
          ? truncateAtWord(persistedSummary.label, 72)
          : focusLabel
            ? truncateAtWord(`Ringkas ${focusLabel} ke Studio`, 68)
            : "Ringkas materi ini ke Studio",
        description:
          "Susun satu artikel belajar utuh ke panel Studio tanpa memenuhi ruang chat.",
        badgeLabel: "Studio",
        target: "studio",
        artifactType: "SUMMARY",
        topicHint,
      };

  if (persistedFollowUps.length > 0) {
    const adaptiveCards: TutorActionSuggestion[] = persistedFollowUps
      .slice(0, MAX_CONTEXTUAL_FOLLOW_UPS)
      .map((item, index) => {
        const savedId =
          item.target === "studio"
            ? getExistingArtifactId(item.artifactType, input)
            : undefined;
        return {
          id: index === 0 ? "adaptive_1" : "adaptive_2",
          title: truncateAtWord(item.label, 86),
          description: "",
          badgeLabel:
            item.target === "studio"
              ? savedId
                ? "Tersimpan"
                : "Studio"
              : "Lanjutan",
          target: item.target,
          artifactType: item.target === "studio" ? item.artifactType ?? "QUIZ" : undefined,
          prompt: item.prompt,
          topicHint,
          alreadySavedArtifactId: savedId,
        };
      });

    return [pinnedSummaryCard, ...adaptiveCards];
  }

  const hasWorkedSteps = /```tutorsteps\b/i.test(trimmedAnswer);
  const hasTable = /\n\|.+\|\n\|[\s:-]+\|/m.test(trimmedAnswer);
  const hasMathOrProcedure = MATH_OR_PROCEDURE_RE.test(combinedText);
  const boldCount = trimmedAnswer.match(/\*\*[^*]+\*\*/g)?.length ?? 0;
  const bulletCount = trimmedAnswer.match(/^[-*]\s+/gm)?.length ?? 0;
  const mathBlockCount =
    trimmedAnswer.match(/\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]/g)?.length ?? 0;
  const hasComparisonSignal =
    COMPARISON_RE.test(combinedText) || boldCount >= 4;
  const hasDenseConcepts =
    boldCount >= 2 || bulletCount >= 3 || trimmedAnswer.length >= 340;
  const hasLongOrDenseProse =
    trimmedAnswer.length >= 520 ||
    mathBlockCount >= 2 ||
    input.sourcesCount >= 2;

  const candidates: TutorActionSuggestion[] = [];

  if (hasMathOrProcedure && !hasWorkedSteps) {
    candidates.push({
      id: "worked_example",
      title: focusLabel
        ? truncateAtWord(`Contoh langkah pengerjaan ${focusLabel}`, 74)
        : "Tunjukkan contoh langkah pengerjaan bertahap",
      description:
        "Ubah konsep ini menjadi simulasi hitung atau pengerjaan bertahap.",
      badgeLabel: "Langkah",
      target: "chat",
      prompt: `Buatkan satu contoh soal atau studi kasus konkret terkait ${focusLabel ?? "topik di atas"} dan tunjukkan penyelesaiannya langkah demi langkah menggunakan format kartu langkah (\`tutorsteps\`) sesuai materi.`,
      topicHint,
    });
  }

  if (hasComparisonSignal && !hasTable) {
    candidates.push({
      id: "comparison_table",
      title: concepts
        ? truncateAtWord(`Bandingkan ${concepts} dalam tabel`, 74)
        : "Bandingkan konsep utamanya dalam tabel",
      description:
        "Petakan perbedaan konsep, karakteristik, dan kapan masing-masing dipakai.",
      badgeLabel: "Tabel",
      target: "chat",
      prompt: `Rangkum perbandingan ${concepts ?? "konsep-konsep yang baru dijelaskan"} ke dalam tabel Markdown yang rapi (aspek, perbedaan utama, kelebihan, dan kapan digunakan) berdasarkan materi.`,
      topicHint,
    });
  }

  if (hasDenseConcepts) {
    candidates.push(
      input.existingFlashcardsArtifactId
        ? {
            id: "flashcards_studio",
            title: focusLabel
              ? truncateAtWord(`Buka flashcard ${focusLabel}`, 70)
              : "Buka flashcard konsep di Studio",
            description:
              "Dek kartu tanya-jawab dari topik ini sudah tersedia di panel Studio.",
            badgeLabel: "Tersimpan",
            target: "studio",
            artifactType: "FLASHCARDS",
            topicHint,
            alreadySavedArtifactId: input.existingFlashcardsArtifactId,
          }
        : {
            id: "flashcards_studio",
            title: focusLabel
              ? truncateAtWord(`Buat flashcard latihan ${focusLabel}`, 74)
              : "Buat flashcard konsep inti di Studio",
            description:
              "Simpan 6 sampai 8 kartu tanya-jawab ke Studio untuk latihan hafalan aktif.",
            badgeLabel: "Studio",
            target: "studio",
            artifactType: "FLASHCARDS",
            topicHint,
          }
    );
  }

  if (hasLongOrDenseProse) {
    candidates.push({
      id: "simplify",
      title: shortTopic
        ? truncateAtWord(`Jelaskan ${shortTopic} lebih sederhana`, 74)
        : "Jelaskan ulang dengan analogi sederhana",
      description:
        "Jelaskan ulang intinya dengan bahasa lebih ringan dan contoh sehari-hari.",
      badgeLabel: "Intuitif",
      target: "chat",
      prompt: `Jelaskan ulang materi tentang ${shortTopic ?? "topik tadi"} dengan bahasa yang jauh lebih sederhana, sertakan satu analogi intuitif tanpa mengurangi ketepatan konsep dari materi.`,
      topicHint,
    });
  }

  candidates.push(
    input.existingQuizArtifactId
      ? {
          id: "quick_quiz_studio",
          title: focusLabel
            ? truncateAtWord(`Buka kuis ${focusLabel}`, 70)
            : "Buka kuis latihan di Studio",
          description:
            "Paket soal latihan untuk topik ini sudah tersimpan di panel Studio.",
          badgeLabel: "Tersimpan",
          target: "studio",
          artifactType: "QUIZ",
          topicHint,
          alreadySavedArtifactId: input.existingQuizArtifactId,
        }
      : {
          id: "quick_quiz_studio",
          title: focusLabel
            ? truncateAtWord(`Buat kuis latihan tentang ${focusLabel}`, 74)
            : "Uji pemahaman dengan 5 soal kuis",
          description:
            "Buat 5 soal latihan pilihan ganda dan uraian singkat lengkap dengan pembahasan di Studio.",
          badgeLabel: "Studio",
          target: "studio",
          artifactType: "QUIZ",
          topicHint,
        }
  );

  if (candidates.length < MAX_CONTEXTUAL_FOLLOW_UPS) {
    candidates.push({
      id: "case_study",
      title: focusLabel
        ? truncateAtWord(`Contoh penerapan ${focusLabel} di dunia nyata`, 74)
        : "Contoh penerapan materi di kasus nyata",
      description:
        "Lihat bagaimana materi ini dipakai dalam skenario nyata atau implementasi teknis.",
      badgeLabel: "Penerapan",
      target: "chat",
      prompt: `Berikan satu contoh penerapan nyata atau skenario kasus yang relevan dengan ${focusLabel ?? "topik yang baru kita bahas"}, tetap mengacu pada konsep di materi kuliah.`,
      topicHint,
    });
  }

  return [pinnedSummaryCard, ...candidates.slice(0, MAX_CONTEXTUAL_FOLLOW_UPS)];
}
