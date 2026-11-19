const DEFAULT_BUCKET = "course-materials";

type UploadFileInput = {
  buffer: Buffer;
  contentType: string;
  fileName: string;
  courseId: string;
  sessionId: string;
  sessionTitle?: string | null;
  materialTitle?: string | null;
};

type UploadFileResult = {
  fileName: string;
  publicUrl: string;
  storagePath: string;
};

function getStorageConfig() {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || DEFAULT_BUCKET;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Konfigurasi Supabase Storage belum lengkap. Isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return { supabaseUrl, serviceRoleKey, bucket };
}

function sanitizePathSegment(value: string | null | undefined, fallback: string) {
  const normalized = (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"\\|?*\x00-\x1F/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || fallback;
}

function sanitizeFileName(fileName: string) {
  const normalized = fileName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[<>:"\\|?*\x00-\x1F/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || "material.pdf";
}

function ensurePdfFileName(fileName: string) {
  const withoutExtension = fileName.replace(/\.pdf$/i, "").trim();
  return `${withoutExtension || "material"}.pdf`;
}

function encodeStoragePath(storagePath: string) {
  return storagePath.split("/").map(encodeURIComponent).join("/");
}

function isConflictResponse(status: number, message: string) {
  return (
    status === 409 ||
    /already exists|duplicate|resource already exists/i.test(message)
  );
}

function createStoragePathCandidates(input: UploadFileInput) {
  const sessionFolder = sanitizePathSegment(input.sessionTitle, input.sessionId);
  const materialName = sanitizeFileName(input.materialTitle || input.fileName);
  const baseName = ensurePdfFileName(materialName).replace(/\.pdf$/i, "");

  return Array.from({ length: 10 }, (_, index) => {
    const displayName = index === 0 ? baseName : `${baseName} (${index + 1})`;
    return {
      fileName: `${displayName}.pdf`,
      storagePath: `${input.courseId}/${sessionFolder}/${displayName}/${displayName}.pdf`,
    };
  });
}

export async function uploadMaterialFileToSupabase({
  buffer,
  contentType,
  fileName,
  courseId,
  sessionId,
  sessionTitle,
  materialTitle,
}: UploadFileInput): Promise<UploadFileResult> {
  const { supabaseUrl, serviceRoleKey, bucket } = getStorageConfig();
  const uploadBody = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  ) as ArrayBuffer;

  for (const candidate of createStoragePathCandidates({
    buffer,
    contentType,
    fileName,
    courseId,
    sessionId,
    sessionTitle,
    materialTitle,
  })) {
    const encodedPath = encodeStoragePath(candidate.storagePath);
    const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${encodedPath}`;

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": contentType || "application/pdf",
        "x-upsert": "false",
      },
      body: uploadBody,
    });

    if (response.ok) {
      return {
        fileName: candidate.fileName,
        storagePath: candidate.storagePath,
        publicUrl: `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`,
      };
    }

    const message = await response.text();
    if (!isConflictResponse(response.status, message)) {
      throw new Error(`Gagal upload ke Supabase Storage: ${message || response.statusText}`);
    }
  }

  throw new Error("Gagal upload ke Supabase Storage: nama materi sudah terlalu banyak dipakai.");
}

const COURSE_COVER_PREFIX = "course-covers";

export async function uploadCourseCoverToSupabase(input: {
  buffer: Buffer;
  contentType: "image/jpeg" | "image/png";
  courseId: string;
  extension: "jpg" | "png";
}): Promise<{ publicUrl: string; storagePath: string }> {
  const { supabaseUrl, serviceRoleKey, bucket } = getStorageConfig();
  const storagePath = `${COURSE_COVER_PREFIX}/${input.courseId}/${crypto.randomUUID()}.${input.extension}`;
  const encodedPath = encodeStoragePath(storagePath);
  const uploadBody = input.buffer.buffer.slice(
    input.buffer.byteOffset,
    input.buffer.byteOffset + input.buffer.byteLength
  ) as ArrayBuffer;

  const response = await fetch(
    `${supabaseUrl}/storage/v1/object/${bucket}/${encodedPath}`,
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": input.contentType,
        "x-upsert": "false",
      },
      body: uploadBody,
    }
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Gagal upload cover ke Supabase Storage: ${message || response.statusText}`);
  }

  return {
    storagePath,
    publicUrl: `${supabaseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`,
  };
}

export async function deleteCourseCoverFromSupabase(storagePath: string | null | undefined) {
  if (!storagePath?.startsWith(`${COURSE_COVER_PREFIX}/`)) return;
  await deleteMaterialFilesFromSupabase([storagePath]);
}

export async function downloadMaterialFileFromSupabase(storagePath: string): Promise<Buffer> {
  const { supabaseUrl, serviceRoleKey, bucket } = getStorageConfig();
  const encodedPath = encodeStoragePath(storagePath);
  const downloadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${encodedPath}`;

  const response = await fetch(downloadUrl, {
    method: "GET",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Gagal membaca file dari Supabase Storage: ${message || response.statusText}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

function getSupabaseObjectPaths(storagePaths: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      storagePaths.filter(
        (storagePath): storagePath is string =>
          Boolean(storagePath) &&
          !storagePath!.startsWith("/") &&
          !/^https?:\/\//i.test(storagePath!)
      )
    )
  );
}

export async function deleteMaterialFilesFromSupabase(
  storagePaths: Array<string | null | undefined>
) {
  const objectPaths = getSupabaseObjectPaths(storagePaths);
  if (objectPaths.length === 0) return;

  const { supabaseUrl, serviceRoleKey, bucket } = getStorageConfig();
  const deleteUrl = `${supabaseUrl}/storage/v1/object/${bucket}`;
  const response = await fetch(deleteUrl, {
    method: "DELETE",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prefixes: objectPaths }),
  });

  if (!response.ok && response.status !== 404) {
    const message = await response.text();
    throw new Error(`Gagal menghapus file dari Supabase Storage: ${message || response.statusText}`);
  }
}
