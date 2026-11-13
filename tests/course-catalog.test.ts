import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

import {
  adminCreateCourseSchema,
  createCourseSchema,
  publicationActionSchema,
  updateCourseSchema,
} from "../src/lib/schemas/course.schema";
import {
  detectCourseCoverImage,
  MAX_COURSE_COVER_BYTES,
  validateCourseCoverUpload,
} from "../src/lib/course-cover-upload";
import { isCustomCourseCover } from "../src/lib/course-cover";
import {
  retrySavedCourseCover,
  saveCourseWithOptionalCover,
} from "../src/lib/course-save-flow";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/tutor_ai_test";

type AnyFn = (...args: unknown[]) => unknown;

function replaceMethod(target: object, name: string, impl: AnyFn) {
  const record = target as Record<string, unknown>;
  const original = record[name];
  record[name] = impl;
  return () => {
    record[name] = original;
  };
}

async function loadServices() {
  const [
    { default: prisma },
    courseService,
    mahasiswaService,
    dosenService,
  ] = await Promise.all([
    import("../src/lib/prisma"),
    import("../src/lib/services/course.service"),
    import("../src/lib/services/mahasiswa.service"),
    import("../src/lib/services/dosen.service"),
  ]);
  return { prisma, courseService, mahasiswaService, dosenService };
}

const jpeg = new Uint8Array(
  Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDBooor7U8E/9k=",
    "base64"
  )
);
const png = new Uint8Array(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAABmJLR0QA/wD/AP+gvaeTAAAAFUlEQVQImWM0Tjvzn4GBgYEJRIAwACPfAmh/hjYGAAAAAElFTkSuQmCC",
    "base64"
  )
);
const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

test("admin course schema normalizes and validates catalog metadata", () => {
  const parsed = adminCreateCourseSchema.parse({
    title: "  Kecerdasan Artifisial  ",
    courseCode: " if1234 ",
  });

  assert.equal(parsed.title, "Kecerdasan Artifisial");
  assert.equal(parsed.courseCode, "IF1234");
  assert.equal(adminCreateCourseSchema.safeParse({ title: "", courseCode: "IF1234" }).success, false);
  assert.equal(
    adminCreateCourseSchema.safeParse({ title: "Valid", courseCode: "IF1" }).success,
    false
  );
  assert.equal(
    adminCreateCourseSchema.safeParse({ title: "Valid", courseCode: "IF12345678901" }).success,
    false
  );
  assert.equal(
    adminCreateCourseSchema.safeParse({ title: "A".repeat(151), courseCode: "IF1234" }).success,
    false
  );
});

test("admin create schema accepts drafts without academic references", () => {
  const parsed = adminCreateCourseSchema.parse({
    title: "Draft tanpa referensi",
    courseCode: "mk0001",
    studyProgramId: null,
  });

  assert.equal(parsed.courseCode, "MK0001");
  assert.equal(parsed.studyProgramId, null);
});

test("generic PATCH rejects catalogStatus and legacy lecturer payload stays valid", () => {
  assert.equal(
    updateCourseSchema.safeParse({ title: "Judul", catalogStatus: "PUBLISHED" }).success,
    false
  );
  assert.equal(updateCourseSchema.safeParse({ isActive: false }).success, true);
  assert.equal(
    createCourseSchema.safeParse({ title: "Course Dosen", description: "Isi" }).success,
    true
  );
});

test("cover upload detects real JPG/PNG signatures and rejects other content", async () => {
  assert.deepEqual(detectCourseCoverImage(jpeg), {
    contentType: "image/jpeg",
    extension: "jpg",
  });
  assert.deepEqual(detectCourseCoverImage(png), {
    contentType: "image/png",
    extension: "png",
  });
  assert.deepEqual(detectCourseCoverImage(jpegHeader), {
    contentType: "image/jpeg",
    extension: "jpg",
  });
  assert.equal(detectCourseCoverImage(new TextEncoder().encode("<svg></svg>")), null);

  assert.equal(
    (await validateCourseCoverUpload({ size: MAX_COURSE_COVER_BYTES + 1, buffer: jpeg })).error,
    "Berkas gambar melebihi 2 MB."
  );
  assert.equal(
    (
      await validateCourseCoverUpload({
        size: jpeg.length,
        buffer: new Uint8Array([0x47, 0x49, 0x46]),
      })
    ).error,
    "Format berkas tidak didukung. Gunakan JPG atau PNG."
  );
});

test("cover validation decodes usable images and rejects header-only/truncated data", async () => {
  const validJpeg = await validateCourseCoverUpload({ size: jpeg.length, buffer: jpeg });
  const validPng = await validateCourseCoverUpload({ size: png.length, buffer: png });
  assert.equal(validJpeg.error, null);
  assert.equal(validPng.error, null);
  assert.equal(validJpeg.detected?.contentType, "image/jpeg");
  assert.equal(validPng.detected?.contentType, "image/png");

  for (const buffer of [
    jpegHeader,
    pngHeader,
    new Uint8Array(),
    jpeg.slice(0, 80),
    png.slice(0, 20),
  ]) {
    const result = await validateCourseCoverUpload({ size: buffer.length, buffer });
    assert.notEqual(result.error, null);
    assert.equal(result.detected, null);
  }
});

test("uploaded covers are recognized as custom and preserved", () => {
  assert.equal(isCustomCourseCover("https://example.test/cover.png"), true);
  assert.equal(isCustomCourseCover("data:image/svg+xml;charset=UTF-8,abc"), false);
  assert.equal(isCustomCourseCover(null), false);
});

test("archiveCourse logs one transition and is a no-op when already archived", async () => {
  const { prisma, courseService } = await loadServices();
  let status: "DRAFT" | "PUBLISHED" | "ARCHIVED" = "PUBLISHED";
  const logs: Array<Record<string, unknown>> = [];
  let updates = 0;
  const tx = {
    $queryRaw: async () => [{ id: "course-1" }],
    course: {
      findUnique: async () => ({ catalogStatus: status }),
      update: async () => {
        updates += 1;
        status = "ARCHIVED";
        return { id: "course-1", catalogStatus: status };
      },
    },
    courseCatalogStatusLog: {
      create: async (args: { data: Record<string, unknown> }) => {
        logs.push(args.data);
        return args.data;
      },
    },
  };
  const restore = replaceMethod(prisma, "$transaction", async (callback: unknown) =>
    (callback as (client: unknown) => Promise<unknown>)(tx)
  );

  try {
    const first = await courseService.archiveCourse("course-1", "admin-1");
    assert.deepEqual(first, { success: true, catalogStatus: "ARCHIVED", changed: true });
    assert.equal(updates, 1);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].courseId, "course-1");
    assert.equal(logs[0].actorId, "admin-1");
    assert.equal(logs[0].fromStatus, "PUBLISHED");
    assert.equal(logs[0].toStatus, "ARCHIVED");

    const second = await courseService.archiveCourse("course-1", "admin-1");
    assert.deepEqual(second, { success: true, catalogStatus: "ARCHIVED", changed: false });
    assert.equal(updates, 1, "already archived course must not be updated again");
    assert.equal(logs.length, 1, "no-op archive must not add an audit entry");
  } finally {
    restore();
  }
});

test("archiveCourse reports missing courses with a 404 service error", async () => {
  const { prisma, courseService } = await loadServices();
  const tx = { $queryRaw: async () => [] };
  const restore = replaceMethod(prisma, "$transaction", async (callback: unknown) =>
    (callback as (client: unknown) => Promise<unknown>)(tx)
  );

  try {
    await assert.rejects(
      () => courseService.archiveCourse("missing", "admin-1"),
      (error: unknown) =>
        error instanceof courseService.CourseServiceError &&
        error.status === 404 &&
        error.message === "Course tidak ditemukan"
    );
  } finally {
    restore();
  }
});

type PublicationCourse = {
  id: string;
  title: string;
  courseCode: string | null;
  isActive: boolean;
  catalogStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  studyProgram: { id: string; facultyId: string } | null;
  _count: { instructors: number };
};

function publicationTx(course: PublicationCourse | null) {
  const logs: Array<Record<string, unknown>> = [];
  let updates = 0;
  const state = course ? { ...course } : null;
  const tx = {
    $queryRaw: async () => (state ? [{ id: state.id }] : []),
    course: {
      findUnique: async () => state,
      update: async (args: { data: { catalogStatus?: string } }) => {
        updates += 1;
        if (state && args.data.catalogStatus) {
          state.catalogStatus = args.data.catalogStatus as PublicationCourse["catalogStatus"];
        }
        return { id: state?.id, catalogStatus: state?.catalogStatus };
      },
    },
    courseCatalogStatusLog: {
      create: async (args: { data: Record<string, unknown> }) => {
        logs.push(args.data);
        return args.data;
      },
    },
  };
  return {
    tx,
    state,
    stats: () => ({ updates, logs }),
  };
}

function stubTransaction(prisma: object, tx: unknown) {
  return replaceMethod(prisma, "$transaction", async (callback: unknown) =>
    (callback as (client: unknown) => Promise<unknown>)(tx)
  );
}

test("publication completeness requires title, code, program faculty, and an instructor", async () => {
  const { courseService } = await loadServices();

  const emptyIssues = courseService.getCoursePublicationIssues({
    title: "   ",
    courseCode: "IF1",
    studyProgram: null,
    instructorCount: 0,
  });
  assert.deepEqual(
    emptyIssues.map((issue) => issue.field),
    ["title", "courseCode", "studyProgram", "instructors"]
  );

  const tooLong = courseService.getCoursePublicationIssues({
    title: "A".repeat(151),
    courseCode: "IF1234",
    studyProgram: { id: "prog-1", facultyId: "fac-1" },
    instructorCount: 1,
  });
  assert.deepEqual(tooLong.map((issue) => issue.field), ["title"]);

  assert.deepEqual(
    courseService.getCoursePublicationIssues({
      title: "Algoritma",
      courseCode: "if1234",
      studyProgram: { id: "prog-1", facultyId: "fac-1" },
      instructorCount: 1,
    }),
    []
  );
});

test("publication payload rejects forged actor and unsupported actions", () => {
  assert.equal(publicationActionSchema.safeParse({ action: "publish" }).success, true);
  assert.equal(publicationActionSchema.safeParse({ action: "unpublish" }).success, true);
  assert.equal(
    publicationActionSchema.safeParse({ action: "publish", actorId: "forged" }).success,
    false
  );
  assert.equal(publicationActionSchema.safeParse({ action: "archive" }).success, false);
});

test("publish transitions a complete active draft once and logs the session actor", async () => {
  const { prisma, courseService } = await loadServices();
  const fixture = publicationTx({
    id: "course-1",
    title: "Algoritma",
    courseCode: "IF1234",
    isActive: true,
    catalogStatus: "DRAFT",
    studyProgram: { id: "prog-1", facultyId: "fac-1" },
    _count: { instructors: 1 },
  });
  const restore = stubTransaction(prisma, fixture.tx);

  try {
    const first = await courseService.setCoursePublication("course-1", "publish", "admin-1");
    assert.deepEqual(first, { catalogStatus: "PUBLISHED", changed: true });
    assert.equal(fixture.stats().updates, 1);
    assert.equal(fixture.stats().logs.length, 1);
    assert.equal(fixture.stats().logs[0].actorId, "admin-1");
    assert.equal(fixture.stats().logs[0].fromStatus, "DRAFT");
    assert.equal(fixture.stats().logs[0].toStatus, "PUBLISHED");

    const second = await courseService.setCoursePublication("course-1", "publish", "admin-1");
    assert.deepEqual(second, { catalogStatus: "PUBLISHED", changed: false });
    assert.equal(fixture.stats().updates, 1);
    assert.equal(fixture.stats().logs.length, 1, "repeat publish must not add an audit entry");
  } finally {
    restore();
  }
});

test("publish rejects archived and inactive entries without writes", async () => {
  const { prisma, courseService } = await loadServices();
  const archived = publicationTx({
    id: "course-1",
    title: "Algoritma",
    courseCode: "IF1234",
    isActive: true,
    catalogStatus: "ARCHIVED",
    studyProgram: { id: "prog-1", facultyId: "fac-1" },
    _count: { instructors: 1 },
  });
  let restore = stubTransaction(prisma, archived.tx);
  try {
    await assert.rejects(
      () => courseService.setCoursePublication("course-1", "publish", "admin-1"),
      (error: unknown) =>
        error instanceof courseService.CourseServiceError && error.status === 409
    );
    assert.equal(archived.stats().updates, 0);
    assert.equal(archived.stats().logs.length, 0);
  } finally {
    restore();
  }

  const inactive = publicationTx({
    id: "course-1",
    title: "Algoritma",
    courseCode: "IF1234",
    isActive: false,
    catalogStatus: "DRAFT",
    studyProgram: { id: "prog-1", facultyId: "fac-1" },
    _count: { instructors: 1 },
  });
  restore = stubTransaction(prisma, inactive.tx);
  try {
    await assert.rejects(
      () => courseService.setCoursePublication("course-1", "publish", "admin-1"),
      (error: unknown) =>
        error instanceof courseService.CourseServiceError &&
        error.status === 409 &&
        /Aktifkan akses/.test(error.message)
    );
    assert.equal(inactive.stats().updates, 0);
    assert.equal(inactive.stats().logs.length, 0);
  } finally {
    restore();
  }
});

test("publish rejects incomplete entries with every missing field and no writes", async () => {
  const { prisma, courseService } = await loadServices();
  const fixture = publicationTx({
    id: "course-1",
    title: "   ",
    courseCode: "IF1",
    isActive: true,
    catalogStatus: "DRAFT",
    studyProgram: null,
    _count: { instructors: 0 },
  });
  const restore = stubTransaction(prisma, fixture.tx);

  try {
    await assert.rejects(
      () => courseService.setCoursePublication("course-1", "publish", "admin-1"),
      (error: unknown) => {
        if (!(error instanceof courseService.CourseServiceError)) return false;
        assert.equal(error.status, 400);
        assert.equal(error.message, "Lengkapi data sebelum mempublikasikan entri.");
        assert.deepEqual(
          error.missingFields?.map((issue) => issue.field),
          ["title", "courseCode", "studyProgram", "instructors"]
        );
        return true;
      }
    );
    assert.equal(fixture.stats().updates, 0);
    assert.equal(fixture.stats().logs.length, 0);
  } finally {
    restore();
  }
});

test("unpublish returns published entries to draft and is a no-op for drafts", async () => {
  const { prisma, courseService } = await loadServices();
  const fixture = publicationTx({
    id: "course-1",
    title: "Algoritma",
    courseCode: "IF1234",
    isActive: true,
    catalogStatus: "PUBLISHED",
    studyProgram: { id: "prog-1", facultyId: "fac-1" },
    _count: { instructors: 1 },
  });
  const restore = stubTransaction(prisma, fixture.tx);

  try {
    const first = await courseService.setCoursePublication("course-1", "unpublish", "admin-1");
    assert.deepEqual(first, { catalogStatus: "DRAFT", changed: true });
    assert.equal(fixture.stats().logs.length, 1);
    assert.equal(fixture.stats().logs[0].fromStatus, "PUBLISHED");
    assert.equal(fixture.stats().logs[0].toStatus, "DRAFT");

    const second = await courseService.setCoursePublication("course-1", "unpublish", "admin-1");
    assert.deepEqual(second, { catalogStatus: "DRAFT", changed: false });
    assert.equal(fixture.stats().updates, 1);
    assert.equal(fixture.stats().logs.length, 1);
  } finally {
    restore();
  }
});

test("unpublish rejects archived entries", async () => {
  const { prisma, courseService } = await loadServices();
  const fixture = publicationTx({
    id: "course-1",
    title: "Algoritma",
    courseCode: "IF1234",
    isActive: true,
    catalogStatus: "ARCHIVED",
    studyProgram: { id: "prog-1", facultyId: "fac-1" },
    _count: { instructors: 1 },
  });
  const restore = stubTransaction(prisma, fixture.tx);

  try {
    await assert.rejects(
      () => courseService.setCoursePublication("course-1", "unpublish", "admin-1"),
      (error: unknown) =>
        error instanceof courseService.CourseServiceError && error.status === 409
    );
    assert.equal(fixture.stats().updates, 0);
    assert.equal(fixture.stats().logs.length, 0);
  } finally {
    restore();
  }
});

test("published metadata edits cannot remove required completeness", async () => {
  const { prisma, courseService } = await loadServices();
  let updates = 0;
  const tx = {
    $queryRaw: async () => [{ id: "course-1" }],
    course: {
      findUnique: async () => ({
        id: "course-1",
        title: "Algoritma",
        courseCode: "IF1234",
        description: null,
        isActive: true,
        catalogStatus: "PUBLISHED",
        studyProgramId: "prog-1",
        coverStoragePath: null,
        coverImage: null,
        enrollmentKey: "ABCD1234",
        learningOutcomes: null,
        hasArModule: false,
      }),
      update: async () => {
        updates += 1;
        return { id: "course-1" };
      },
    },
    courseInstructor: { count: async () => 1 },
    studyProgram: { findUnique: async () => null },
  };
  const restore = stubTransaction(prisma, tx);

  try {
    await assert.rejects(
      () => courseService.updateCourse("course-1", { studyProgramId: null }),
      (error: unknown) => {
        if (!(error instanceof courseService.CourseServiceError)) return false;
        assert.equal(error.status, 400);
        assert.deepEqual(
          error.missingFields?.map((issue) => issue.field),
          ["studyProgram"]
        );
        return true;
      }
    );
    assert.equal(updates, 0, "incomplete published edit must not be persisted");
  } finally {
    restore();
  }
});

test("audit insertion failure prevents a successful publication result", async () => {
  const { prisma, courseService } = await loadServices();
  const marker = "AUDIT_WRITE_FAILED";
  const fixture = publicationTx({
    id: "course-1",
    title: "Algoritma",
    courseCode: "IF1234",
    isActive: true,
    catalogStatus: "DRAFT",
    studyProgram: { id: "prog-1", facultyId: "fac-1" },
    _count: { instructors: 1 },
  });
  fixture.tx.courseCatalogStatusLog.create = async () => {
    throw new Error(marker);
  };
  const restore = stubTransaction(prisma, fixture.tx);

  try {
    await assert.rejects(
      () => courseService.setCoursePublication("course-1", "publish", "admin-1"),
      (error: unknown) => error instanceof Error && error.message === marker
    );
  } finally {
    restore();
  }
});

test("published entry cannot lose its last instructor and locks before checking", async () => {
  const { prisma, courseService } = await loadServices();
  const events: string[] = [];
  const tx = {
    $queryRaw: async () => {
      events.push("lock");
      return [{ id: "course-1" }];
    },
    courseInstructor: {
      findFirst: async () => {
        events.push("assignment");
        return { id: "assignment-1" };
      },
      delete: async () => {
        events.push("delete");
        return {};
      },
    },
    course: {
      findUnique: async () => {
        events.push("course");
        return { catalogStatus: "PUBLISHED", _count: { instructors: 1 } };
      },
    },
  };
  const restoreTransaction = replaceMethod(prisma, "$transaction", async (callback: unknown) =>
    (callback as (client: unknown) => Promise<unknown>)(tx)
  );

  try {
    await assert.rejects(
      () => courseService.removeInstructor("course-1", "dosen-1"),
      (error: unknown) =>
        error instanceof courseService.CourseServiceError &&
        error.status === 409
    );
    assert.equal(events[0], "lock");
    assert.equal(events.includes("delete"), false);
  } finally {
    restoreTransaction();
  }
});

test("draft entry may lose its last instructor and published entry with two instructors may too", async () => {
  const { prisma, courseService } = await loadServices();
  let instructors = 1;
  let catalogStatus = "DRAFT";
  let deletes = 0;
  const tx = {
    $queryRaw: async () => [{ id: "course-1" }],
    courseInstructor: {
      findFirst: async () => ({ id: "assignment-1" }),
      delete: async () => {
        deletes += 1;
        return {};
      },
    },
    course: {
      findUnique: async () => ({
        catalogStatus,
        _count: { instructors },
      }),
    },
  };
  const restoreTransaction = replaceMethod(prisma, "$transaction", async (callback: unknown) =>
    (callback as (client: unknown) => Promise<unknown>)(tx)
  );

  try {
    await courseService.removeInstructor("course-1", "dosen-1");
    assert.equal(deletes, 1);

    catalogStatus = "PUBLISHED";
    instructors = 2;
    await courseService.removeInstructor("course-1", "dosen-2");
    assert.equal(deletes, 2);
  } finally {
    restoreTransaction();
  }
});

test("serialized concurrent removals cannot leave a published course with zero instructors", async () => {
  const { prisma, courseService } = await loadServices();
  let instructors = 2;
  let deletes = 0;
  let transactionChain = Promise.resolve();
  const tx = {
    $queryRaw: async () => [{ id: "course-1" }],
    courseInstructor: {
      findFirst: async () => ({ id: "assignment" }),
      delete: async () => {
        deletes += 1;
        instructors -= 1;
        return {};
      },
    },
    course: {
      findUnique: async () => ({
        catalogStatus: "PUBLISHED",
        _count: { instructors },
      }),
    },
  };
  const restoreTransaction = replaceMethod(prisma, "$transaction", (callback: unknown) => {
    const run = transactionChain.then(() =>
      (callback as (client: unknown) => Promise<unknown>)(tx)
    );
    transactionChain = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  });

  try {
    const results = await Promise.allSettled([
      courseService.removeInstructor("course-1", "dosen-1"),
      courseService.removeInstructor("course-1", "dosen-2"),
    ]);

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    assert.ok(rejected);
    assert.equal((rejected.reason as { status?: number }).status, 409);
    assert.equal(deletes, 1);
    assert.equal(instructors, 1);
  } finally {
    restoreTransaction();
  }
});

test("assignInstructor keeps known business errors typed", async () => {
  const { prisma, courseService } = await loadServices();
  const restoreCourse = replaceMethod(prisma.course, "findUnique", async () => ({ id: "course-1" }));
  const restoreUser = replaceMethod(prisma.user, "findUnique", async () => ({
    id: "dosen-1",
    role: "dosen",
  }));
  const restoreAssignment = replaceMethod(prisma.courseInstructor, "findFirst", async () => ({
    id: "assignment-1",
  }));

  try {
    await assert.rejects(
      () => courseService.assignInstructor("course-1", "dosen-1"),
      (error: unknown) =>
        error instanceof courseService.CourseServiceError &&
        error.status === 409 &&
        error.message === "Dosen sudah ditugaskan ke course ini"
    );
  } finally {
    restoreCourse();
    restoreUser();
    restoreAssignment();
  }
});

test("createCourse maps duplicate normalized codes to a 409 conflict", async () => {
  const { prisma, courseService } = await loadServices();
  const restoreEnrollmentKey = replaceMethod(prisma.course, "findUnique", async () => null);
  const restoreProgram = replaceMethod(prisma.studyProgram, "findUnique", async () => ({
    id: "program-1",
  }));
  const restoreCreate = replaceMethod(prisma.course, "create", async () => {
    throw Object.assign(new Error("duplicate"), { code: "P2002" });
  });

  try {
    await assert.rejects(
      () =>
        courseService.createCourse(
          {
            title: "Pemrograman",
            courseCode: "IF1234",
            studyProgramId: "program-1",
          },
          "admin-1"
        ),
      (error: unknown) =>
        error instanceof courseService.CourseServiceError &&
        error.status === 409 &&
        /Kode mata kuliah/.test(error.message)
    );
  } finally {
    restoreEnrollmentKey();
    restoreProgram();
    restoreCreate();
  }
});

test("uploadCourseCover rejects invalid bytes before any storage call", async () => {
  const { prisma, courseService } = await loadServices();
  const restore = replaceMethod(prisma.course, "findUnique", async () => ({
    id: "course-1",
    coverStoragePath: null,
  }));

  try {
    await assert.rejects(
      () =>
        courseService.uploadCourseCover("course-1", {
          size: 9,
          buffer: Buffer.from("<svg></svg>"),
        }),
      (error: unknown) =>
        error instanceof courseService.CourseServiceError &&
        error.status === 400 &&
        /Format berkas tidak didukung/.test(error.message)
    );
  } finally {
    restore();
  }
});

test("admin listing preserves custom covers instead of regenerating them", async () => {
  const { prisma, courseService } = await loadServices();
  const customCover = "https://example.test/storage/cover.png";
  const restoreFindMany = replaceMethod(prisma.course, "findMany", async () => [
    {
      id: "course-1",
      title: "Kecerdasan Artifisial",
      enrollmentKey: "ABCD2345",
      coverImage: customCover,
      creator: { id: "admin-1", name: "Admin" },
      studyProgram: null,
      _count: { instructors: 0, enrollments: 0, sessions: 0 },
    },
  ]);
  const restoreUpdate = replaceMethod(prisma.course, "update", async () => {
    throw new Error("custom cover must not be regenerated");
  });

  try {
    const [course] = await courseService.listCourses({ catalogStatus: "PUBLISHED" });
    assert.equal(course.coverImage, customCover);
  } finally {
    restoreFindMany();
    restoreUpdate();
  }
});

test("student already-enrolled list is not publication-filtered but discovery and enrollment are", async () => {
  const { prisma, mahasiswaService } = await loadServices();
  const discoveryCalls: unknown[] = [];
  const restoreFindMany = replaceMethod(prisma.course, "findMany", async (args: unknown) => {
    discoveryCalls.push(args);
    return [];
  });
  const restoreFindFirst = replaceMethod(prisma.course, "findFirst", async (args: unknown) => {
    discoveryCalls.push(args);
    return null;
  });

  try {
    await mahasiswaService.listMahasiswaCourses("student-1");
    const enrolledWhere = (discoveryCalls[0] as { where: Record<string, unknown> }).where;
    assert.equal(enrolledWhere.catalogStatus, undefined);

    await mahasiswaService.searchAvailableCourses("student-1", "ai");
    const discoveryWhere = (discoveryCalls[1] as { where: Record<string, unknown> }).where;
    assert.equal(discoveryWhere.catalogStatus, "PUBLISHED");

    await assert.rejects(() =>
      mahasiswaService.enrollMahasiswaCourse("student-1", "course-1", "ABCD2345")
    );
    const enrollWhere = (discoveryCalls[2] as { where: Record<string, unknown> }).where;
    assert.equal(enrollWhere.catalogStatus, "PUBLISHED");
  } finally {
    restoreFindMany();
    restoreFindFirst();
  }
});

test("student already-enrolled list preserves custom covers", async () => {
  const { prisma, mahasiswaService } = await loadServices();
  const customCover = "https://example.test/storage/cover.png";
  const restoreFindMany = replaceMethod(prisma.course, "findMany", async () => [
    {
      id: "course-1",
      title: "Kecerdasan Artifisial",
      enrollmentKey: "ABCD2345",
      coverImage: customCover,
      creator: { id: "admin-1", name: "Admin" },
      instructors: [],
      _count: { instructors: 0, sessions: 0 },
    },
  ]);
  const restoreUpdate = replaceMethod(prisma.course, "update", async () => {
    throw new Error("custom cover must not be regenerated");
  });

  try {
    const [course] = await mahasiswaService.listMahasiswaCourses("student-1");
    assert.equal(course.coverImage, customCover);
  } finally {
    restoreFindMany();
    restoreUpdate();
  }
});

test("save flow retains the created course and never repeats creation after cover failure", async () => {
  for (const coverError of [
    new Error("HTTP 500"),
    new TypeError("Failed to fetch"),
  ]) {
    let metadataSaves = 0;
    let coverUploads = 0;
    const outcome = await saveCourseWithOptionalCover({
      hasCover: true,
      saveMetadata: async () => {
        metadataSaves += 1;
        return "course-42";
      },
      uploadCover: async (courseId) => {
        coverUploads += 1;
        assert.equal(courseId, "course-42");
        throw coverError;
      },
    });

    assert.equal(outcome.kind, "saved-without-cover");
    assert.equal(outcome.kind === "saved-without-cover" && outcome.courseId, "course-42");
    assert.equal(metadataSaves, 1);
    assert.equal(coverUploads, 1);

    const retry = await retrySavedCourseCover({
      courseId: "course-42",
      uploadCover: async (courseId) => {
        assert.equal(courseId, "course-42");
      },
    });
    assert.deepEqual(retry, { ok: true });
    assert.equal(metadataSaves, 1, "retry must not repeat metadata creation");
  }
});

test("save flow reports metadata failure separately and full success when no cover", async () => {
  const metadataFailure = await saveCourseWithOptionalCover({
    hasCover: true,
    saveMetadata: async () => {
      throw new Error("HTTP 400");
    },
    uploadCover: async () => {
      throw new Error("must not upload");
    },
  });
  assert.equal(metadataFailure.kind, "metadata-failed");

  const saved = await saveCourseWithOptionalCover({
    hasCover: false,
    saveMetadata: async () => "course-7",
    uploadCover: async () => {
      throw new Error("must not upload");
    },
  });
  assert.deepEqual(saved, { kind: "saved", courseId: "course-7" });
});

test("cover upload rejects header-only JPEG data before storage or cover replacement", async () => {
  const { prisma, courseService } = await loadServices();
  let replaced = false;
  const restoreFind = replaceMethod(prisma.course, "findUnique", async () => ({
    id: "course-1",
    coverStoragePath: null,
  }));
  const restoreUpdate = replaceMethod(prisma.course, "update", async () => {
    replaced = true;
    return {};
  });

  try {
    await assert.rejects(
      () =>
        courseService.uploadCourseCover("course-1", {
          size: jpegHeader.length,
          buffer: Buffer.from(jpegHeader),
        }),
      (error: unknown) =>
        error instanceof courseService.CourseServiceError &&
        error.status === 400 &&
        /tidak valid atau rusak/.test(error.message)
    );
    assert.equal(replaced, false);
  } finally {
    restoreFind();
    restoreUpdate();
  }
});

async function withAdminSession<T>(run: () => Promise<T>) {
  const { auth } = await import("../src/lib/auth");
  const restore = replaceMethod(auth.api, "getSession", async () => ({
    user: { id: "admin-1", role: "admin" },
    session: { id: "session-1" },
  }));
  try {
    return await run();
  } finally {
    restore();
  }
}

test("admin course POST returns controlled 400 for malformed JSON", async () => {
  const { POST } = await import("../src/app/api/admin/courses/route");

  await withAdminSession(async () => {
    const request = new Request("http://localhost/api/admin/courses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    const response = await POST(request as never);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Payload JSON tidak valid" });
  });
});

test("admin FR-001 routes hide unknown exception messages", async () => {
  const marker = "INTERNAL_MARKER_7f3a";
  const { prisma } = await loadServices();
  const restoreCreate = replaceMethod(prisma.course, "create", async () => {
    throw new Error(marker);
  });
  const restoreFindUnique = replaceMethod(prisma.course, "findUnique", async () => {
    throw new Error(marker);
  });

  try {
    await withAdminSession(async () => {
      const { POST } = await import("../src/app/api/admin/courses/route");
      const createRequest = new Request("http://localhost/api/admin/courses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Course", courseCode: "IF1234" }),
      });
      const createResponse = await POST(createRequest as never);
      assert.equal(createResponse.status, 500);
      assert.equal((await createResponse.text()).includes(marker), false);

      const { PATCH } = await import("../src/app/api/admin/courses/[id]/route");
      const patchRequest = new Request("http://localhost/api/admin/courses/course-1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Judul" }),
      });
      const patchResponse = await PATCH(patchRequest as never, {
        params: Promise.resolve({ id: "course-1" }),
      });
      assert.equal(patchResponse.status, 500);
      assert.equal((await patchResponse.text()).includes(marker), false);
    });
  } finally {
    restoreCreate();
    restoreFindUnique();
  }
});

test("instructor removal route hides unknown transaction errors", async () => {
  const marker = "INTERNAL_MARKER_TX";
  const { prisma } = await loadServices();
  const restoreTransaction = replaceMethod(prisma, "$transaction", async () => {
    throw new Error(marker);
  });

  try {
    await withAdminSession(async () => {
      const { DELETE } = await import(
        "../src/app/api/admin/courses/[id]/instructors/route"
      );
      const request = new NextRequest(
        "http://localhost/api/admin/courses/course-1/instructors?userId=dosen-1",
        { method: "DELETE" }
      );
      const response = await DELETE(request as never, {
        params: Promise.resolve({ id: "course-1" }),
      });
      assert.equal(response.status, 500);
      assert.equal((await response.text()).includes(marker), false);
    });
  } finally {
    restoreTransaction();
  }
});

test("lecturer title edits preserve an uploaded cover", async () => {
  const { prisma, dosenService } = await loadServices();
  const customCover = "https://example.test/storage/cover.png";
  const captured: { data: Record<string, unknown> | null } = { data: null };
  const restoreFindFirst = replaceMethod(prisma.course, "findFirst", async () => ({
    id: "course-1",
    title: "Judul Lama",
    enrollmentKey: "ABCD2345",
    coverImage: customCover,
  }));
  const restoreUpdate = replaceMethod(prisma.course, "update", async (args: unknown) => {
    captured.data = (args as { data: Record<string, unknown> }).data;
    return {};
  });
  const restoreFindUnique = replaceMethod(prisma.course, "findUnique", async () => ({
    id: "course-1",
    title: "Judul Baru",
    enrollmentKey: "ABCD2345",
    coverImage: customCover,
    creator: { id: "dosen-1", name: "Dosen" },
    instructors: [{ user: { id: "dosen-1", name: "Dosen", email: "d@test" } }],
    _count: { enrollments: 0, sessions: 0 },
  }));

  try {
    await dosenService.updateDosenCourse("course-1", "dosen-1", "ABCD2345", {
      title: "Judul Baru",
    });
    const data = captured.data;
    assert.ok(data);
    assert.equal(data.title, "Judul Baru");
    assert.equal("coverImage" in data, false);
  } finally {
    restoreFindFirst();
    restoreUpdate();
    restoreFindUnique();
  }
});

test("publication endpoint uses the session actor and returns changed status", async () => {
  const { prisma } = await loadServices();
  const fixture = publicationTx({
    id: "course-1",
    title: "Algoritma",
    courseCode: "IF1234",
    isActive: true,
    catalogStatus: "DRAFT",
    studyProgram: { id: "prog-1", facultyId: "fac-1" },
    _count: { instructors: 1 },
  });
  const restoreTransaction = stubTransaction(prisma, fixture.tx);

  try {
    await withAdminSession(async () => {
      const { POST } = await import(
        "../src/app/api/admin/courses/[id]/publication/route"
      );
      const request = new NextRequest(
        "http://localhost/api/admin/courses/course-1/publication",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "publish" }),
        }
      );
      const response = await POST(request as never, {
        params: Promise.resolve({ id: "course-1" }),
      });
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        catalogStatus: "PUBLISHED",
        changed: true,
      });
      assert.equal(fixture.stats().logs[0].actorId, "admin-1");
    });
  } finally {
    restoreTransaction();
  }
});

test("publication endpoint rejects malformed JSON and forged actor input", async () => {
  const { POST } = await import("../src/app/api/admin/courses/[id]/publication/route");

  await withAdminSession(async () => {
    const malformed = new NextRequest(
      "http://localhost/api/admin/courses/course-1/publication",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }
    );
    const malformedResponse = await POST(malformed as never, {
      params: Promise.resolve({ id: "course-1" }),
    });
    assert.equal(malformedResponse.status, 400);

    const forged = new NextRequest(
      "http://localhost/api/admin/courses/course-1/publication",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "publish", actorId: "forged" }),
      }
    );
    const forgedResponse = await POST(forged as never, {
      params: Promise.resolve({ id: "course-1" }),
    });
    assert.equal(forgedResponse.status, 400);
  });
});

test("publication endpoint rejects non-admin sessions", async () => {
  const { auth } = await import("../src/lib/auth");
  const restore = replaceMethod(auth.api, "getSession", async () => ({
    user: { id: "mahasiswa-1", role: "mahasiswa" },
    session: { id: "session-1" },
  }));

  try {
    const { POST } = await import(
      "../src/app/api/admin/courses/[id]/publication/route"
    );
    const request = new NextRequest(
      "http://localhost/api/admin/courses/course-1/publication",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "publish" }),
      }
    );
    const response = await POST(request as never, {
      params: Promise.resolve({ id: "course-1" }),
    });
    assert.equal(response.status, 403);
  } finally {
    restore();
  }
});
