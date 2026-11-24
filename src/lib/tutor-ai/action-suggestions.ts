import type { TutorStudioGeneratableType } from "./studio-schema";

export type TutorActionSuggestionKind =
  | "summary_studio"
  | "worked_example"
  | "comparison_table"
  | "flashcards_studio"
  | "quick_quiz_studio"
  | "simplify"
  | "case_study";

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
};

const MAX_CONTEXTUAL_FOLLOW_UPS = 2;

const MATH_OR_PROCEDURE_RE =
  /(?:\$\$?|\\frac|\\sum|\\int|\\cdot|=|langkah|algoritma|hitung|rumus|persamaan|kompleksitas|pseudocode|kode|fungsi|turunan|integral|matriks|graf|rekursi|simulasi|prosedur)/i;

const COMPARISON_RE =
  /(?:\bvs\b|\bversus\b|dibandingkan|perbandingan|perbedaan|beda\b|kelebihan|kekurangan|keunggulan|keterbatasan|trade-?off|antara\b|manakah\b)/i;

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

/**
 * Build up to 3 contextual actionable cards for a grounded AI message:
 * Card 1 is always pinned to Summary -> Studio, followed by up to 2 diverse
 * study actions inferred deterministically from the question and answer structure.
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

  const pinnedSummaryCard: TutorActionSuggestion = input.existingSummaryArtifactId
    ? {
        id: "summary_studio",
        title: "Buka ringkasan di Studio",
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
        title: "Buat ringkasan ke Studio",
        description:
          "Susun satu artikel belajar utuh ke panel Studio tanpa memenuhi ruang chat.",
        badgeLabel: "Studio",
        target: "studio",
        artifactType: "SUMMARY",
        topicHint,
      };

  const candidates: TutorActionSuggestion[] = [];

  if (hasMathOrProcedure && !hasWorkedSteps) {
    candidates.push({
      id: "worked_example",
      title: "Lihat contoh langkah pengerjaan",
      description:
        "Ubah konsep ini menjadi simulasi hitung atau pengerjaan bertahap.",
      badgeLabel: "Langkah",
      target: "chat",
      prompt:
        "Buatkan satu contoh soal atau studi kasus konkret dari topik di atas dan tunjukkan penyelesaiannya langkah demi langkah menggunakan format kartu langkah (`tutorsteps`) sesuai materi.",
      topicHint,
    });
  }

  if (hasComparisonSignal && !hasTable) {
    candidates.push({
      id: "comparison_table",
      title: "Bandingkan dalam tabel ringkas",
      description:
        "Petakan perbedaan konsep, karakteristik, dan kapan masing-masing dipakai.",
      badgeLabel: "Tabel",
      target: "chat",
      prompt:
        "Rangkum konsep-konsep yang baru dijelaskan ke dalam tabel Markdown perbandingan yang rapi (aspek, perbedaan utama, kelebihan, dan kapan digunakan) berdasarkan materi.",
      topicHint,
    });
  }

  if (hasDenseConcepts) {
    candidates.push(
      input.existingFlashcardsArtifactId
        ? {
            id: "flashcards_studio",
            title: "Buka flashcard di Studio",
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
            title: "Buat flashcard konsep inti",
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
      title: "Sederhanakan dengan analogi",
      description:
        "Jelaskan ulang intinya dengan bahasa lebih ringan dan contoh sehari-hari.",
      badgeLabel: "Intuitif",
      target: "chat",
      prompt:
        "Jelaskan ulang topik tadi dengan bahasa yang jauh lebih sederhana, sertakan satu analogi intuitif tanpa mengurangi ketepatan konsep dari materi.",
      topicHint,
    });
  }

  candidates.push(
    input.existingQuizArtifactId
      ? {
          id: "quick_quiz_studio",
          title: "Buka kuis latihan di Studio",
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
          title: "Uji pemahaman dengan kuis",
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
      title: "Contoh penerapan di dunia nyata",
      description:
        "Lihat bagaimana materi ini dipakai dalam skenario nyata atau implementasi teknis.",
      badgeLabel: "Penerapan",
      target: "chat",
      prompt:
        "Berikan satu contoh penerapan nyata atau skenario kasus yang relevan dengan topik yang baru kita bahas, tetap mengacu pada konsep di materi kuliah.",
      topicHint,
    });
  }

  return [pinnedSummaryCard, ...candidates.slice(0, MAX_CONTEXTUAL_FOLLOW_UPS)];
}
