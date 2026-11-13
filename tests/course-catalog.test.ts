import test from "node:test";
import assert from "node:assert/strict";

import {
  adminCreateCourseSchema,
  createCourseSchema,
  updateCourseSchema,
} from "../src/lib/schemas/course.schema";
import {
  detectCourseCoverImage,
  MAX_COURSE_COVER_BYTES,
  validateCourseCoverUpload,
} from "../src/lib/course-cover-upload";
import { isCustomCourseCover } from "../src/lib/course-cover";

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

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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

test("cover upload detects real JPG/PNG bytes and rejects other content", () => {
  assert.deepEqual(detectCourseCoverImage(jpeg), {
    contentType: "image/jpeg",
    extension: "jpg",
  });
  assert.deepEqual(detectCourseCoverImage(png), {
    contentType: "image/png",
    extension: "png",
  });
  assert.equal(detectCourseCoverImage(new TextEncoder().encode("<svg></svg>")), null);

  assert.equal(
    validateCourseCoverUpload({ size: MAX_COURSE_COVER_BYTES + 1, buffer: jpeg }).error,
    "Berkas gambar melebihi 2 MB."
  );
  assert.equal(
    validateCourseCoverUpload({ size: jpeg.length, buffer: new Uint8Array([0x47, 0x49, 0x46]) })
      .error,
    "Format berkas tidak didukung. Gunakan JPG atau PNG."
  );
});

test("uploaded covers are recognized as custom and preserved", () => {
  assert.equal(isCustomCourseCover("https://example.test/cover.png"), true);
  assert.equal(isCustomCourseCover("data:image/svg+xml;charset=UTF-8,abc"), false);
  assert.equal(isCustomCourseCover(null), false);
});

test("archiveCourse is idempotent and does not delete anything", async () => {
  const { prisma, courseService } = await loadServices();
  const calls: unknown[] = [];
  const restoreFind = replaceMethod(prisma.course, "findUnique", async () => ({
    id: "course-1",
    catalogStatus: "PUBLISHED",
  }));
  const restoreUpdate = replaceMethod(prisma.course, "update", async (args: unknown) => {
    calls.push(args);
    return { id: "course-1", catalogStatus: "ARCHIVED" };
  });

  try {
    const first = await courseService.archiveCourse("course-1");
    assert.deepEqual(first, { success: true, catalogStatus: "ARCHIVED" });
    assert.equal(calls.length, 1);

    restoreFind();
    replaceMethod(prisma.course, "findUnique", async () => ({
      id: "course-1",
      catalogStatus: "ARCHIVED",
    }));

    const second = await courseService.archiveCourse("course-1");
    assert.deepEqual(second, { success: true, catalogStatus: "ARCHIVED" });
    assert.equal(calls.length, 1, "already archived course must not be updated again");
  } finally {
    restoreFind();
    restoreUpdate();
  }
});

test("archiveCourse reports missing courses with a 404 service error", async () => {
  const { prisma, courseService } = await loadServices();
  const restore = replaceMethod(prisma.course, "findUnique", async () => null);

  try {
    await assert.rejects(
      () => courseService.archiveCourse("missing"),
      (error: unknown) =>
        error instanceof courseService.CourseServiceError &&
        error.status === 404 &&
        error.message === "Course tidak ditemukan"
    );
  } finally {
    restore();
  }
});

test("published entry cannot lose its last instructor", async () => {
  const { prisma, courseService } = await loadServices();
  const deleted: unknown[] = [];
  const restoreAssignment = replaceMethod(prisma.courseInstructor, "findFirst", async () => ({
    id: "assignment-1",
  }));
  const restoreCourse = replaceMethod(prisma.course, "findUnique", async () => ({
    catalogStatus: "PUBLISHED",
    _count: { instructors: 1 },
  }));
  const restoreDelete = replaceMethod(prisma.courseInstructor, "delete", async (args: unknown) => {
    deleted.push(args);
    return {};
  });

  try {
    await assert.rejects(
      () => courseService.removeInstructor("course-1", "dosen-1"),
      (error: unknown) =>
        error instanceof courseService.CourseServiceError && error.status === 409
    );
    assert.equal(deleted.length, 0);
  } finally {
    restoreAssignment();
    restoreCourse();
    restoreDelete();
  }
});

test("draft entry may lose its last instructor and published entry with two instructors may too", async () => {
  const { prisma, courseService } = await loadServices();
  const deleted: unknown[] = [];
  const restoreAssignment = replaceMethod(prisma.courseInstructor, "findFirst", async () => ({
    id: "assignment-1",
  }));
  const restoreCourse = replaceMethod(prisma.course, "findUnique", async () => ({
    catalogStatus: "DRAFT",
    _count: { instructors: 1 },
  }));
  const restoreDelete = replaceMethod(prisma.courseInstructor, "delete", async (args: unknown) => {
    deleted.push(args);
    return {};
  });

  try {
    await courseService.removeInstructor("course-1", "dosen-1");
    assert.equal(deleted.length, 1);

    restoreCourse();
    replaceMethod(prisma.course, "findUnique", async () => ({
      catalogStatus: "PUBLISHED",
      _count: { instructors: 2 },
    }));
    await courseService.removeInstructor("course-1", "dosen-2");
    assert.equal(deleted.length, 2);
  } finally {
    restoreAssignment();
    restoreCourse();
    restoreDelete();
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
