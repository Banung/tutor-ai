import type { CorrectionSource } from "@/lib/tutor-ai/correction-schema";
export type CorrectionVersion = {
  id: string; courseId: string; feedbackId: string | null; questionKey: string; question: string; version: number;
  answer: string; rationale: string; status: string; effectiveStatus: string; sourceCurrent: boolean;
  sourceSnapshot: CorrectionSource[]; sourceFingerprint: string; authorName: string; createdAt: string;
  approvedByName: string | null; approvedAt: string | null; withdrawnByName: string | null; withdrawnAt: string | null; withdrawalReason: string | null;
  activeVersion: { id: string; version: number; answer: string } | null;
};
export type CorrectionEditorData = {
  question: string; course: { id: string; title: string }; versions: CorrectionVersion[];
  sources: Array<{ id: string; title: string; pageNumber: number; chunkIndex: number; snippet: string; content: string }>;
  suggestedSources: Array<{ id: string; title: string; pageNumber: number; chunkIndex: number; snippet: string; content: string; similarity: number }>;
  materials: Array<{ id: string; title: string; pageCount: number }>;
  totalSources: number; sourcePage: number; sourcePageSize: number;
};
export type CourseCorrectionsData = {
  versions: CorrectionVersion[]; courses: Array<{ id: string; title: string }>; total: number; page: number; pageSize: number;
};
