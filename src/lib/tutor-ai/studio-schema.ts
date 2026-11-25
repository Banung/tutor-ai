import { z } from "zod/v4";
import type { TutorStudioStructuredData } from "./studio-interactive";

export const TUTOR_STUDIO_ARTIFACT_TYPES = [
  "SUMMARY",
  "QUIZ",
  "FLASHCARDS",
  "NOTE",
] as const;

export type TutorStudioArtifactType =
  (typeof TUTOR_STUDIO_ARTIFACT_TYPES)[number];

export const TUTOR_STUDIO_GENERATABLE_TYPES = [
  "SUMMARY",
  "QUIZ",
  "FLASHCARDS",
] as const;

export type TutorStudioGeneratableType =
  (typeof TUTOR_STUDIO_GENERATABLE_TYPES)[number];

export const TUTOR_STUDIO_SCOPES = ["course", "session"] as const;

export type TutorStudioScope = (typeof TUTOR_STUDIO_SCOPES)[number];

export const tutorStudioSourceSchema = z.object({
  chunkId: z.string().min(1),
  materialId: z.string().min(1),
  materialTitle: z.string().min(1),
  fileName: z.string().min(1),
  publicUrl: z.string().nullable().optional(),
  sessionTitle: z.string().min(1),
  pageNumber: z.number().int().positive(),
  chunkIndex: z.number().int().nonnegative(),
  similarity: z.number(),
  snippet: z.string(),
  sourceNumber: z.number().int().positive().optional(),
});

export type TutorStudioSource = z.infer<typeof tutorStudioSourceSchema>;

export type TutorStudioArtifactDto = {
  id: string;
  courseId: string;
  userId: string;
  chatSessionId: string | null;
  sourceMessageId: string | null;
  type: TutorStudioArtifactType;
  title: string;
  content: string;
  structuredData: TutorStudioStructuredData | null;
  sources: TutorStudioSource[];
  materialTitles: string[];
  createdAt: string;
  updatedAt: string;
};

export type TutorStudioTypeMeta = {
  label: string;
  shortLabel: string;
  actionLabel: string;
  description: string;
};

export const TUTOR_STUDIO_TYPE_META: Record<
  TutorStudioArtifactType,
  TutorStudioTypeMeta
> = {
  SUMMARY: {
    label: "Ringkasan",
    shortLabel: "Ringkasan",
    actionLabel: "Ringkasan",
    description: "Artikel belajar mendalam terstruktur dari materi PDF terpilih",
  },
  QUIZ: {
    label: "Kuis Latihan",
    shortLabel: "Kuis",
    actionLabel: "Kuis Latihan",
    description: "Soal latihan variatif lengkap dengan kunci dan pembahasan",
  },
  FLASHCARDS: {
    label: "Flashcard",
    shortLabel: "Flashcard",
    actionLabel: "Flashcard",
    description: "Kartu tanya-jawab aktif untuk melatih penguasaan konsep inti",
  },
  NOTE: {
    label: "Catatan",
    shortLabel: "Catatan",
    actionLabel: "Simpan Catatan",
    description: "Jawaban Tutor AI pilihan yang disimpan langsung ke Studio",
  },
};

export const createTutorStudioArtifactSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("generate"),
    type: z.enum(TUTOR_STUDIO_GENERATABLE_TYPES),
    chatSessionId: z.string().trim().min(1).nullable().optional(),
    anchorMessageId: z.string().trim().min(1).nullable().optional(),
    launchMessageId: z.string().trim().min(1).nullable().optional(),
    materialIds: z.array(z.string().trim().min(1)).max(100).optional(),
    topic: z.string().trim().max(800).optional(),
  }),
  z.object({
    action: z.literal("save_note"),
    chatSessionId: z.string().trim().min(1).nullable().optional(),
    sourceMessageId: z.string().trim().min(1).nullable().optional(),
    title: z.string().trim().min(1).max(120).optional(),
    content: z.string().trim().min(1).max(60000),
    sources: z.array(tutorStudioSourceSchema).max(40).optional(),
  }),
]);

export type CreateTutorStudioArtifactInput = z.infer<
  typeof createTutorStudioArtifactSchema
>;

export const renameTutorStudioArtifactSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Judul tidak boleh kosong.")
    .max(120, "Judul maksimal 120 karakter."),
});

export const listTutorStudioQuerySchema = z.object({
  scope: z.enum(TUTOR_STUDIO_SCOPES).optional(),
  chatSessionId: z.string().trim().min(1).optional(),
  type: z.enum(TUTOR_STUDIO_ARTIFACT_TYPES).optional(),
});
