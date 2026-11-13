export type CourseSaveOutcome =
  | { kind: "metadata-failed"; message: string }
  | { kind: "saved"; courseId: string }
  | { kind: "saved-without-cover"; courseId: string; message: string };

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export type CoverRetryOutcome = { ok: true } | { ok: false; message: string };

/** Retries only the cover for an already-saved course; metadata is never re-saved. */
export async function retrySavedCourseCover(input: {
  courseId: string;
  uploadCover: (courseId: string) => Promise<void>;
}): Promise<CoverRetryOutcome> {
  try {
    await input.uploadCover(input.courseId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: errorMessage(error, "Cover gagal diunggah"),
    };
  }
}

/**
 * Saves metadata first, then optionally uploads a cover.
 *
 * The created course ID is captured before the cover upload so a failed cover can
 * never cause the caller to repeat the creation request. A cover failure is
 * reported as partial success with the saved ID.
 */
export async function saveCourseWithOptionalCover(input: {
  hasCover: boolean;
  saveMetadata: () => Promise<string>;
  uploadCover: (courseId: string) => Promise<void>;
}): Promise<CourseSaveOutcome> {
  let courseId: string;

  try {
    courseId = await input.saveMetadata();
  } catch (error) {
    return {
      kind: "metadata-failed",
      message: errorMessage(error, "Gagal menyimpan metadata course"),
    };
  }

  if (!input.hasCover) {
    return { kind: "saved", courseId };
  }

  try {
    await input.uploadCover(courseId);
    return { kind: "saved", courseId };
  } catch (error) {
    return {
      kind: "saved-without-cover",
      courseId,
      message: errorMessage(error, "Metadata course tersimpan, tetapi cover gagal diunggah."),
    };
  }
}
