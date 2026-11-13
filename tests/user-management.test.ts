import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

import {
  createUserSchema,
  updateUserSchema,
  validateUserProfile,
} from "../src/lib/schemas/user.schema";

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

const BASE_CREATE = {
  name: "Pengguna Uji",
  email: "uji@example.com",
  password: "rahasia123",
  role: "mahasiswa" as const,
  npm: "0012345678",
  academicLevel: "S1" as const,
};

test("identifier boundaries accept 8 and 18 digits and reject 7 or 19", () => {
  const parse = (npm: unknown) =>
    createUserSchema.safeParse({ ...BASE_CREATE, npm }).success;

  assert.equal(parse("1234567"), false);
  assert.equal(parse("12345678"), true);
  assert.equal(parse("123456789012345678"), true);
  assert.equal(parse("1234567890123456789"), false);
});

test("identifiers reject non-digits and trim surrounding whitespace", () => {
  assert.equal(createUserSchema.safeParse({ ...BASE_CREATE, npm: "1234abcd" }).success, false);
  assert.equal(createUserSchema.safeParse({ ...BASE_CREATE, npm: "1234 5678" }).success, false);
  assert.equal(createUserSchema.safeParse({ ...BASE_CREATE, npm: -12345678 }).success, false);

  const parsed = createUserSchema.parse({ ...BASE_CREATE, npm: "  0012345678  " });
  assert.equal(parsed.npm, "0012345678", "leading zeros survive as text");

  const dosen = createUserSchema.parse({
    name: "Dosen Uji",
    email: "dosen@example.com",
    password: "rahasia123",
    role: "dosen",
    nip: "  ",
    nidn: null,
  });
  assert.equal(dosen.nip, null);
  assert.equal(dosen.nidn, null);
});

test("role-specific create rules stay explicit", () => {
  assert.equal(
    createUserSchema.safeParse({ ...BASE_CREATE, npm: null }).success,
    false,
    "mahasiswa requires NPM"
  );
  assert.equal(
    createUserSchema.safeParse({ ...BASE_CREATE, academicLevel: null }).success,
    false,
    "mahasiswa requires academic level"
  );

  const dosen = {
    name: "Dosen Uji",
    email: "dosen@example.com",
    password: "rahasia123",
    role: "dosen",
    nip: "1987654321",
  };
  assert.equal(createUserSchema.safeParse(dosen).success, true);
  assert.equal(createUserSchema.safeParse({ ...dosen, nip: null, nidn: null }).success, true);
  assert.equal(
    createUserSchema.safeParse({ ...dosen, npm: "12345678" }).success,
    false,
    "dosen cannot hold NPM"
  );
  assert.equal(
    createUserSchema.safeParse({ ...dosen, nidn: "123" }).success,
    false,
    "NIDN still needs 8-18 digits"
  );

  const admin = {
    name: "Admin Uji",
    email: "admin2@example.com",
    password: "rahasia123",
    role: "admin",
  };
  assert.equal(createUserSchema.safeParse(admin).success, true);
  assert.equal(
    createUserSchema.safeParse({ ...admin, nip: "1987654321" }).success,
    false,
    "admin cannot hold NIP"
  );
});

test("invalid roles, untrusted actor fields, and malformed identifiers are rejected", () => {
  assert.equal(
    createUserSchema.safeParse({ ...BASE_CREATE, role: "superadmin" }).success,
    false
  );
  assert.equal(
    createUserSchema.safeParse({ ...BASE_CREATE, actorId: "forged" }).success,
    false
  );
  assert.equal(
    updateUserSchema.safeParse({ role: "dosen", actorId: "forged" }).success,
    false
  );
  assert.equal(updateUserSchema.safeParse({ role: "root" }).success, false);
  assert.equal(updateUserSchema.safeParse({ nip: "1234567890123456789" }).success, false);
  assert.equal(updateUserSchema.safeParse({ nidn: "" }).success, true);
});

test("merged profile validation is role-aware", () => {
  assert.deepEqual(
    validateUserProfile({
      role: "mahasiswa",
      npm: "0012345678",
      academicLevel: "S1",
      nip: null,
      nidn: null,
    }),
    []
  );
  assert.ok(
    validateUserProfile({
      role: "mahasiswa",
      npm: "0012345678",
      academicLevel: "S1",
      nip: "1987654321",
      nidn: null,
    }).includes("NIP/NIDN hanya untuk dosen.")
  );
  assert.deepEqual(
    validateUserProfile({
      role: "dosen",
      npm: null,
      academicLevel: null,
      nip: "1987654321",
      nidn: null,
    }),
    []
  );
  assert.deepEqual(
    validateUserProfile({
      role: "dosen",
      npm: null,
      academicLevel: null,
      nip: null,
      nidn: null,
    }),
    [],
    "legacy lecturers may have no staff identifier"
  );
  assert.ok(
    validateUserProfile({
      role: "admin",
      npm: null,
      academicLevel: null,
      nip: "1987654321",
      nidn: null,
    }).includes("Admin tidak boleh memiliki NIP/NIDN.")
  );
});

type Target = {
  id: string;
  role: string;
  npm: string | null;
  academicLevel: string | null;
  nip: string | null;
  nidn: string | null;
  name: string;
  email: string;
  major: string | null;
  faculty: string | null;
  bio: string | null;
};

const TARGET: Target = {
  id: "user-1",
  role: "mahasiswa",
  npm: "0012345678",
  academicLevel: "S1",
  nip: null,
  nidn: null,
  name: "Nama Lama",
  email: "lama@example.com",
  major: null,
  faculty: null,
  bio: null,
};

function userTx(options: {
  actorRole?: string;
  target?: Target | null;
  assignments?: number;
  duplicate?: { id: string } | null;
  auditError?: Error;
  onUpdate?: (data: Record<string, unknown>) => void;
} = {}) {
  const actor = { id: "admin-1", role: options.actorRole ?? "admin" };
  const target = options.target === undefined ? TARGET : options.target;
  const audits: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];

  const tx = {
    $queryRaw: async () => [{ id: "locked" }],
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === actor.id ? actor : target,
      findFirst: async () => options.duplicate ?? null,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        options.onUpdate?.(data);
        return { ...(target ?? {}), ...data };
      },
    },
    courseInstructor: { count: async () => options.assignments ?? 0 },
    userRoleAudit: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (options.auditError) throw options.auditError;
        audits.push(data);
        return data;
      },
    },
  };

  return {
    tx,
    audits,
    updates,
    actorId: actor.id,
    targetId: target?.id ?? "missing",
  };
}

async function loadUserService() {
  const [{ default: prisma }, userService] = await Promise.all([
    import("../src/lib/prisma"),
    import("../src/lib/services/user.service"),
  ]);
  return { prisma, userService };
}

test("role change updates the role and writes exactly one audit transition", async () => {
  const { prisma, userService } = await loadUserService();
  const fixture = userTx();
  const restore = stubTransaction(prisma, fixture.tx);

  try {
    await userService.updateUser(
      fixture.targetId,
      { role: "dosen", nip: "1987654321" },
      fixture.actorId
    );

    assert.equal(fixture.audits.length, 1);
    assert.deepEqual(fixture.audits[0], {
      id: fixture.audits[0].id,
      userId: "user-1",
      actorId: "admin-1",
      fromRole: "mahasiswa",
      toRole: "dosen",
    });
    assert.equal(fixture.updates[0].role, "dosen");
    assert.equal(fixture.updates[0].nip, "1987654321");
    assert.equal(fixture.updates[0].npm, null, "role change clears incompatible NPM");
  } finally {
    restore();
  }
});

test("same-role profile save writes no audit transition", async () => {
  const { prisma, userService } = await loadUserService();
  const fixture = userTx();
  const restore = stubTransaction(prisma, fixture.tx);

  try {
    await userService.updateUser(
      fixture.targetId,
      { name: "Nama Baru" },
      fixture.actorId
    );

    assert.equal(fixture.audits.length, 0);
    assert.equal(fixture.updates.length, 1);
    assert.equal("role" in fixture.updates[0], false);
    assert.equal(fixture.updates[0].name, "Nama Baru");
    assert.equal(fixture.updates[0].npm, "0012345678");
  } finally {
    restore();
  }
});

test("self role change is rejected, own unchanged-role edit is allowed", async () => {
  const { prisma, userService } = await loadUserService();
  const selfTarget: Target = { ...TARGET, id: "admin-1", role: "admin", npm: null, academicLevel: null };

  const blocked = userTx({ target: selfTarget });
  let restore = stubTransaction(prisma, blocked.tx);
  try {
    await assert.rejects(
      () => userService.updateUser("admin-1", { role: "dosen" }, "admin-1"),
      (error: unknown) =>
        error instanceof userService.UserServiceError && error.status === 403
    );
    assert.equal(blocked.updates.length, 0);
    assert.equal(blocked.audits.length, 0);
  } finally {
    restore();
  }

  const allowed = userTx({ target: selfTarget });
  restore = stubTransaction(prisma, allowed.tx);
  try {
    await userService.updateUser("admin-1", { name: "Admin Baru" }, "admin-1");
    assert.equal(allowed.updates.length, 1);
    assert.equal(allowed.audits.length, 0);
  } finally {
    restore();
  }
});

test("actor authority is rechecked inside the transaction", async () => {
  const { prisma, userService } = await loadUserService();
  const fixture = userTx({ actorRole: "mahasiswa" });
  const restore = stubTransaction(prisma, fixture.tx);

  try {
    await assert.rejects(
      () => userService.updateUser("user-1", { name: "X" }, "admin-1"),
      (error: unknown) =>
        error instanceof userService.UserServiceError && error.status === 403
    );
    assert.equal(fixture.updates.length, 0);
  } finally {
    restore();
  }
});

test("assigned lecturer demotion is rejected without deleting history", async () => {
  const { prisma, userService } = await loadUserService();
  const dosen: Target = {
    ...TARGET,
    role: "dosen",
    npm: null,
    academicLevel: null,
    nip: "1987654321",
  };
  const fixture = userTx({ target: dosen, assignments: 2 });
  const restore = stubTransaction(prisma, fixture.tx);

  try {
    await assert.rejects(
      () => userService.updateUser("user-1", { role: "mahasiswa" }, "admin-1"),
      (error: unknown) =>
        error instanceof userService.UserServiceError &&
        error.status === 409 &&
        /pengampu/.test(error.message)
    );
    assert.equal(fixture.updates.length, 0);
    assert.equal(fixture.audits.length, 0);
  } finally {
    restore();
  }
});

test("audit insertion failure prevents a successful role change", async () => {
  const { prisma, userService } = await loadUserService();
  const fixture = userTx({ auditError: new Error("AUDIT_WRITE_FAILED") });
  const restore = stubTransaction(prisma, fixture.tx);

  try {
    await assert.rejects(
      () =>
        userService.updateUser("user-1", { role: "dosen", nip: "1987654321" }, "admin-1"),
      (error: unknown) => error instanceof Error && error.message === "AUDIT_WRITE_FAILED"
    );
  } finally {
    restore();
  }
});

test("duplicate identifiers and email conflicts return controlled 409s", async () => {
  const { prisma, userService } = await loadUserService();

  const duplicate = userTx({ duplicate: { id: "other" } });
  let restore = stubTransaction(prisma, duplicate.tx);
  try {
    await assert.rejects(
      () =>
        userService.updateUser(
          "user-1",
          { role: "dosen", nip: "1987654321" },
          "admin-1"
        ),
      (error: unknown) =>
        error instanceof userService.UserServiceError &&
        error.status === 409 &&
        error.message === "NIP sudah digunakan."
    );
    assert.equal(duplicate.updates.length, 0);
  } finally {
    restore();
  }

  const uniqueViolation = userTx({
    onUpdate: () => {
      throw Object.assign(new Error("unique"), {
        code: "P2002",
        meta: { target: ["email"] },
      });
    },
  });
  restore = stubTransaction(prisma, uniqueViolation.tx);
  try {
    await assert.rejects(
      () => userService.updateUser("user-1", { email: "baru@example.com" }, "admin-1"),
      (error: unknown) =>
        error instanceof userService.UserServiceError &&
        error.status === 409 &&
        error.message === "Email sudah digunakan."
    );
  } finally {
    restore();
  }
});

test("self-account deletion is rejected", async () => {
  const { userService } = await loadUserService();
  await assert.rejects(
    () => userService.deleteUser("admin-1", "admin-1"),
    (error: unknown) =>
      error instanceof userService.UserServiceError && error.status === 403
  );
});

async function withAdminSession(role = "admin") {
  const { auth } = await import("../src/lib/auth");
  return replaceMethod(auth.api, "getSession", async () => ({
    user: { id: "admin-1", role },
    session: { id: "session-1" },
  }));
}

test("malformed JSON and forged actor fields are controlled 400s", async () => {
  const restoreSession = await withAdminSession();
  const { POST } = await import("../src/app/api/admin/users/route");
  const { PATCH } = await import("../src/app/api/admin/users/[id]/route");

  try {
    const malformed = new NextRequest("http://localhost/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{",
    });
    const malformedResponse = await POST(malformed as never);
    assert.equal(malformedResponse.status, 400);

    const forged = new NextRequest("http://localhost/api/admin/users/user-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: "admin", actorId: "forged" }),
    });
    const forgedResponse = await PATCH(forged as never, {
      params: Promise.resolve({ id: "user-1" }),
    });
    assert.equal(forgedResponse.status, 400);
  } finally {
    restoreSession();
  }
});

test("unexpected service exceptions return a generic 500", async () => {
  const { prisma } = await loadUserService();
  const restoreSession = await withAdminSession();
  const restoreTransaction = replaceMethod(prisma, "$transaction", async () => {
    throw new Error("duplicate key value violates constraint secret_table");
  });
  const { PATCH } = await import("../src/app/api/admin/users/[id]/route");

  try {
    const request = new NextRequest("http://localhost/api/admin/users/user-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Nama Baru" }),
    });
    const response = await PATCH(request as never, {
      params: Promise.resolve({ id: "user-1" }),
    });
    assert.equal(response.status, 500);
    const body = (await response.json()) as { error?: string };
    assert.equal(body.error, "Terjadi kesalahan pada server");
    assert.equal(JSON.stringify(body).includes("secret_table"), false);
  } finally {
    restoreTransaction();
    restoreSession();
  }
});

test("non-admin mutation is rejected before touching the service", async () => {
  const restoreSession = await withAdminSession("mahasiswa");
  const { DELETE } = await import("../src/app/api/admin/users/[id]/route");

  try {
    const request = new NextRequest("http://localhost/api/admin/users/user-1", {
      method: "DELETE",
    });
    const response = await DELETE(request as never, {
      params: Promise.resolve({ id: "user-1" }),
    });
    assert.equal(response.status, 403);
  } finally {
    restoreSession();
  }
});

test("assignInstructor locks the user row before checking the role", async () => {
  const { default: prisma } = await import("../src/lib/prisma");
  const courseService = await import("../src/lib/services/course.service");
  const calls: string[] = [];
  let created = false;
  const tx = {
    $queryRaw: async () => {
      calls.push("lock-user");
      return [{ id: "user-1" }];
    },
    user: {
      findUnique: async () => {
        calls.push("read-user");
        return { id: "user-1", role: "mahasiswa" };
      },
    },
    course: { findUnique: async () => ({ id: "course-1" }) },
    courseInstructor: {
      findFirst: async () => null,
      create: async () => {
        created = true;
        return { id: "assignment-1" };
      },
    },
  };
  const restore = stubTransaction(prisma, tx);

  try {
    await assert.rejects(
      () => courseService.assignInstructor("course-1", "user-1"),
      (error: unknown) =>
        error instanceof courseService.CourseServiceError && error.status === 400
    );
    assert.deepEqual(calls, ["lock-user", "read-user"]);
    assert.equal(created, false, "no assignment may be created for a non-dosen user");
  } finally {
    restore();
  }
});
