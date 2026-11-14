import prisma from "@/lib/prisma";

type AcademicLevel = "S1" | "S2" | "S3";
type ResponseMode = "chat" | "avatar";

// ==========================================
// DEFAULT PROMPTS (hard-coded originals)
// ==========================================

const DEFAULT_PROMPTS: Record<string, string> = {
  "S1:chat": `Gunakan gaya bahasa yang ramah, hangat, komunikatif, dan mudah dipahami oleh mahasiswa Sarjana.
Fokuslah untuk membangun pemahaman konsep dasar dan alur logika secara fundamental.
Jelaskan langkah demi langkah bila diminta atau konsepnya memerlukan penjabaran.
Gunakan satu analogi atau contoh hanya bila membantu menjelaskan konsep yang abstrak.
Kurangi penggunaan jargon teknis yang padat, atau langsung berikan definisi singkat jika ada istilah baru.
Pastikan penyederhanaan materi ini tetap menjaga keakuratan ilmiah dari konteks aslinya.
Jaga nada ramah melalui penjelasan yang jelas; hindari pujian dan motivasi generik.`,

  "S2:chat": `Gunakan gaya bahasa profesional, analitis, logis, dan berorientasi pada pemecahan masalah.
Asumsikan pengguna sudah memahami definisi teori dasar sehingga penjelasan harfiah tidak perlu diulang terlalu panjang.
Fokuskan pembahasan pada bagaimana konsep tersebut diimplementasikan secara praktis.
Jika relevan, gunakan contoh dari konteks atau contoh hipotetis yang dilabeli dengan jelas; jangan mengarang studi kasus nyata.
Lakukan komparasi atau perbandingan mendalam dengan metode alternatif yang relevan.
Jabarkan dengan jelas kelebihan, kekurangan, trade-offs, serta efisiensi dari pendekatan yang dibahas.
Gunakan jargon ilmiah dan terminologi industri secara tepat untuk menjaga standar profesional.`,

  "S3:chat": `Gunakan gaya bahasa yang sangat formal, kritis, berwibawa, dan berorientasi murni pada riset akademis.
Lakukan evaluasi secara kritis terhadap teori, model, atau metodologi yang sedang didiskusikan.
Pertanyakan asumsi-asumsi dasar di balik teori tersebut serta batas-batas validitasnya.
Arahkan jawaban untuk mengidentifikasi celah riset atau research gap dari topik yang dibahas.
Sajikan sintesis literatur hanya jika literatur tersebut tersedia dalam konteks; jangan mengarang referensi atau research gap.
Susun argumen dengan struktur yang sangat sistematis, objektif, deduktif, dan berbasis pada bukti kuat.
Gunakan terminologi akademis tingkat lanjut dan dorong pemikiran independen level Doktoral.`,

  "S1:avatar": `Gunakan bahasa ramah, hangat, dan mudah dipahami mahasiswa Sarjana.
Jelaskan inti konsep dengan sederhana dan akurat.
Pakai contoh singkat hanya jika membantu pemahaman.`,

  "S2:avatar": `Gunakan bahasa profesional dan analitis, tetapi tetap singkat.
Fokus pada inti konsep, penerapan praktis, dan trade-off terpenting saja.
Gunakan istilah akademik/industri seperlunya tanpa memperpanjang jawaban.`,

  "S3:avatar": `Gunakan bahasa formal, kritis, dan berbasis riset, tetapi padat.
Sorot asumsi, batas validitas, atau research gap hanya bila memang relevan.
Hindari sintesis panjang kecuali pengguna memintanya secara eksplisit.`,
};

function promptKey(level: AcademicLevel, mode: ResponseMode) {
  return `${level}:${mode}` as const;
}

// ==========================================
// IN-MEMORY CACHE (TTL 60s)
// ==========================================

type CacheEntry = { content: string; cachedAt: number };

const CACHE_TTL_MS = 60_000;
const promptCache = new Map<string, CacheEntry>();

function getCached(level: AcademicLevel, mode: ResponseMode): string | null {
  const entry = promptCache.get(promptKey(level, mode));
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    promptCache.delete(promptKey(level, mode));
    return null;
  }
  return entry.content;
}

function setCache(level: AcademicLevel, mode: ResponseMode, content: string) {
  promptCache.set(promptKey(level, mode), { content, cachedAt: Date.now() });
}

function invalidateCache(level?: AcademicLevel, mode?: ResponseMode) {
  if (level && mode) {
    promptCache.delete(promptKey(level, mode));
  } else {
    promptCache.clear();
  }
}

// ==========================================
// PUBLIC API
// ==========================================

export function getDefaultPromptContent(level: AcademicLevel, mode: ResponseMode): string {
  return DEFAULT_PROMPTS[promptKey(level, mode)] ?? "";
}

/**
 * Get prompt content for a specific level + mode.
 * Returns from cache → DB → hard-coded default (in that order).
 */
export async function getPromptContent(level: AcademicLevel, mode: ResponseMode): Promise<string> {
  // 1. Check cache
  const cached = getCached(level, mode);
  if (cached !== null) return cached;

  // 2. Check DB
  const row = await prisma.tutorPromptConfig.findUnique({
    where: { academicLevel_responseMode: { academicLevel: level, responseMode: mode } },
    select: { promptContent: true },
  });

  if (row) {
    setCache(level, mode, row.promptContent);
    return row.promptContent;
  }

  // 3. Fallback to hard-coded default
  const defaultContent = getDefaultPromptContent(level, mode);
  setCache(level, mode, defaultContent);
  return defaultContent;
}

/**
 * Get all 6 prompt configs (for admin page).
 */
export async function getAllPromptConfigs() {
  const rows = await prisma.tutorPromptConfig.findMany({
    orderBy: [{ academicLevel: "asc" }, { responseMode: "asc" }],
  });

  // Ensure all 6 combinations exist in response
  const levels: AcademicLevel[] = ["S1", "S2", "S3"];
  const modes: ResponseMode[] = ["chat", "avatar"];
  const result = [];

  for (const level of levels) {
    for (const mode of modes) {
      const existing = rows.find(
        (r) => r.academicLevel === level && r.responseMode === mode
      );

      if (existing) {
        result.push({
          id: existing.id,
          academicLevel: existing.academicLevel,
          responseMode: existing.responseMode,
          promptContent: existing.promptContent,
          isDefault: existing.isDefault,
          updatedBy: existing.updatedBy,
          updatedAt: existing.updatedAt.toISOString(),
        });
      } else {
        // Row doesn't exist in DB yet — return hard-coded default
        result.push({
          id: null,
          academicLevel: level,
          responseMode: mode,
          promptContent: getDefaultPromptContent(level, mode),
          isDefault: true,
          updatedBy: null,
          updatedAt: null,
        });
      }
    }
  }

  return result;
}

/**
 * Update (upsert) a prompt config.
 */
export async function updatePromptConfig(
  level: AcademicLevel,
  mode: ResponseMode,
  promptContent: string,
  adminUserId: string
) {
  const trimmed = promptContent.trim();
  if (!trimmed) {
    throw new Error("Prompt content tidak boleh kosong.");
  }

  const row = await prisma.tutorPromptConfig.upsert({
    where: { academicLevel_responseMode: { academicLevel: level, responseMode: mode } },
    update: {
      promptContent: trimmed,
      isDefault: false,
      updatedBy: adminUserId,
    },
    create: {
      academicLevel: level,
      responseMode: mode,
      promptContent: trimmed,
      isDefault: false,
      updatedBy: adminUserId,
    },
  });

  invalidateCache(level, mode);

  return {
    id: row.id,
    academicLevel: row.academicLevel,
    responseMode: row.responseMode,
    promptContent: row.promptContent,
    isDefault: row.isDefault,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Reset a prompt back to hard-coded default.
 */
export async function resetPromptToDefault(
  level: AcademicLevel,
  mode: ResponseMode,
  adminUserId: string
) {
  const defaultContent = getDefaultPromptContent(level, mode);

  const row = await prisma.tutorPromptConfig.upsert({
    where: { academicLevel_responseMode: { academicLevel: level, responseMode: mode } },
    update: {
      promptContent: defaultContent,
      isDefault: true,
      updatedBy: adminUserId,
    },
    create: {
      academicLevel: level,
      responseMode: mode,
      promptContent: defaultContent,
      isDefault: true,
      updatedBy: adminUserId,
    },
  });

  invalidateCache(level, mode);

  return {
    id: row.id,
    academicLevel: row.academicLevel,
    responseMode: row.responseMode,
    promptContent: row.promptContent,
    isDefault: row.isDefault,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Seed all 6 default prompts if they don't exist yet.
 * Called during migration or app startup.
 */
export async function seedDefaultPrompts() {
  const levels: AcademicLevel[] = ["S1", "S2", "S3"];
  const modes: ResponseMode[] = ["chat", "avatar"];

  for (const level of levels) {
    for (const mode of modes) {
      await prisma.tutorPromptConfig.upsert({
        where: { academicLevel_responseMode: { academicLevel: level, responseMode: mode } },
        update: {},
        create: {
          academicLevel: level,
          responseMode: mode,
          promptContent: getDefaultPromptContent(level, mode),
          isDefault: true,
        },
      });
    }
  }
}
