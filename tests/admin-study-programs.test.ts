import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

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
