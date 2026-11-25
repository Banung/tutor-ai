import { z } from "zod/v4";

export const OPTION_LETTERS = ["A", "B", "C", "D"] as const;

export const quizQuestionSchema = z.object({
  id: z.string().min(1).max(64),
  topic: z.string().trim().min(1).max(120),
  question: z.string().trim().min(1).max(1200),
  options: z.tuple([
    z.string().trim().min(1).max(500),
    z.string().trim().min(1).max(500),
    z.string().trim().min(1).max(500),
    z.string().trim().min(1).max(500),
  ]),
  correctIndex: z.number().int().min(0).max(3),
  hint: z.string().trim().min(1).max(500),
  explanation: z.string().trim().min(1).max(1000),
  sourceNumbers: z.array(z.number().int().positive()).default([]),
});

export type TutorQuizQuestion = z.infer<typeof quizQuestionSchema>;

export const quizEvaluationPointSchema = z.object({
  title: z.string().trim().min(1).max(160),
  detail: z.string().trim().min(1).max(600),
});

export type TutorQuizEvaluationPoint = z.infer<
  typeof quizEvaluationPointSchema
>;

export const quizEvaluationSchema = z.object({
  correctCount: z.number().int().nonnegative(),
  wrongCount: z.number().int().nonnegative(),
  skippedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().positive(),
  strengths: z.array(quizEvaluationPointSchema),
  focusAreas: z.array(quizEvaluationPointSchema),
});

export type TutorQuizEvaluation = z.infer<typeof quizEvaluationSchema>;

export const quizAttemptSchema = z.object({
  answers: z.record(z.string(), z.number().int().min(0).max(3)),
  currentIndex: z.number().int().nonnegative(),
  completedAt: z.string().nullable(),
  evaluation: quizEvaluationSchema.optional(),
});

export type TutorQuizAttempt = z.infer<typeof quizAttemptSchema>;

export const tutorStudioQuizDataSchema = z.object({
  kind: z.literal("QUIZ"),
  version: z.literal(1),
  questions: z.array(quizQuestionSchema).min(1).max(20),
  attempt: quizAttemptSchema.optional(),
});

export type TutorStudioQuizData = z.infer<typeof tutorStudioQuizDataSchema>;

export const flashcardItemSchema = z.object({
  id: z.string().min(1).max(64),
  topic: z.string().trim().min(1).max(120),
  front: z.string().trim().min(1).max(800),
  back: z.string().trim().min(1).max(1200),
  sourceNumbers: z.array(z.number().int().positive()).default([]),
});

export type TutorFlashcardItem = z.infer<typeof flashcardItemSchema>;

export const flashcardsProgressSchema = z.object({
  trackLearning: z.boolean(),
  statusByCardId: z.record(z.string(), z.enum(["known", "review"])),
  currentIndex: z.number().int().nonnegative(),
  updatedAt: z.string(),
});

export type TutorFlashcardsProgress = z.infer<typeof flashcardsProgressSchema>;

export const tutorStudioFlashcardsDataSchema = z.object({
  kind: z.literal("FLASHCARDS"),
  version: z.literal(1),
  cards: z.array(flashcardItemSchema).min(1).max(30),
  progress: flashcardsProgressSchema.optional(),
});

export type TutorStudioFlashcardsData = z.infer<
  typeof tutorStudioFlashcardsDataSchema
>;

export const tutorStudioStructuredDataSchema = z.discriminatedUnion("kind", [
  tutorStudioQuizDataSchema,
  tutorStudioFlashcardsDataSchema,
]);

export type TutorStudioStructuredData = z.infer<
  typeof tutorStudioStructuredDataSchema
>;

export const updateTutorStudioProgressSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("quiz"),
    answers: z.record(z.string(), z.number().int().min(0).max(3)),
    currentIndex: z.number().int().nonnegative(),
    completed: z.boolean().optional(),
    reset: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("flashcards"),
    trackLearning: z.boolean(),
    statusByCardId: z.record(z.string(), z.enum(["known", "review"])),
    currentIndex: z.number().int().nonnegative(),
  }),
]);

export type UpdateTutorStudioProgressInput = z.infer<
  typeof updateTutorStudioProgressSchema
>;

/** Parse stored Prisma structuredData JSON into a validated interactive Quiz or Flashcard payload. */
export function parseTutorStudioStructuredData(
  raw: unknown
): TutorStudioStructuredData | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const result = tutorStudioStructuredDataSchema.safeParse(raw);
  return result.success ? result.data : null;
}

function extractJsonObjectFromText(rawText: string): Record<string, unknown> | null {
  const cleaned = rawText
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const tryParse = (candidate: string): Record<string, unknown> | null => {
    try {
      const value: unknown = JSON.parse(candidate);
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  };

  const direct = tryParse(cleaned);
  if (direct) return direct;

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return tryParse(cleaned.slice(firstBrace, lastBrace + 1));
  }

  return null;
}

function sanitizeSourceNumbers(
  raw: unknown,
  validSourceNumbers: Set<number>
): number[] {
  if (!Array.isArray(raw)) return [];
  const unique = new Set<number>();
  for (const item of raw) {
    const num = typeof item === "number" ? item : Number(item);
    if (Number.isInteger(num) && validSourceNumbers.has(num)) {
      unique.add(num);
    }
  }
  return [...unique];
}

function stripOptionLetterPrefix(optionText: string): string {
  return optionText.replace(/^[A-Da-d]\s*[.):]\s+/, "").trim();
}

/**
 * Parse and validate an LLM-generated JSON Quiz payload, filtering source citations
 * to valid retrieval numbers.
 */
export function parseQuizGenerationResponse(
  rawText: string,
  validSourceNumbers: Set<number>
): { title?: string; data: TutorStudioQuizData } | null {
  const obj = extractJsonObjectFromText(rawText);
  if (!obj || !Array.isArray(obj.questions)) return null;

  const normalizedQuestions: TutorQuizQuestion[] = [];
  for (let index = 0; index < obj.questions.length; index += 1) {
    const item = obj.questions[index];
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    if (!Array.isArray(record.options) || record.options.length < 4) continue;

    const cleanOptions = record.options
      .slice(0, 4)
      .map((opt) => (typeof opt === "string" ? stripOptionLetterPrefix(opt) : ""));
    if (cleanOptions.some((opt) => !opt)) continue;

    const correctRaw = Number(record.correctIndex);
    const correctIndex =
      Number.isInteger(correctRaw) && correctRaw >= 0 && correctRaw <= 3
        ? correctRaw
        : 0;

    const candidate = quizQuestionSchema.safeParse({
      id:
        typeof record.id === "string" && record.id.trim().length > 0
          ? record.id.trim().slice(0, 64)
          : `q-${index + 1}`,
      topic:
        typeof record.topic === "string" && record.topic.trim().length > 0
          ? record.topic.trim().slice(0, 120)
          : `Topik ${index + 1}`,
      question: typeof record.question === "string" ? record.question.trim() : "",
      options: [cleanOptions[0], cleanOptions[1], cleanOptions[2], cleanOptions[3]],
      correctIndex,
      hint:
        typeof record.hint === "string" && record.hint.trim().length > 0
          ? record.hint.trim().slice(0, 500)
          : "Periksa kembali definisi atau prinsip utama pada potongan materi terkait.",
      explanation:
        typeof record.explanation === "string" && record.explanation.trim().length > 0
          ? record.explanation.trim().slice(0, 1000)
          : `Jawaban yang tepat adalah pilihan ${OPTION_LETTERS[correctIndex]}.`,
      sourceNumbers: sanitizeSourceNumbers(record.sourceNumbers, validSourceNumbers),
    });

    if (candidate.success) {
      normalizedQuestions.push(candidate.data);
    }
    if (normalizedQuestions.length >= 20) break;
  }

  const fullResult = tutorStudioQuizDataSchema.safeParse({
    kind: "QUIZ",
    version: 1,
    questions: normalizedQuestions,
  });

  if (!fullResult.success) return null;

  const title =
    typeof obj.title === "string" && obj.title.trim().length > 0
      ? obj.title.replace(/[*_`#]/g, "").trim().slice(0, 115)
      : undefined;

  return { title, data: fullResult.data };
}

/**
 * Parse and validate an LLM-generated JSON Flashcard Deck payload, filtering
 * source citations to valid retrieval numbers.
 */
export function parseFlashcardsGenerationResponse(
  rawText: string,
  validSourceNumbers: Set<number>
): { title?: string; data: TutorStudioFlashcardsData } | null {
  const obj = extractJsonObjectFromText(rawText);
  if (!obj || !Array.isArray(obj.cards)) return null;

  const normalizedCards: TutorFlashcardItem[] = [];
  for (let index = 0; index < obj.cards.length; index += 1) {
    const item = obj.cards[index];
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;

    const candidate = flashcardItemSchema.safeParse({
      id:
        typeof record.id === "string" && record.id.trim().length > 0
          ? record.id.trim().slice(0, 64)
          : `card-${index + 1}`,
      topic:
        typeof record.topic === "string" && record.topic.trim().length > 0
          ? record.topic.trim().slice(0, 120)
          : `Kartu ${index + 1}`,
      front: typeof record.front === "string" ? record.front.trim().slice(0, 800) : "",
      back: typeof record.back === "string" ? record.back.trim().slice(0, 1200) : "",
      sourceNumbers: sanitizeSourceNumbers(record.sourceNumbers, validSourceNumbers),
    });

    if (candidate.success) {
      normalizedCards.push(candidate.data);
    }
    if (normalizedCards.length >= 30) break;
  }

  const fullResult = tutorStudioFlashcardsDataSchema.safeParse({
    kind: "FLASHCARDS",
    version: 1,
    cards: normalizedCards,
  });

  if (!fullResult.success) return null;

  const title =
    typeof obj.title === "string" && obj.title.trim().length > 0
      ? obj.title.replace(/[*_`#]/g, "").trim().slice(0, 115)
      : undefined;

  return { title, data: fullResult.data };
}

function formatSourceSuffix(sourceNumbers: number[]): string {
  if (sourceNumbers.length === 0) return "";
  return ` ${sourceNumbers.map((num) => `[Sumber ${num}]`).join(", ")}`;
}

/** Render structured quiz questions & explanations into clean Markdown for .md and PDF exports. */
export function renderQuizToMarkdown(data: TutorStudioQuizData): string {
  const lines: string[] = ["## Daftar Soal", ""];

  data.questions.forEach((item, index) => {
    lines.push(`${index + 1}. **${item.topic}:** ${item.question}`);
    item.options.forEach((opt, optIdx) => {
      lines.push(`   - ${OPTION_LETTERS[optIdx]}. ${opt}`);
    });
    lines.push("");
  });

  lines.push("## Kunci Jawaban & Pembahasan", "");

  data.questions.forEach((item, index) => {
    const letter = OPTION_LETTERS[item.correctIndex];
    const answerText = item.options[item.correctIndex];
    lines.push(
      `${index + 1}. **Jawaban: ${letter} (${answerText}).** ${item.explanation}${formatSourceSuffix(item.sourceNumbers)}`
    );
  });

  return lines.join("\n").trim();
}

/** Render structured flashcards into clean Markdown for .md and PDF exports. */
export function renderFlashcardsToMarkdown(data: TutorStudioFlashcardsData): string {
  const lines: string[] = [];

  data.cards.forEach((card, index) => {
    lines.push(`### Kartu ${index + 1}: ${card.topic}`);
    lines.push(`- **Pertanyaan:** ${card.front}`);
    lines.push(
      `- **Jawaban Inti:** ${card.back}${formatSourceSuffix(card.sourceNumbers)}`
    );
    lines.push("");
  });

  return lines.join("\n").trim();
}

/** Evaluate a student's quiz answers into counts, Keunggulan, and Area fokus. */
export function evaluateQuizAttempt(
  data: TutorStudioQuizData,
  answers: Record<string, number>
): TutorQuizEvaluation {
  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;

  const correctTopics = new Map<string, number[]>();
  const wrongItems: Array<{ number: number; question: TutorQuizQuestion; chosenIndex: number }> = [];
  const skippedItems: Array<{ number: number; question: TutorQuizQuestion }> = [];

  data.questions.forEach((question, index) => {
    const qNumber = index + 1;
    const selected = answers[question.id];
    if (selected === undefined) {
      skippedCount += 1;
      skippedItems.push({ number: qNumber, question });
      return;
    }

    if (selected === question.correctIndex) {
      correctCount += 1;
      const list = correctTopics.get(question.topic) ?? [];
      list.push(qNumber);
      correctTopics.set(question.topic, list);
    } else {
      wrongCount += 1;
      wrongItems.push({ number: qNumber, question, chosenIndex: selected });
    }
  });

  const strengths: TutorQuizEvaluationPoint[] = [];
  for (const [topic, questionNumbers] of correctTopics.entries()) {
    strengths.push({
      title: topic,
      detail: `Menjawab benar pada soal nomor ${questionNumbers.join(", ")}. Pertahankan pemahaman konsep pada bagian ini.`,
    });
    if (strengths.length >= 4) break;
  }

  if (strengths.length === 0) {
    if (wrongCount > 0) {
      strengths.push({
        title: "Inisiatif Memulai Evaluasi",
        detail: `Anda sudah mencoba ${wrongCount} soal dan menandai bagian yang perlu diperkuat. Gunakan kartu dan panduan di bawah untuk meninjau ulang konsep intinya.`,
      });
    } else {
      strengths.push({
        title: "Siap Menguji Pemahaman",
        detail: "Pilih jawaban pada tiap pertanyaan atau gunakan Petunjuk untuk melatih pemahaman materi.",
      });
    }
  }

  const focusAreas: TutorQuizEvaluationPoint[] = [];
  for (const missed of wrongItems) {
    const chosenOption =
      missed.question.options[missed.chosenIndex] ?? OPTION_LETTERS[missed.chosenIndex];
    const correctOption =
      missed.question.options[missed.question.correctIndex] ??
      OPTION_LETTERS[missed.question.correctIndex];
    focusAreas.push({
      title: `${missed.question.topic} (Soal ${missed.number})`,
      detail: `Anda memilih "${chosenOption}", sedangkan jawaban yang tepat adalah "${correctOption}". ${missed.question.explanation}`,
    });
    if (focusAreas.length >= 3) break;
  }

  if (skippedItems.length > 0 && focusAreas.length < 4) {
    const skippedTopics = [...new Set(skippedItems.map((item) => item.question.topic))];
    const skippedNums = skippedItems.map((item) => item.number);
    focusAreas.push({
      title: `Topik Belum Dijawab (${skippedItems.length} soal)`,
      detail: `Soal nomor ${skippedNums.join(", ")} masih dilewati. Pelajari kembali topik: ${skippedTopics.slice(0, 4).join(", ")}.`,
    });
  }

  return {
    correctCount,
    wrongCount,
    skippedCount,
    totalCount: data.questions.length,
    strengths,
    focusAreas,
  };
}

/** Build a focused follow-up topic string from missed and skipped quiz questions. */
export function buildQuizFollowUpTopic(
  title: string,
  data: TutorStudioQuizData,
  answers: Record<string, number>
): string {
  const weakTopics: string[] = [];
  const allTopics: string[] = [];

  for (const question of data.questions) {
    if (!allTopics.includes(question.topic)) {
      allTopics.push(question.topic);
    }
    const chosen = answers[question.id];
    if (chosen === undefined || chosen !== question.correctIndex) {
      if (!weakTopics.includes(question.topic)) {
        weakTopics.push(question.topic);
      }
    }
  }

  const targets = weakTopics.length > 0 ? weakTopics : allTopics;
  const joined = targets.slice(0, 5).join(", ");
  return `Pendalaman ${joined} (berdasarkan ${title})`.slice(0, 500);
}
