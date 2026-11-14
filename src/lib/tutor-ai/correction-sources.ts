import type { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";
import { MATERIAL_EMBEDDING_MODEL, MATERIAL_EMBEDDING_DIMENSIONS } from "@/lib/material-processing/config";
import { fingerprint } from "./correction-policy";
import { correctionSourcesSchema, type CorrectionSource } from "./correction-schema";
import { TutorAiServiceError } from "./error";

export const eligibleCorrectionMaterial = {
  isActive: true, isProcessed: true, processingStatus: "ready", materialType: "file",
  embeddingModel: MATERIAL_EMBEDDING_MODEL, embeddingDimensions: MATERIAL_EMBEDDING_DIMENSIONS,
  courseSession: { isActive: true, course: { isActive: true } },
} satisfies Prisma.MaterialWhereInput;

export async function captureCorrectionSources(courseId: string, chunkIds: string[], db: Prisma.TransactionClient = prisma): Promise<CorrectionSource[]> {
  const rows = await db.materialChunk.findMany({
    where: { id: { in: chunkIds }, courseId, material: eligibleCorrectionMaterial },
    orderBy: { id: "asc" },
    include: { material: { include: { courseSession: { select: { title: true } }, chunks: {
      orderBy: { chunkIndex: "asc" }, select: { id: true, content: true, pageNumber: true, chunkIndex: true },
    } } } },
  });
  if (rows.length !== chunkIds.length || rows.length === 0) throw new TutorAiServiceError("Pilih sumber yang aktif dan siap dari mata kuliah ini.", 409);
  return rows.map((row) => ({ chunkId: row.id, sessionId: row.sessionId, materialId: row.materialId, pageNumber: row.pageNumber,
    chunkIndex: row.chunkIndex, content: row.content, materialTitle: row.material.title, fileName: row.material.fileName,
    sessionTitle: row.material.courseSession.title,
    materialFingerprint: fingerprint({ materialId: row.materialId, storagePath: row.material.storagePath,
      filePath: row.material.filePath, jobId: row.material.processingJobId, chunks: row.material.chunks }),
  }));
}

export async function correctionSourcesCurrent(courseId: string, snapshot: unknown, db: Prisma.TransactionClient = prisma) {
  const parsed = correctionSourcesSchema.safeParse(snapshot);
  if (!parsed.success) return false;
  try {
    const current = await captureCorrectionSources(courseId, parsed.data.map((s) => s.chunkId), db);
    return fingerprint(current) === fingerprint(parsed.data);
  } catch (error) {
    if (error instanceof TutorAiServiceError && error.status === 409) return false;
    throw error;
  }
}
