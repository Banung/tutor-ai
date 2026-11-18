import { loadImage } from "canvas";

export const MAX_COURSE_COVER_BYTES = 2 * 1024 * 1024;

export type DetectedCoverImage = {
  contentType: "image/jpeg" | "image/png";
  extension: "jpg" | "png";
};

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function detectCourseCoverImage(buffer: Uint8Array): DetectedCoverImage | null {
  const isJpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff;
  if (isJpeg) {
    return { contentType: "image/jpeg", extension: "jpg" };
  }

  const isPng =
    buffer.length >= PNG_SIGNATURE.length &&
    PNG_SIGNATURE.every((byte, index) => buffer[index] === byte);
  if (isPng) {
    return { contentType: "image/png", extension: "png" };
  }

  return null;
}

export async function validateCourseCoverUpload(file: {
  size: number;
  buffer: Uint8Array;
}) {
  if (file.size > MAX_COURSE_COVER_BYTES || file.buffer.byteLength > MAX_COURSE_COVER_BYTES) {
    return { error: "Berkas gambar melebihi 2 MB." as const, detected: null };
  }

  const detected = detectCourseCoverImage(file.buffer);
  if (!detected) {
    return { error: "Format berkas tidak didukung. Gunakan JPG atau PNG." as const, detected: null };
  }

  try {
    const image = await loadImage(Buffer.from(file.buffer));
    if (!image.width || !image.height) {
      return {
        error: "Berkas gambar tidak valid atau rusak." as const,
        detected: null,
      };
    }
  } catch {
    return {
      error: "Berkas gambar tidak valid atau rusak." as const,
      detected: null,
    };
  }

  return { error: null, detected };
}
