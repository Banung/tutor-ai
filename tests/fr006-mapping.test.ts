import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

import { assignInstructorSchema } from "../src/lib/schemas/course.schema";

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

function stubTransaction(prisma: object, tx: unknown) {
  return replaceMethod(prisma, "$transaction", async (callback: unknown) =>
    (callback as (client: unknown) => Promise<unknown>)(tx)
  );
}

async function loadServices() {
  const [{ default: prisma }, courseService, userService] = await Promise.all([
    import("../src/lib/prisma"),
    import("../src/lib/services/course.service"),
    import("../src/lib/services/user.service"),
  ]);
  return { prisma, courseService, userService };
}

type UserRow = {
  id: string;
  role: string;
  isActive: boolean;
  nip: string | null;
  nidn: string | null;
};

function assignmentTx(options: {
  user: UserRow;
  inactiveReference?: { id: string } | null;
  published?: boolean;
  instructorCount?: number;
  existing?: boolean;
}) {
  const logs: Array<Record<string, unknown>> = [];
  const created: Array<Record<string, unknown>> = [];
  let deletes = 0;
  const tx = {
    $queryRaw: async () => [{ id: "locked" }],
    user: { findUnique: async () => options.user },
    lecturerReference: {
      findFirst: async (args: { where: { isActive: boolean } }) =>
        args.where.isActive === false ? (options.inactiveReference ?? null) : null,
    },
    course: {
      findUnique: async () => ({
        id: "course-1",
        catalogStatus: options.published ? "PUBLISHED" : "DRAFT",
        _count: { instructors: options.instructorCount ?? 2 },
      }),
    },
    courseInstructor: {
      findFirst: async () => (options.existing ? { id: "assignment-1" } : null),
      create: async (args: { data: Record<string, unknown> }) => {
        created.push(args.data);
        return { id: args.data.id, courseId: "course-1", userId: options.user.id };
      },
      delete: async () => {
        deletes += 1;
        return {};
      },
    },
    courseInstructorMappingLog: {
      create: async (args: { data: Record<string, unknown> }) => {
        logs.push(args.data);
        return args.data;
      },
    },
  };
  return { tx, logs, created, stats: () => ({ deletes }) };
}

const ACTIVE_DOSEN: UserRow = {
  id: "dosen-1",
  role: "dosen",
  isActive: true,
  nip: "1987654321",
  nidn: "0012345678",
};

test("assignInstructorSchema rejects forged fields such as actorId", () => {
  assert.equal(assignInstructorSchema.safeParse({ userId: "dosen-1" }).success, true);
  assert.equal(assignInstructorSchema.safeParse({}).success, false);
  assert.equal(assignInstructorSchema.safeParse({ userId: "" }).success, false);
  assert.equal(
    assignInstructorSchema.safeParse({ userId: "dosen-1", actorId: "forged" }).success,
    false
  );
  assert.equal(
    assignInstructorSchema.safeParse({ userId: "dosen-1", courseId: "forged" }).success,
    false
  );
});

test("assignInstructor assigns an active dosen and logs ASSIGNED with the actor", async () => {
  const { prisma, courseService } = await loadServices();
  const fixture = assignmentTx({ user: ACTIVE_DOSEN, inactiveReference: null });
  const restore = stubTransaction(prisma, fixture.tx);

  try {
    const assignment = await courseService.assignInstructor(
      "course-1",
      "dosen-1",
      "admin-1"
    );
    assert.equal(fixture.created.length, 1);
    assert.equal(assignment.userId, "dosen-1");
    assert.equal(fixture.logs.length, 1);
    assert.equal(fixture.logs[0].courseId, "course-1");
    assert.equal(fixture.logs[0].userId, "dosen-1");
    assert.equal(fixture.logs[0].actorId, "admin-1");
    assert.equal(fixture.logs[0].action, "ASSIGNED");
  } finally {
    restore();
  }
});

test("assignInstructor rejects an inactive user without any write", async () => {
  const { prisma, courseService } = await loadServices();
  const fixture = assignmentTx({
    user: { ...ACTIVE_DOSEN, isActive: false },
    inactiveReference: null,
  });
  const restore = stubTransaction(prisma, fixture.tx);

  try {
    await assert.rejects(
      () => courseService.assignInstructor("course-1", "dosen-1", "admin-1"),
      (error: unknown) =>
        error instanceof courseService.CourseServiceError &&
        error.status === 400 &&
        error.message === "Dosen tidak aktif tidak dapat dipetakan."
    );
    assert.equal(fixture.created.length, 0);
    assert.equal(fixture.logs.length, 0);
  } finally {
    restore();
  }
});

test("assignInstructor rejects an active user whose lecturer reference is inactive", async () => {
  const { prisma, courseService } = await loadServices();
  for (const inactiveReference of [{ id: "ref-by-nip" }, { id: "ref-by-nidn" }]) {
    const fixture = assignmentTx({ user: ACTIVE_DOSEN, inactiveReference });
    const restore = stubTransaction(prisma, fixture.tx);

    try {
      await assert.rejects(
        () => courseService.assignInstructor("course-1", "dosen-1", "admin-1"),
        (error: unknown) =>
          error instanceof courseService.CourseServiceError &&
          error.status === 400 &&
          error.message === "Dosen tidak aktif tidak dapat dipetakan."
      );
      assert.equal(fixture.created.length, 0);
      assert.equal(fixture.logs.length, 0);
    } finally {
      restore();
    }
  }
});

test("removeInstructor deletes the assignment and logs REMOVED with the actor", async () => {
  const { prisma, courseService } = await loadServices();
  const fixture = assignmentTx({
    user: ACTIVE_DOSEN,
    published: true,
    instructorCount: 2,
    existing: true,
  });
  const restore = stubTransaction(prisma, fixture.tx);

  try {
    const result = await courseService.removeInstructor("course-1", "dosen-1", "admin-1");
    assert.deepEqual(result, { success: true });
    assert.equal(fixture.stats().deletes, 1);
    assert.equal(fixture.logs.length, 1);
    assert.equal(fixture.logs[0].courseId, "course-1");
    assert.equal(fixture.logs[0].userId, "dosen-1");
    assert.equal(fixture.logs[0].actorId, "admin-1");
    assert.equal(fixture.logs[0].action, "REMOVED");
  } finally {
    restore();
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

test("instructor POST and DELETE forward the session actor to the audit log", async () => {
  const { prisma } = await loadServices();

  const assigned = assignmentTx({ user: ACTIVE_DOSEN, inactiveReference: null });
  let restore = stubTransaction(prisma, assigned.tx);
  try {
    await withAdminSession(async () => {
      const { POST } = await import(
        "../src/app/api/admin/courses/[id]/instructors/route"
      );
      const request = new NextRequest(
        "http://localhost/api/admin/courses/course-1/instructors",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId: "dosen-1" }),
        }
      );
      const response = await POST(request as never, {
        params: Promise.resolve({ id: "course-1" }),
      });
      assert.equal(response.status, 201);
      assert.equal(assigned.logs.length, 1);
      assert.equal(assigned.logs[0].actorId, "admin-1");
    });
  } finally {
    restore();
  }

  const removed = assignmentTx({
    user: ACTIVE_DOSEN,
    published: true,
    instructorCount: 2,
    existing: true,
  });
  restore = stubTransaction(prisma, removed.tx);
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
      assert.equal(response.status, 200);
      assert.equal(removed.logs.length, 1);
      assert.equal(removed.logs[0].actorId, "admin-1");
      assert.equal(removed.logs[0].action, "REMOVED");
    });
  } finally {
    restore();
  }
});

test("updateUser rejects self-deactivation with 403 and writes nothing", async () => {
  const { prisma, userService } = await loadServices();
  const updates: Array<Record<string, unknown>> = [];
  const tx = {
    $queryRaw: async () => [{ id: "locked" }],
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        role: "admin",
        npm: null,
        academicLevel: null,
        nip: null,
        nidn: null,
        isActive: true,
      }),
      findFirst: async () => null,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return data;
      },
    },
    courseInstructor: { count: async () => 0 },
    userRoleAudit: { create: async () => ({}) },
  };
  const restore = stubTransaction(prisma, tx);

  try {
    await assert.rejects(
      () => userService.updateUser("admin-1", { isActive: false }, "admin-1"),
      (error: unknown) =>
        error instanceof userService.UserServiceError &&
        error.status === 403 &&
        error.message === "Tidak dapat menonaktifkan akun sendiri."
    );
    assert.equal(updates.length, 0);
  } finally {
    restore();
  }
});
