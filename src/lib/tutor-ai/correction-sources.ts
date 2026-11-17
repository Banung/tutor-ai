import type { Prisma } from "@/app/generated/prisma/client";
import prisma from "@/lib/prisma";
import { MATERIAL_EMBEDDING_MODEL, MATERIAL_EMBEDDING_DIMENSIONS } from "@/lib/material-processing/config";
import { fingerprint } from "./correction-policy";
import { correctionSourcesSchema, type CorrectionPageRangeInput, type CorrectionSource } from "./correction-schema";
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

type CorrectionMaterial = Awaited<ReturnType<typeof loadCorrectionMaterials>>[number];

async function loadCorrectionMaterials(courseId: string, materialIds: string[], db: Prisma.TransactionClient = prisma) {
  if (!materialIds.length) return [];
  return db.material.findMany({
    where: { id: { in: materialIds }, ...eligibleCorrectionMaterial, courseSession: { ...eligibleCorrectionMaterial.courseSession, courseId } },
    select: { id: true, title: true, fileName: true, storagePath: true, filePath: true, processingJobId: true,
      courseSessionId: true, pageCount: true, courseSession: { select: { title: true } },
      chunks: { orderBy: { chunkIndex: "asc" }, select: { id: true, content: true, pageNumber: true, chunkIndex: true } },
    },
  });
}

function correctionMaterialFingerprint(material: CorrectionMaterial) {
  return fingerprint({ materialId: material.id, storagePath: material.storagePath, filePath: material.filePath,
    jobId: material.processingJobId, chunks: material.chunks });
}

function correctionSourceMetadata(material: CorrectionMaterial) {
  return { materialId: material.id, sessionId: material.courseSessionId, materialTitle: material.title,
    fileName: material.fileName, sessionTitle: material.courseSession.title,
    materialFingerprint: correctionMaterialFingerprint(material) };
}

function mergePageRanges(ranges: CorrectionPageRangeInput[]) {
  const sorted = [...ranges].sort((a, b) => a.materialId.localeCompare(b.materialId) || a.startPage - b.startPage || a.endPage - b.endPage);
  const merged: CorrectionPageRangeInput[] = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (previous?.materialId === range.materialId && range.startPage <= previous.endPage + 1) {
      previous.endPage = Math.max(previous.endPage, range.endPage);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

export async function captureCorrectionSelections(
  courseId: string,
  chunkIds: string[],
  ranges: CorrectionPageRangeInput[],
  db: Prisma.TransactionClient = prisma,
): Promise<CorrectionSource[]> {
  const normalizedRanges = mergePageRanges(ranges);
  const chunkRows = chunkIds.length
    ? await db.materialChunk.findMany({ where: { id: { in: chunkIds }, courseId }, select: { id: true, materialId: true } })
    : [];
  if (chunkRows.length !== chunkIds.length) throw new TutorAiServiceError("Salah satu potongan sumber sudah berubah. Muat ulang daftar sumber.", 409);
  const materialIds = [...new Set([...normalizedRanges.map((range) => range.materialId), ...chunkRows.map((chunk) => chunk.materialId)])];
  const materials = await loadCorrectionMaterials(courseId, materialIds, db);
  if (materials.length !== materialIds.length) throw new TutorAiServiceError("Pilih sumber dari materi aktif dan siap pada mata kuliah ini.", 409);
  const materialById = new Map(materials.map((material) => [material.id, material]));
  const chunkById = new Map(materials.flatMap((material) => material.chunks.map((chunk) => [chunk.id, { material, chunk }] as const)));
  const snapshot: CorrectionSource[] = [];

  for (const chunkId of chunkIds) {
    const selected = chunkById.get(chunkId);
    if (!selected) throw new TutorAiServiceError("Salah satu potongan sumber sudah berubah. Muat ulang daftar sumber.", 409);
    snapshot.push({ kind: "chunk", ...correctionSourceMetadata(selected.material), chunkId,
      pageNumber: selected.chunk.pageNumber, chunkIndex: selected.chunk.chunkIndex });
  }

  for (const range of normalizedRanges) {
    const material = materialById.get(range.materialId);
    if (!material || range.endPage > (material.pageCount ?? 0)) throw new TutorAiServiceError("Rentang halaman berada di luar materi yang dipilih.", 400);
    if (!material.chunks.some((chunk) => chunk.pageNumber >= range.startPage && chunk.pageNumber <= range.endPage)) {
      throw new TutorAiServiceError("Tidak ada potongan siap pada rentang halaman tersebut.", 400);
    }
    snapshot.push({ kind: "page_range", ...correctionSourceMetadata(material), startPage: range.startPage, endPage: range.endPage });
  }

  return snapshot;
}

export async function correctionSourcesCurrent(courseId: string, snapshot: unknown, db: Prisma.TransactionClient = prisma) {
  const parsed = correctionSourcesSchema.safeParse(snapshot);
  if (!parsed.success) return false;
  if (!parsed.data.length) return true;
  try {
    const legacySources = parsed.data.flatMap((source) => "kind" in source ? [] : [source]);
    if (legacySources.length) {
      const current = await captureCorrectionSources(courseId, legacySources.map((source) => source.chunkId), db);
      if (fingerprint(current) !== fingerprint(legacySources)) return false;
    }

    const compactSources = parsed.data.filter((source) => "kind" in source);
    const materialIds = [...new Set(compactSources.map((source) => source.materialId))];
    const materials = await loadCorrectionMaterials(courseId, materialIds, db);
    if (materials.length !== materialIds.length) return false;
    const materialById = new Map(materials.map((material) => [material.id, material]));
    for (const source of compactSources) {
      const material = materialById.get(source.materialId);
      if (!material || correctionMaterialFingerprint(material) !== source.materialFingerprint
        || material.courseSessionId !== source.sessionId || material.title !== source.materialTitle
        || material.fileName !== source.fileName || material.courseSession.title !== source.sessionTitle) return false;
      if (source.kind === "chunk" && !material.chunks.some((chunk) => chunk.id === source.chunkId
        && chunk.pageNumber === source.pageNumber && chunk.chunkIndex === source.chunkIndex)) return false;
      if (source.kind === "page_range" && (source.endPage > (material.pageCount ?? 0)
        || !material.chunks.some((chunk) => chunk.pageNumber >= source.startPage && chunk.pageNumber <= source.endPage))) return false;
    }
    return true;
  } catch (error) {
    if (error instanceof TutorAiServiceError && error.status === 409) return false;
    throw error;
  }
}
