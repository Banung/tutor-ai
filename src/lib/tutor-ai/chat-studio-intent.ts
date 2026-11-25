import { z } from "zod/v4";
import {
  TUTOR_STUDIO_GENERATABLE_TYPES,
  TUTOR_STUDIO_TYPE_META,
  type TutorStudioGeneratableType,
} from "./studio-schema";

export const chatStudioLaunchSchema = z.object({
  type: z.enum(TUTOR_STUDIO_GENERATABLE_TYPES),
  topic: z.string().trim().max(300).optional(),
  title: z.string().trim().max(120).optional(),
  artifactId: z.string().trim().min(1).optional(),
});

export type TutorChatStudioLaunchMeta = z.infer<typeof chatStudioLaunchSchema>;

export type DetectedChatStudioIntent = {
  type: TutorStudioGeneratableType;
  topic?: string;
};

const EXCLUDED_CHAT_FORMAT_RE = /\b(?:tutorsteps|tabel\s+markdown|analogi)\b/i;

const ACTION_VERB_RE =
  /\b(?:buat(?:kan|in)?|bikin(?:kan|in)?|susun(?:kan)?|rancang(?:kan)?|beri(?:kan)?|kasih|minta|coba\s+(?:buat(?:kan|in)?|bikin|susun)|tolong\s+(?:buat(?:kan|in)?|bikin|susun|kasih)|uji|tes|create|generate|make|build|prepare|give\s+me|quiz\s+me|test\s+me)\b/i;

const QUIZ_TARGET_RE =
  /\b(?:kuis(?:nya)?|quiz(?:zes)?|latihan\s+soal|soal\s+(?:latihan|kuis|evaluasi|pilihan\s+ganda|mcq)|uji\s+pemahaman|tes\s+pemahaman)\b/i;

const QUIZ_DIRECT_TOPIC_RE =
  /^(?:kuis|quiz)\s+(?:tentang|mengenai|terkait|soal|materi|bab|topik|about|on)\b/i;

const FLASHCARDS_TARGET_RE =
  /\b(?:flash\s*cards?(?:nya)?|kartu\s+(?:tanya\s*-?\s*jawab|hafalan|ingat|belajar|flashcard))\b/i;

const FLASHCARDS_DIRECT_TOPIC_RE =
  /^(?:flash\s*cards?|kartu\s+(?:tanya\s*-?\s*jawab|hafalan))\s+(?:tentang|mengenai|terkait|materi|bab|topik|about|on)\b/i;

const SUMMARY_ACTION_VERB_RE =
  /\b(?:buat(?:kan|in)?|bikin(?:kan|in)?|susun(?:kan)?|rancang(?:kan)?|tolong\s+(?:buat(?:kan|in)?|bikin|susun|rangkum(?:kan)?|ringkas(?:kan)?)|rangkum(?:kan|lah)?|ringkas(?:kan|lah)?|create|generate|make|summarize)\b/i;

const SUMMARY_TARGET_RE =
  /\b(?:ringkasan(?:\s+(?:materi|belajar|mendalam|lengkap|studi))?|panduan\s+belajar|artikel\s+belajar|study\s+guide|cheat\s*sheet)\b/i;

const SUMMARY_DIRECT_VERB_RE =
  /^(?:tolong\s+)?(?:rangkum(?:kan|lah)?|ringkas(?:kan|lah)?)\s+(?:materi|pembahasan|topik|bab|tentang|mengenai)\b/i;

const LEADING_FILLER_RE =
  /^(?:tolong|coba|bantu|mohon|please|pls|bisa|boleh|mau)\s+/i;

const CREATION_CLAUSE_RE =
  /^(?:buat(?:kan|in)?|bikin(?:kan|in)?|susun(?:kan)?|rancang(?:kan)?|beri(?:kan)?|kasih|minta|rangkum(?:kan|lah)?|ringkas(?:kan|lah)?|uji|tes|create|generate|make|build|prepare|give\s+me|summarize|quiz\s+me|test\s+me)\s+(?:(?:saya|aku|kami|kita|me)\s+)?(?:(?:\d+\s+(?:buah\s+|butir\s+)?(?:soal|pertanyaan|kartu)\s+)?)?(?:(?:a|an|the|satu|beberapa)\s+)?(?:kuis(?:nya)?|quiz(?:zes)?|latihan\s+soal|soal\s+(?:latihan|kuis|evaluasi|pilihan\s+ganda|mcq)|flash\s*cards?(?:nya)?|kartu\s+(?:tanya\s*-?\s*jawab|hafalan|ingat|belajar|flashcard)|ringkasan(?:\s+(?:materi|belajar|mendalam|lengkap|studi))?|panduan\s+belajar|artikel\s+belajar|study\s+guide|cheat\s*sheet|pemahaman(?:\s+(?:saya|aku))?)?\s*(?:(?:singkat|interaktif|cepat|ringkas|latihan|lengkap)\s+)?/i;

const TOPIC_PREPOSITION_RE =
  /^(?:(?:materi|pembahasan|topik|bab)\s+)?(?:tentang|mengenai|terkait|soal|atas|untuk|dari|pada|seputar|about|on|regarding|for|of)\s+/i;

const GENERIC_TOPIC_RE =
  /^(?:saya|aku|kami|kita|me|singkat|ini|itu|tadi|tersebut|barusan|di\s+atas|materi(?:\s+ini|\s+itu|\s+tadi|\s+tersebut|\s+kuliah|\s+pdf)?|topik(?:\s+ini|\s+itu|\s+tadi)?|pembahasan(?:\s+ini|\s+itu|\s+tadi)?|semua\s+materi|semuanya|this|that|the\s+material)$/i;

function extractStudioTopicFromPrompt(prompt: string): string | undefined {
  let cleaned = prompt.replace(/\s+/g, " ").replace(/[?!.]+$/g, "").trim();

  for (let i = 0; i < 4; i += 1) {
    const prev = cleaned;
    cleaned = cleaned.replace(LEADING_FILLER_RE, "").trim();
    cleaned = cleaned.replace(CREATION_CLAUSE_RE, "").trim();
    cleaned = cleaned.replace(TOPIC_PREPOSITION_RE, "").trim();
    if (cleaned === prev) break;
  }

  cleaned = cleaned
    .replace(/\b(?:untuk\s+(?:saya|aku|kami|kita|latihan)|dong|ya|yah|aja|saja|nih|di\s+studio)\b\s*$/gi, "")
    .trim();

  if (cleaned.length < 3 || GENERIC_TOPIC_RE.test(cleaned)) {
    return undefined;
  }

  return cleaned.slice(0, 240);
}

/**
 * Detect whether a student's chat prompt explicitly asks to create a Studio learning
 * deliverable (Quiz, Flashcards, or Study Guide/Summary), extracting an optional topic.
 */
export function detectChatStudioIntent(
  prompt: string
): DetectedChatStudioIntent | null {
  const normalized = prompt.replace(/\s+/g, " ").trim();
  if (normalized.length < 4 || EXCLUDED_CHAT_FORMAT_RE.test(normalized)) {
    return null;
  }

  // Informational questions like "apa itu kuis?" or "bagaimana cara kerja flashcard?"
  if (
    /^(?:apa\s+(?:itu|fungsi|bedanya|perbedaan)|mengapa|kenapa|kapan|siapa|bagaimana\s+(?:cara|sistem))\b/i.test(
      normalized
    )
  ) {
    return null;
  }

  const hasActionVerb = ACTION_VERB_RE.test(normalized);
  let matchedType: TutorStudioGeneratableType | null = null;

  if (
    (hasActionVerb && FLASHCARDS_TARGET_RE.test(normalized)) ||
    FLASHCARDS_DIRECT_TOPIC_RE.test(normalized)
  ) {
    matchedType = "FLASHCARDS";
  } else if (
    (hasActionVerb && QUIZ_TARGET_RE.test(normalized)) ||
    QUIZ_DIRECT_TOPIC_RE.test(normalized)
  ) {
    matchedType = "QUIZ";
  } else if (
    (SUMMARY_ACTION_VERB_RE.test(normalized) && SUMMARY_TARGET_RE.test(normalized)) ||
    SUMMARY_DIRECT_VERB_RE.test(normalized)
  ) {
    matchedType = "SUMMARY";
  }

  if (!matchedType) return null;

  const topic = extractStudioTopicFromPrompt(normalized);
  return topic ? { type: matchedType, topic } : { type: matchedType };
}

/** Parse persisted embedded Studio launch card metadata from AiChatMessage.ragSources JSON. */
export function parseChatStudioLaunchMeta(
  ragSources: unknown
): TutorChatStudioLaunchMeta | null {
  if (!ragSources || typeof ragSources !== "object" || Array.isArray(ragSources)) {
    return null;
  }
  const raw = (ragSources as { studioLaunch?: unknown }).studioLaunch;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const parsed = chatStudioLaunchSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Build the focused prompt instruction when Tutor AI responds to a chat Studio creation request. */
export function formatChatStudioLaunchInstruction(
  intent: DetectedChatStudioIntent
): string {
  const deliverableLabel =
    intent.type === "QUIZ"
      ? "kuis latihan interaktif"
      : intent.type === "FLASHCARDS"
        ? "dek flashcard belajar aktif"
        : "panduan belajar terstruktur";

  const focusPhrase = intent.topic
    ? ` mengenai topik ${JSON.stringify(intent.topic)}`
    : " berdasarkan materi PDF yang sedang aktif";

  return [
    `Mahasiswa sedang meminta pembuatan ${deliverableLabel}${focusPhrase} yang akan dibuka lewat kartu Studio interaktif di bawah balasan ini.`,
    "ATURAN PENTING: JANGAN menuliskan daftar soal pilihan ganda, opsi A/B/C/D, kunci jawaban, isi kartu flashcard, ataupun artikel panjang di dalam chat ini.",
    `Tulis HANYA 2 sampai 3 kalimat pengantar singkat dan ramah dalam bahasa yang sama dengan permintaan mahasiswa: sampaikan bahwa ${deliverableLabel} sedang/telah disiapkan dari materi kuliah, sebutkan 2 sampai 3 poin cakupan topik utama dari konteks PDF dengan sitasi [Sumber N], lalu tawarkan mahasiswa untuk membukanya atau meminta penyesuaian fokus/kesulitan.`,
  ].join("\n");
}

/** Resolve a readable fallback card title before the generated Studio artifact returns its full title. */
export function getDefaultChatStudioLaunchTitle(
  launch: TutorChatStudioLaunchMeta
): string {
  if (launch.title?.trim()) return launch.title.trim();

  const prefix =
    launch.type === "QUIZ"
      ? "Kuis Latihan"
      : launch.type === "FLASHCARDS"
        ? "Flashcard"
        : "Panduan Belajar";

  if (launch.topic?.trim()) {
    return `${prefix}: ${launch.topic.trim()}`.slice(0, 115);
  }
  return TUTOR_STUDIO_TYPE_META[launch.type].label;
}
