import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import {
  createFacultySchema,
  createStudyProgramSchema,
  updateFacultySchema,
  updateStudyProgramSchema,
} from "../src/lib/schemas/course.schema";

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

async function loadDeps() {
  const [{ default: prisma }, academicService] = await Promise.all([
    import("../src/lib/prisma"),
    import("../src/lib/services/academic.service"),
  ]);
  return { prisma, academicService };
}

async function withSession(user: Record<string, unknown> | null) {
  const { auth } = await import("../src/lib/auth");
  return replaceMethod(auth.api, "getSession", async () =>
    user ? { user, session: { id: "session-1" } } : null
  );
}

const EXPECTED_INCLUDE = {
  faculty: { select: { id: true, name: true, code: true } },
  _count: { select: { courses: true } },
};

const EXPECTED_ORDER_BY = [{ faculty: { name: "asc" } }, { name: "asc" }];

test("listStudyPrograms() with no args queries all study programs with expected include and orderBy", async () => {
  const { prisma, academicService } = await loadDeps();
  const calls: unknown[] = [];
  const sample = [
    {
      id: "sp-1",
      facultyId: "fac-1",
      name: "Informatika",
      code: "IF",
      faculty: { id: "fac-1", name: "Fakultas Teknik", code: "FT" },
      _count: { courses: 4 },
    },
  ];
  const restore = replaceMethod(prisma.studyProgram, "findMany", async (args: unknown) => {
    calls.push(args);
    return sample;
  });

  try {
    const result = await academicService.listStudyPrograms();
    assert.deepEqual(result, sample);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      where: {},
      include: EXPECTED_INCLUDE,
      orderBy: EXPECTED_ORDER_BY,
    });
  } finally {
    restore();
  }
});

test('listStudyPrograms("fac-1") passes where.facultyId', async () => {
  const { prisma, academicService } = await loadDeps();
  const calls: unknown[] = [];
  const restore = replaceMethod(prisma.studyProgram, "findMany", async (args: unknown) => {
    calls.push(args);
    return [];
  });

  try {
    await academicService.listStudyPrograms("fac-1");
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      where: { facultyId: "fac-1" },
      include: EXPECTED_INCLUDE,
      orderBy: EXPECTED_ORDER_BY,
    });
  } finally {
    restore();
  }
});

test('listStudyPrograms(undefined, "  informatika  ") trims whitespace and passes case-insensitive OR filter', async () => {
  const { prisma, academicService } = await loadDeps();
  const calls: unknown[] = [];
  const restore = replaceMethod(prisma.studyProgram, "findMany", async (args: unknown) => {
    calls.push(args);
    return [];
  });

  try {
    await academicService.listStudyPrograms(undefined, "  informatika  ");
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      where: {
        OR: [
          { name: { contains: "informatika", mode: "insensitive" } },
          { code: { contains: "informatika", mode: "insensitive" } },
          { faculty: { name: { contains: "informatika", mode: "insensitive" } } },
        ],
      },
      include: EXPECTED_INCLUDE,
      orderBy: EXPECTED_ORDER_BY,
    });
  } finally {
    restore();
  }
});

test('listStudyPrograms("fac-1", "IF") passes both facultyId and OR filters', async () => {
  const { prisma, academicService } = await loadDeps();
  const calls: unknown[] = [];
  const restore = replaceMethod(prisma.studyProgram, "findMany", async (args: unknown) => {
    calls.push(args);
    return [];
  });

  try {
    await academicService.listStudyPrograms("fac-1", "IF");
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      where: {
        facultyId: "fac-1",
        OR: [
          { name: { contains: "IF", mode: "insensitive" } },
          { code: { contains: "IF", mode: "insensitive" } },
          { faculty: { name: { contains: "IF", mode: "insensitive" } } },
        ],
      },
      include: EXPECTED_INCLUDE,
      orderBy: EXPECTED_ORDER_BY,
    });
  } finally {
    restore();
  }
});

test("GET /api/admin/academic/study-programs enforces admin auth and forwards trimmed facultyId and search params", async () => {
  const { prisma } = await loadDeps();
  const { GET } = await import("../src/app/api/admin/academic/study-programs/route");

  const calls: unknown[] = [];
  const expectedRows = [
    {
      id: "sp-1",
      facultyId: "fac-1",
      name: "Informatika",
      code: "IF",
      faculty: { id: "fac-1", name: "Fakultas Teknik", code: "FT" },
      _count: { courses: 2 },
    },
  ];
  const restoreFindMany = replaceMethod(prisma.studyProgram, "findMany", async (args: unknown) => {
    calls.push(args);
    return expectedRows;
  });

  try {
    let restoreSession = await withSession(null);
    try {
      const res = await GET(
        new NextRequest("http://localhost/api/admin/academic/study-programs")
      );
      assert.equal(res.status, 401);
      assert.equal(calls.length, 0);
    } finally {
      restoreSession();
    }

    restoreSession = await withSession({
      id: "user-2",
      role: "dosen",
      isActive: true,
      isFrozen: false,
    });
    try {
      const res = await GET(
        new NextRequest("http://localhost/api/admin/academic/study-programs")
      );
      assert.equal(res.status, 403);
      assert.equal(calls.length, 0);
    } finally {
      restoreSession();
    }

    restoreSession = await withSession({
      id: "admin-1",
      role: "admin",
      isActive: true,
      isFrozen: false,
    });
    try {
      const res = await GET(
        new NextRequest(
          "http://localhost/api/admin/academic/study-programs?facultyId=%20fac-1%20&search=%20informatika%20"
        )
      );
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), expectedRows);
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0], {
        where: {
          facultyId: "fac-1",
          OR: [
            { name: { contains: "informatika", mode: "insensitive" } },
            { code: { contains: "informatika", mode: "insensitive" } },
            { faculty: { name: { contains: "informatika", mode: "insensitive" } } },
          ],
        },
        include: EXPECTED_INCLUDE,
        orderBy: EXPECTED_ORDER_BY,
      });

      const emptyParamsRes = await GET(
        new NextRequest(
          "http://localhost/api/admin/academic/study-programs?facultyId=%20%20&search=%20%20"
        )
      );
      assert.equal(emptyParamsRes.status, 200);
      assert.equal(calls.length, 2);
      assert.deepEqual(calls[1], {
        where: {},
        include: EXPECTED_INCLUDE,
        orderBy: EXPECTED_ORDER_BY,
      });
    } finally {
      restoreSession();
    }
  } finally {
    restoreFindMany();
  }
});


function makeRouteContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

test("createStudyProgramSchema normalizes optional code and rejects invalid codes", () => {
  const withCode = createStudyProgramSchema.parse({
    facultyId: " fac-1 ",
    name: " Informatika ",
    code: " if_01-a ",
  });
  assert.deepEqual(withCode, {
    facultyId: "fac-1",
    name: "Informatika",
    code: "IF_01-A",
  });

  const blankCode = createStudyProgramSchema.parse({
    facultyId: "fac-1",
    name: "Informatika",
    code: "   ",
  });
  assert.equal(blankCode.code, null);

  const nullCode = createStudyProgramSchema.parse({
    facultyId: "fac-1",
    name: "Informatika",
    code: null,
  });
  assert.equal(nullCode.code, null);

  const omittedCode = createStudyProgramSchema.parse({
    facultyId: "fac-1",
    name: "Informatika",
  });
  assert.equal(omittedCode.code, undefined);

  for (const invalidCode of ["A", "A".repeat(21), "-IF", "_IF", "IF 1", "IF@1"]) {
    assert.equal(
      createStudyProgramSchema.safeParse({
        facultyId: "fac-1",
        name: "Informatika",
        code: invalidCode,
      }).success,
      false,
      `expected code ${invalidCode} to be rejected`
    );
  }
});

test("updateStudyProgramSchema allows partial updates and rejects empty or unknown payloads", () => {
  assert.deepEqual(updateStudyProgramSchema.parse({ name: "  Teknik Komputer  " }), {
    name: "Teknik Komputer",
  });
  assert.deepEqual(updateStudyProgramSchema.parse({ code: " tk-01 " }), {
    code: "TK-01",
  });
  assert.deepEqual(updateStudyProgramSchema.parse({ code: "" }), {
    code: null,
  });
  assert.deepEqual(updateStudyProgramSchema.parse({ facultyId: " fac-2 " }), {
    facultyId: "fac-2",
  });

  assert.equal(updateStudyProgramSchema.safeParse({}).success, false);
  assert.equal(
    updateStudyProgramSchema.safeParse({ name: "Valid", unknownField: "x" }).success,
    false
  );
  assert.equal(updateStudyProgramSchema.safeParse({ code: "x" }).success, false);
});

test("createStudyProgram() supports code, enforces faculty existence (404), and distinguishes name/code conflicts (409)", async () => {
  const { prisma, academicService } = await loadDeps();

  const createdSample = {
    id: "sp-new",
    facultyId: "fac-1",
    name: "Informatika",
    code: "IF",
    faculty: { id: "fac-1", name: "Fakultas Teknik", code: "FT" },
    _count: { courses: 0 },
  };

  let createArgs: unknown = null;
  const restoreFacultyFind = replaceMethod(
    prisma.faculty,
    "findUnique",
    async (args: unknown) => {
      const { where } = args as { where: { id: string } };
      return where.id === "fac-1" ? { id: "fac-1" } : null;
    }
  );
  const restoreProgramCreate = replaceMethod(
    prisma.studyProgram,
    "create",
    async (args: unknown) => {
      createArgs = args;
      return createdSample;
    }
  );

  try {
    const created = await academicService.createStudyProgram("fac-1", " Informatika ", "IF");
    assert.deepEqual(created, createdSample);
    assert.deepEqual(
      (createArgs as { data: Record<string, unknown>; include: unknown }).include,
      EXPECTED_INCLUDE
    );
    assert.equal(
      (createArgs as { data: Record<string, unknown> }).data.facultyId,
      "fac-1"
    );
    assert.equal(
      (createArgs as { data: Record<string, unknown> }).data.name,
      "Informatika"
    );
    assert.equal((createArgs as { data: Record<string, unknown> }).data.code, "IF");

    await assert.rejects(
      () => academicService.createStudyProgram("missing-fac", "Informatika", "IF"),
      (err: unknown) =>
        err instanceof academicService.AcademicReferenceError &&
        err.status === 404 &&
        err.message === "Fakultas tidak ditemukan."
    );

    const restoreDupCode = replaceMethod(prisma.studyProgram, "create", async () => {
      throw { code: "P2002", meta: { target: ["facultyId", "code"] } };
    });
    try {
      await assert.rejects(
        () => academicService.createStudyProgram("fac-1", "Informatika", "IF"),
        (err: unknown) =>
          err instanceof academicService.AcademicReferenceError &&
          err.status === 409 &&
          err.message === "Kode program studi tersebut sudah digunakan pada fakultas ini."
      );
    } finally {
      restoreDupCode();
    }

    const restoreDupName = replaceMethod(prisma.studyProgram, "create", async () => {
      throw { code: "P2002", meta: { target: ["facultyId", "name"] } };
    });
    try {
      await assert.rejects(
        () => academicService.createStudyProgram("fac-1", "Informatika"),
        (err: unknown) =>
          err instanceof academicService.AcademicReferenceError &&
          err.status === 409 &&
          err.message === "Program studi dengan nama tersebut sudah ada pada fakultas ini."
      );
    } finally {
      restoreDupName();
    }
  } finally {
    restoreProgramCreate();
    restoreFacultyFind();
  }
});

test("updateStudyProgram() updates fields, checks program/faculty existence (404), and handles conflicts (409)", async () => {
  const { prisma, academicService } = await loadDeps();

  const updatedRow = {
    id: "sp-1",
    facultyId: "fac-2",
    name: "Sistem Informasi",
    code: "SI",
    faculty: { id: "fac-2", name: "Fakultas Ilmu Komputer", code: "FIK" },
    _count: { courses: 1 },
  };
  let updateArgs: unknown = null;

  const restoreProgramFind = replaceMethod(
    prisma.studyProgram,
    "findUnique",
    async (args: unknown) => {
      const { where } = args as { where: { id: string } };
      return where.id === "sp-1" ? { id: "sp-1", facultyId: "fac-1" } : null;
    }
  );
  const restoreFacultyFind = replaceMethod(
    prisma.faculty,
    "findUnique",
    async (args: unknown) => {
      const { where } = args as { where: { id: string } };
      return where.id === "fac-2" ? { id: "fac-2" } : null;
    }
  );
  const restoreProgramUpdate = replaceMethod(
    prisma.studyProgram,
    "update",
    async (args: unknown) => {
      updateArgs = args;
      return updatedRow;
    }
  );

  try {
    const result = await academicService.updateStudyProgram("sp-1", {
      facultyId: "fac-2",
      name: "  Sistem Informasi  ",
      code: "SI",
    });
    assert.deepEqual(result, updatedRow);
    assert.deepEqual(updateArgs, {
      where: { id: "sp-1" },
      data: { facultyId: "fac-2", name: "Sistem Informasi", code: "SI" },
      include: EXPECTED_INCLUDE,
    });

    await assert.rejects(
      () => academicService.updateStudyProgram("missing-sp", { name: "Baru" }),
      (err: unknown) =>
        err instanceof academicService.AcademicReferenceError &&
        err.status === 404 &&
        err.message === "Program studi tidak ditemukan."
    );

    await assert.rejects(
      () => academicService.updateStudyProgram("sp-1", { facultyId: "missing-fac" }),
      (err: unknown) =>
        err instanceof academicService.AcademicReferenceError &&
        err.status === 404 &&
        err.message === "Fakultas tidak ditemukan."
    );

    const restoreDup = replaceMethod(prisma.studyProgram, "update", async () => {
      throw { code: "P2002", meta: { target: ["facultyId", "code"] } };
    });
    try {
      await assert.rejects(
        () => academicService.updateStudyProgram("sp-1", { code: "DUP" }),
        (err: unknown) =>
          err instanceof academicService.AcademicReferenceError &&
          err.status === 409 &&
          err.message === "Kode program studi tersebut sudah digunakan pada fakultas ini."
      );
    } finally {
      restoreDup();
    }
  } finally {
    restoreProgramUpdate();
    restoreFacultyFind();
    restoreProgramFind();
  }
});

test("deleteStudyProgram() deletes unused programs and blocks deletion when referenced", async () => {
  const { prisma, academicService } = await loadDeps();

  let deletedWhere: unknown = null;
  const countsById: Record<string, { courses: number; academicCourseReferences: number }> = {
    "sp-free": { courses: 0, academicCourseReferences: 0 },
    "sp-courses": { courses: 2, academicCourseReferences: 0 },
    "sp-refs": { courses: 0, academicCourseReferences: 1 },
    "sp-fk": { courses: 0, academicCourseReferences: 0 },
  };

  const restoreFind = replaceMethod(
    prisma.studyProgram,
    "findUnique",
    async (args: unknown) => {
      const { where } = args as { where: { id: string } };
      const counts = countsById[where.id];
      return counts ? { id: where.id, _count: counts } : null;
    }
  );
  const restoreDelete = replaceMethod(
    prisma.studyProgram,
    "delete",
    async (args: unknown) => {
      const { where } = args as { where: { id: string } };
      if (where.id === "sp-fk") {
        throw { code: "P2003" };
      }
      deletedWhere = where;
      return { id: where.id };
    }
  );

  try {
    const res = await academicService.deleteStudyProgram("sp-free");
    assert.deepEqual(res, { success: true });
    assert.deepEqual(deletedWhere, { id: "sp-free" });

    await assert.rejects(
      () => academicService.deleteStudyProgram("missing-sp"),
      (err: unknown) =>
        err instanceof academicService.AcademicReferenceError &&
        err.status === 404 &&
        err.message === "Program studi tidak ditemukan."
    );

    await assert.rejects(
      () => academicService.deleteStudyProgram("sp-courses"),
      (err: unknown) =>
        err instanceof academicService.AcademicReferenceError &&
        err.status === 409
    );

    await assert.rejects(
      () => academicService.deleteStudyProgram("sp-refs"),
      (err: unknown) =>
        err instanceof academicService.AcademicReferenceError &&
        err.status === 409
    );

    await assert.rejects(
      () => academicService.deleteStudyProgram("sp-fk"),
      (err: unknown) =>
        err instanceof academicService.AcademicReferenceError &&
        err.status === 409
    );
  } finally {
    restoreDelete();
    restoreFind();
  }
});

test("POST /api/admin/academic/study-programs forwards normalized code and returns 201", async () => {
  const { prisma } = await loadDeps();
  const { POST } = await import("../src/app/api/admin/academic/study-programs/route");

  let capturedData: unknown = null;
  const created = {
    id: "sp-1",
    facultyId: "fac-1",
    name: "Informatika",
    code: "IF-01",
    faculty: { id: "fac-1", name: "Fakultas Teknik", code: "FT" },
    _count: { courses: 0 },
  };

  const restoreSession = await withSession({
    id: "admin-1",
    role: "admin",
    isActive: true,
    isFrozen: false,
  });
  const restoreFacultyFind = replaceMethod(
    prisma.faculty,
    "findUnique",
    async () => ({ id: "fac-1" })
  );
  const restoreCreate = replaceMethod(
    prisma.studyProgram,
    "create",
    async (args: unknown) => {
      capturedData = (args as { data: Record<string, unknown> }).data;
      return created;
    }
  );

  try {
    const res = await POST(
      new NextRequest("http://localhost/api/admin/academic/study-programs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          facultyId: "fac-1",
          name: "Informatika",
          code: " if-01 ",
        }),
      })
    );
    assert.equal(res.status, 201);
    assert.deepEqual(await res.json(), created);
    assert.equal((capturedData as { code?: unknown } | null)?.code, "IF-01");
  } finally {
    restoreCreate();
    restoreFacultyFind();
    restoreSession();
  }
});

test("PATCH /api/admin/academic/study-programs/[id] handles auth, validation, 404, 409, and 200", async () => {
  const { prisma } = await loadDeps();
  const { PATCH } = await import("../src/app/api/admin/academic/study-programs/[id]/route");

  const updatedRow = {
    id: "sp-1",
    facultyId: "fac-1",
    name: "Teknik Informatika",
    code: "TI",
    faculty: { id: "fac-1", name: "Fakultas Teknik", code: "FT" },
    _count: { courses: 3 },
  };

  let restoreSession = await withSession(null);
  try {
    const unauth = await PATCH(
      new NextRequest("http://localhost/api/admin/academic/study-programs/sp-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Teknik Informatika" }),
      }),
      makeRouteContext("sp-1")
    );
    assert.equal(unauth.status, 401);
  } finally {
    restoreSession();
  }

  restoreSession = await withSession({
    id: "user-2",
    role: "dosen",
    isActive: true,
    isFrozen: false,
  });
  try {
    const forbidden = await PATCH(
      new NextRequest("http://localhost/api/admin/academic/study-programs/sp-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Teknik Informatika" }),
      }),
      makeRouteContext("sp-1")
    );
    assert.equal(forbidden.status, 403);
  } finally {
    restoreSession();
  }

  restoreSession = await withSession({
    id: "admin-1",
    role: "admin",
    isActive: true,
    isFrozen: false,
  });
  try {
    const badJson = await PATCH(
      new NextRequest("http://localhost/api/admin/academic/study-programs/sp-1", {
        method: "PATCH",
        body: "{invalid",
      }),
      makeRouteContext("sp-1")
    );
    assert.equal(badJson.status, 400);

    const badSchema = await PATCH(
      new NextRequest("http://localhost/api/admin/academic/study-programs/sp-1", {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
      makeRouteContext("sp-1")
    );
    assert.equal(badSchema.status, 400);
    const badSchemaBody = await badSchema.json();
    assert.equal(typeof badSchemaBody.error, "string");
    assert.ok(Array.isArray(badSchemaBody.issues));

    const restoreMissing = replaceMethod(
      prisma.studyProgram,
      "findUnique",
      async () => null
    );
    try {
      const notFound = await PATCH(
        new NextRequest("http://localhost/api/admin/academic/study-programs/missing", {
          method: "PATCH",
          body: JSON.stringify({ name: "Baru" }),
        }),
        makeRouteContext("missing")
      );
      assert.equal(notFound.status, 404);
    } finally {
      restoreMissing();
    }

    const restoreFind = replaceMethod(
      prisma.studyProgram,
      "findUnique",
      async () => ({ id: "sp-1", facultyId: "fac-1" })
    );
    const restoreConflict = replaceMethod(
      prisma.studyProgram,
      "update",
      async () => {
        throw { code: "P2002", meta: { target: ["facultyId", "code"] } };
      }
    );
    try {
      const conflict = await PATCH(
        new NextRequest("http://localhost/api/admin/academic/study-programs/sp-1", {
          method: "PATCH",
          body: JSON.stringify({ code: "TI" }),
        }),
        makeRouteContext("sp-1")
      );
      assert.equal(conflict.status, 409);
    } finally {
      restoreConflict();
      restoreFind();
    }

    const restoreFindOk = replaceMethod(
      prisma.studyProgram,
      "findUnique",
      async () => ({ id: "sp-1", facultyId: "fac-1" })
    );
    const restoreUpdateOk = replaceMethod(
      prisma.studyProgram,
      "update",
      async () => updatedRow
    );
    try {
      const ok = await PATCH(
        new NextRequest("http://localhost/api/admin/academic/study-programs/sp-1", {
          method: "PATCH",
          body: JSON.stringify({ name: "Teknik Informatika", code: "ti" }),
        }),
        makeRouteContext("sp-1")
      );
      assert.equal(ok.status, 200);
      assert.deepEqual(await ok.json(), updatedRow);
    } finally {
      restoreUpdateOk();
      restoreFindOk();
    }
  } finally {
    restoreSession();
  }
});

test("DELETE /api/admin/academic/study-programs/[id] handles auth, 404, 409, and 200", async () => {
  const { prisma } = await loadDeps();
  const { DELETE } = await import("../src/app/api/admin/academic/study-programs/[id]/route");

  let restoreSession = await withSession(null);
  try {
    const unauth = await DELETE(
      new NextRequest("http://localhost/api/admin/academic/study-programs/sp-1", {
        method: "DELETE",
      }),
      makeRouteContext("sp-1")
    );
    assert.equal(unauth.status, 401);
  } finally {
    restoreSession();
  }

  restoreSession = await withSession({
    id: "user-2",
    role: "dosen",
    isActive: true,
    isFrozen: false,
  });
  try {
    const forbidden = await DELETE(
      new NextRequest("http://localhost/api/admin/academic/study-programs/sp-1", {
        method: "DELETE",
      }),
      makeRouteContext("sp-1")
    );
    assert.equal(forbidden.status, 403);
  } finally {
    restoreSession();
  }

  restoreSession = await withSession({
    id: "admin-1",
    role: "admin",
    isActive: true,
    isFrozen: false,
  });
  try {
    const restoreMissing = replaceMethod(
      prisma.studyProgram,
      "findUnique",
      async () => null
    );
    try {
      const notFound = await DELETE(
        new NextRequest("http://localhost/api/admin/academic/study-programs/missing", {
          method: "DELETE",
        }),
        makeRouteContext("missing")
      );
      assert.equal(notFound.status, 404);
    } finally {
      restoreMissing();
    }

    const restoreInUse = replaceMethod(
      prisma.studyProgram,
      "findUnique",
      async () => ({ id: "sp-1", _count: { courses: 1, academicCourseReferences: 0 } })
    );
    try {
      const conflict = await DELETE(
        new NextRequest("http://localhost/api/admin/academic/study-programs/sp-1", {
          method: "DELETE",
        }),
        makeRouteContext("sp-1")
      );
      assert.equal(conflict.status, 409);
    } finally {
      restoreInUse();
    }

    const restoreFindOk = replaceMethod(
      prisma.studyProgram,
      "findUnique",
      async () => ({ id: "sp-1", _count: { courses: 0, academicCourseReferences: 0 } })
    );
    const restoreDeleteOk = replaceMethod(
      prisma.studyProgram,
      "delete",
      async () => ({ id: "sp-1" })
    );
    try {
      const ok = await DELETE(
        new NextRequest("http://localhost/api/admin/academic/study-programs/sp-1", {
          method: "DELETE",
        }),
        makeRouteContext("sp-1")
      );
      assert.equal(ok.status, 200);
      assert.deepEqual(await ok.json(), { success: true });
    } finally {
      restoreDeleteOk();
      restoreFindOk();
    }
  } finally {
    restoreSession();
  }
});

const EXPECTED_FACULTY_INCLUDE = {
  studyPrograms: {
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  },
};

test("createFacultySchema normalizes optional code and rejects invalid codes", () => {
  const withCode = createFacultySchema.parse({
    name: " Fakultas Teknik ",
    code: " ft_01-a ",
  });
  assert.deepEqual(withCode, {
    name: "Fakultas Teknik",
    code: "FT_01-A",
  });

  const blankCode = createFacultySchema.parse({
    name: "Fakultas Teknik",
    code: "   ",
  });
  assert.equal(blankCode.code, null);

  const nullCode = createFacultySchema.parse({
    name: "Fakultas Teknik",
    code: null,
  });
  assert.equal(nullCode.code, null);

  const omittedCode = createFacultySchema.parse({
    name: "Fakultas Teknik",
  });
  assert.equal(omittedCode.code, undefined);

  for (const invalidCode of ["A", "A".repeat(21), "-FT", "_FT", "FT 1", "FT@1"]) {
    assert.equal(
      createFacultySchema.safeParse({
        name: "Fakultas Teknik",
        code: invalidCode,
      }).success,
      false,
      `expected faculty code ${invalidCode} to be rejected`
    );
  }
});

test("updateFacultySchema allows partial updates and rejects empty or unknown payloads", () => {
  assert.deepEqual(updateFacultySchema.parse({ name: "  Fakultas Sains  " }), {
    name: "Fakultas Sains",
  });
  assert.deepEqual(updateFacultySchema.parse({ code: " fs-01 " }), {
    code: "FS-01",
  });
  assert.deepEqual(updateFacultySchema.parse({ code: "" }), {
    code: null,
  });

  assert.equal(updateFacultySchema.safeParse({}).success, false);
  assert.equal(
    updateFacultySchema.safeParse({ name: "Valid", unknownField: "x" }).success,
    false
  );
  assert.equal(updateFacultySchema.safeParse({ code: "x" }).success, false);
});

test("createFaculty() supports code and distinguishes duplicate name vs duplicate code (409)", async () => {
  const { prisma, academicService } = await loadDeps();

  const createdSample = {
    id: "fac-new",
    name: "Fakultas Teknik",
    code: "FT",
    studyPrograms: [],
  };

  let createArgs: unknown = null;
  const restoreCreate = replaceMethod(prisma.faculty, "create", async (args: unknown) => {
    createArgs = args;
    return createdSample;
  });

  try {
    const created = await academicService.createFaculty(" Fakultas Teknik ", "FT");
    assert.deepEqual(created, createdSample);
    assert.deepEqual(
      (createArgs as { include: unknown }).include,
      EXPECTED_FACULTY_INCLUDE
    );
    assert.equal(
      (createArgs as { data: Record<string, unknown> }).data.name,
      "Fakultas Teknik"
    );
    assert.equal((createArgs as { data: Record<string, unknown> }).data.code, "FT");

    const restoreDupCode = replaceMethod(prisma.faculty, "create", async () => {
      throw { code: "P2002", meta: { target: ["code"] } };
    });
    try {
      await assert.rejects(
        () => academicService.createFaculty("Fakultas Teknik", "FT"),
        (err: unknown) =>
          err instanceof academicService.AcademicReferenceError &&
          err.status === 409 &&
          err.message === "Kode fakultas tersebut sudah digunakan."
      );
    } finally {
      restoreDupCode();
    }

    const restoreDupName = replaceMethod(prisma.faculty, "create", async () => {
      throw { code: "P2002", meta: { target: ["name"] } };
    });
    try {
      await assert.rejects(
        () => academicService.createFaculty("Fakultas Teknik"),
        (err: unknown) =>
          err instanceof academicService.AcademicReferenceError &&
          err.status === 409 &&
          err.message === "Fakultas dengan nama tersebut sudah ada."
      );
    } finally {
      restoreDupName();
    }
  } finally {
    restoreCreate();
  }
});

test("updateFaculty() updates fields, checks existence (404), and distinguishes name/code conflicts (409)", async () => {
  const { prisma, academicService } = await loadDeps();

  const updatedRow = {
    id: "fac-1",
    name: "Fakultas Ilmu Komputer",
    code: "FIK",
    studyPrograms: [{ id: "sp-1", name: "Informatika" }],
  };
  let updateArgs: unknown = null;

  const restoreFind = replaceMethod(prisma.faculty, "findUnique", async (args: unknown) => {
    const { where } = args as { where: { id: string } };
    return where.id === "fac-1" ? { id: "fac-1" } : null;
  });
  const restoreUpdate = replaceMethod(prisma.faculty, "update", async (args: unknown) => {
    updateArgs = args;
    return updatedRow;
  });

  try {
    const result = await academicService.updateFaculty("fac-1", {
      name: "  Fakultas Ilmu Komputer  ",
      code: "FIK",
    });
    assert.deepEqual(result, updatedRow);
    assert.deepEqual(updateArgs, {
      where: { id: "fac-1" },
      data: { name: "Fakultas Ilmu Komputer", code: "FIK" },
      include: EXPECTED_FACULTY_INCLUDE,
    });

    await assert.rejects(
      () => academicService.updateFaculty("missing-fac", { name: "Baru" }),
      (err: unknown) =>
        err instanceof academicService.AcademicReferenceError &&
        err.status === 404 &&
        err.message === "Fakultas tidak ditemukan."
    );

    const restoreDupCode = replaceMethod(prisma.faculty, "update", async () => {
      throw { code: "P2002", meta: { target: ["code"] } };
    });
    try {
      await assert.rejects(
        () => academicService.updateFaculty("fac-1", { code: "DUP" }),
        (err: unknown) =>
          err instanceof academicService.AcademicReferenceError &&
          err.status === 409 &&
          err.message === "Kode fakultas tersebut sudah digunakan."
      );
    } finally {
      restoreDupCode();
    }

    const restoreDupName = replaceMethod(prisma.faculty, "update", async () => {
      throw { code: "P2002", meta: { target: ["name"] } };
    });
    try {
      await assert.rejects(
        () => academicService.updateFaculty("fac-1", { name: "Duplikat" }),
        (err: unknown) =>
          err instanceof academicService.AcademicReferenceError &&
          err.status === 409 &&
          err.message === "Fakultas dengan nama tersebut sudah ada."
      );
    } finally {
      restoreDupName();
    }
  } finally {
    restoreUpdate();
    restoreFind();
  }
});

test("deleteFaculty() deletes unused faculties and blocks deletion when study programs exist or on P2003", async () => {
  const { prisma, academicService } = await loadDeps();

  let deletedWhere: unknown = null;
  const countsById: Record<string, { studyPrograms: number }> = {
    "fac-free": { studyPrograms: 0 },
    "fac-busy": { studyPrograms: 2 },
    "fac-fk": { studyPrograms: 0 },
  };

  const restoreFind = replaceMethod(prisma.faculty, "findUnique", async (args: unknown) => {
    const { where } = args as { where: { id: string } };
    const counts = countsById[where.id];
    return counts ? { id: where.id, _count: counts } : null;
  });
  const restoreDelete = replaceMethod(prisma.faculty, "delete", async (args: unknown) => {
    const { where } = args as { where: { id: string } };
    if (where.id === "fac-fk") {
      throw { code: "P2003" };
    }
    deletedWhere = where;
    return { id: where.id };
  });

  try {
    const res = await academicService.deleteFaculty("fac-free");
    assert.deepEqual(res, { success: true });
    assert.deepEqual(deletedWhere, { id: "fac-free" });

    await assert.rejects(
      () => academicService.deleteFaculty("missing-fac"),
      (err: unknown) =>
        err instanceof academicService.AcademicReferenceError &&
        err.status === 404 &&
        err.message === "Fakultas tidak ditemukan."
    );

    await assert.rejects(
      () => academicService.deleteFaculty("fac-busy"),
      (err: unknown) =>
        err instanceof academicService.AcademicReferenceError &&
        err.status === 409 &&
        err.message === "Fakultas tidak dapat dihapus karena masih memiliki program studi terkait."
    );

    await assert.rejects(
      () => academicService.deleteFaculty("fac-fk"),
      (err: unknown) =>
        err instanceof academicService.AcademicReferenceError &&
        err.status === 409 &&
        err.message === "Fakultas tidak dapat dihapus karena masih memiliki program studi terkait."
    );
  } finally {
    restoreDelete();
    restoreFind();
  }
});

test("POST /api/admin/academic/faculties forwards normalized code and returns 201", async () => {
  const { prisma } = await loadDeps();
  const { POST } = await import("../src/app/api/admin/academic/faculties/route");

  let capturedData: unknown = null;
  const created = {
    id: "fac-1",
    name: "Fakultas Teknik",
    code: "FT-01",
    studyPrograms: [],
  };

  const restoreSession = await withSession({
    id: "admin-1",
    role: "admin",
    isActive: true,
    isFrozen: false,
  });
  const restoreCreate = replaceMethod(prisma.faculty, "create", async (args: unknown) => {
    capturedData = (args as { data: Record<string, unknown> }).data;
    return created;
  });

  try {
    const res = await POST(
      new NextRequest("http://localhost/api/admin/academic/faculties", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Fakultas Teknik",
          code: " ft-01 ",
        }),
      })
    );
    assert.equal(res.status, 201);
    assert.deepEqual(await res.json(), created);
    assert.equal((capturedData as { code?: unknown } | null)?.code, "FT-01");
  } finally {
    restoreCreate();
    restoreSession();
  }
});

test("PATCH /api/admin/academic/faculties/[id] handles auth, validation, 404, 409, and 200", async () => {
  const { prisma } = await loadDeps();
  const { PATCH } = await import("../src/app/api/admin/academic/faculties/[id]/route");

  const updatedRow = {
    id: "fac-1",
    name: "Fakultas Teknik",
    code: "FT",
    studyPrograms: [{ id: "sp-1", name: "Informatika" }],
  };

  let restoreSession = await withSession(null);
  try {
    const unauth = await PATCH(
      new NextRequest("http://localhost/api/admin/academic/faculties/fac-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Fakultas Teknik" }),
      }),
      makeRouteContext("fac-1")
    );
    assert.equal(unauth.status, 401);
  } finally {
    restoreSession();
  }

  restoreSession = await withSession({
    id: "user-2",
    role: "dosen",
    isActive: true,
    isFrozen: false,
  });
  try {
    const forbidden = await PATCH(
      new NextRequest("http://localhost/api/admin/academic/faculties/fac-1", {
        method: "PATCH",
        body: JSON.stringify({ name: "Fakultas Teknik" }),
      }),
      makeRouteContext("fac-1")
    );
    assert.equal(forbidden.status, 403);
  } finally {
    restoreSession();
  }

  restoreSession = await withSession({
    id: "admin-1",
    role: "admin",
    isActive: true,
    isFrozen: false,
  });
  try {
    const badJson = await PATCH(
      new NextRequest("http://localhost/api/admin/academic/faculties/fac-1", {
        method: "PATCH",
        body: "{invalid",
      }),
      makeRouteContext("fac-1")
    );
    assert.equal(badJson.status, 400);

    const badSchema = await PATCH(
      new NextRequest("http://localhost/api/admin/academic/faculties/fac-1", {
        method: "PATCH",
        body: JSON.stringify({}),
      }),
      makeRouteContext("fac-1")
    );
    assert.equal(badSchema.status, 400);
    const badSchemaBody = await badSchema.json();
    assert.equal(typeof badSchemaBody.error, "string");
    assert.ok(Array.isArray(badSchemaBody.issues));

    const restoreMissing = replaceMethod(prisma.faculty, "findUnique", async () => null);
    try {
      const notFound = await PATCH(
        new NextRequest("http://localhost/api/admin/academic/faculties/missing", {
          method: "PATCH",
          body: JSON.stringify({ name: "Baru" }),
        }),
        makeRouteContext("missing")
      );
      assert.equal(notFound.status, 404);
    } finally {
      restoreMissing();
    }

    const restoreFind = replaceMethod(
      prisma.faculty,
      "findUnique",
      async () => ({ id: "fac-1" })
    );
    const restoreConflict = replaceMethod(prisma.faculty, "update", async () => {
      throw { code: "P2002", meta: { target: ["code"] } };
    });
    try {
      const conflict = await PATCH(
        new NextRequest("http://localhost/api/admin/academic/faculties/fac-1", {
          method: "PATCH",
          body: JSON.stringify({ code: "FT" }),
        }),
        makeRouteContext("fac-1")
      );
      assert.equal(conflict.status, 409);
    } finally {
      restoreConflict();
      restoreFind();
    }

    const restoreFindOk = replaceMethod(
      prisma.faculty,
      "findUnique",
      async () => ({ id: "fac-1" })
    );
    const restoreUpdateOk = replaceMethod(
      prisma.faculty,
      "update",
      async () => updatedRow
    );
    try {
      const ok = await PATCH(
        new NextRequest("http://localhost/api/admin/academic/faculties/fac-1", {
          method: "PATCH",
          body: JSON.stringify({ name: "Fakultas Teknik", code: "ft" }),
        }),
        makeRouteContext("fac-1")
      );
      assert.equal(ok.status, 200);
      assert.deepEqual(await ok.json(), updatedRow);
    } finally {
      restoreUpdateOk();
      restoreFindOk();
    }
  } finally {
    restoreSession();
  }
});

test("DELETE /api/admin/academic/faculties/[id] handles auth, 404, 409, and 200", async () => {
  const { prisma } = await loadDeps();
  const { DELETE } = await import("../src/app/api/admin/academic/faculties/[id]/route");

  let restoreSession = await withSession(null);
  try {
    const unauth = await DELETE(
      new NextRequest("http://localhost/api/admin/academic/faculties/fac-1", {
        method: "DELETE",
      }),
      makeRouteContext("fac-1")
    );
    assert.equal(unauth.status, 401);
  } finally {
    restoreSession();
  }

  restoreSession = await withSession({
    id: "user-2",
    role: "dosen",
    isActive: true,
    isFrozen: false,
  });
  try {
    const forbidden = await DELETE(
      new NextRequest("http://localhost/api/admin/academic/faculties/fac-1", {
        method: "DELETE",
      }),
      makeRouteContext("fac-1")
    );
    assert.equal(forbidden.status, 403);
  } finally {
    restoreSession();
  }

  restoreSession = await withSession({
    id: "admin-1",
    role: "admin",
    isActive: true,
    isFrozen: false,
  });
  try {
    const restoreMissing = replaceMethod(prisma.faculty, "findUnique", async () => null);
    try {
      const notFound = await DELETE(
        new NextRequest("http://localhost/api/admin/academic/faculties/missing", {
          method: "DELETE",
        }),
        makeRouteContext("missing")
      );
      assert.equal(notFound.status, 404);
    } finally {
      restoreMissing();
    }

    const restoreInUse = replaceMethod(
      prisma.faculty,
      "findUnique",
      async () => ({ id: "fac-1", _count: { studyPrograms: 1 } })
    );
    try {
      const conflict = await DELETE(
        new NextRequest("http://localhost/api/admin/academic/faculties/fac-1", {
          method: "DELETE",
        }),
        makeRouteContext("fac-1")
      );
      assert.equal(conflict.status, 409);
    } finally {
      restoreInUse();
    }

    const restoreFindOk = replaceMethod(
      prisma.faculty,
      "findUnique",
      async () => ({ id: "fac-1", _count: { studyPrograms: 0 } })
    );
    const restoreDeleteOk = replaceMethod(
      prisma.faculty,
      "delete",
      async () => ({ id: "fac-1" })
    );
    try {
      const ok = await DELETE(
        new NextRequest("http://localhost/api/admin/academic/faculties/fac-1", {
          method: "DELETE",
        }),
        makeRouteContext("fac-1")
      );
      assert.equal(ok.status, 200);
      assert.deepEqual(await ok.json(), { success: true });
    } finally {
      restoreDeleteOk();
      restoreFindOk();
    }
  } finally {
    restoreSession();
  }
});
