import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

import {
  createUserSchema,
  updateUserSchema,
  validateUserProfile,
} from "../src/lib/schemas/user.schema";
import { parsePartialProvisioning } from "../src/lib/user-provisioning";
import {
  cleanupFailureMessage,
  settle,
  validateWaiters,
  withTimeout,
} from "./integration/fr003-validation";

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

test("merged PATCH validation rejects an invalid resulting profile", async () => {
  const { prisma, userService } = await loadUserService();
  const dosen: Target = {
    ...TARGET,
    role: "dosen",
    npm: null,
    academicLevel: null,
    nip: "1987654321",
  };

  const staffWithNpm = userTx({ target: dosen });
  let restore = stubTransaction(prisma, staffWithNpm.tx);
  try {
    await assert.rejects(
      () => userService.updateUser("user-1", { npm: "0012345678" }, "admin-1"),
      (error: unknown) =>
        error instanceof userService.UserServiceError && error.status === 400
    );
    assert.equal(staffWithNpm.updates.length, 0);
  } finally {
    restore();
  }

  const studentWithoutLevel = userTx();
  restore = stubTransaction(prisma, studentWithoutLevel.tx);
  try {
    await assert.rejects(
      () => userService.updateUser("user-1", { academicLevel: null }, "admin-1"),
      (error: unknown) =>
        error instanceof userService.UserServiceError && error.status === 400
    );
    assert.equal(studentWithoutLevel.updates.length, 0);
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

function creationTx(options: {
  actor?: { id: string; role: string } | null;
  updateError?: Error;
  auditError?: Error;
} = {}) {
  const actor =
    options.actor === undefined ? { id: "admin-1", role: "admin" } : options.actor;
  let state: Record<string, unknown> = { id: "created-1", role: "mahasiswa" };
  const audits: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];

  const tx = {
    $queryRaw: async () => [{ id: "locked" }],
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === actor?.id ? actor : state,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        if (options.updateError) throw options.updateError;
        state = { ...state, ...data };
        return state;
      },
    },
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
    state: () => state,
    setState: (next: Record<string, unknown>) => {
      state = next;
    },
  };
}

async function creationStubs(
  options: {
    emailConflict?: boolean;
    identifierConflict?: boolean;
    tx?: Parameters<typeof creationTx>[0];
  } = {}
) {
  const { default: prisma } = await import("../src/lib/prisma");
  const { auth } = await import("../src/lib/auth");
  const fixture = creationTx(options.tx);
  const signupCalls: string[] = [];
  const restores: Array<() => void> = [];

  restores.push(
    replaceMethod(prisma.user, "findUnique", async () =>
      options.emailConflict ? { id: "existing" } : null
    )
  );
  restores.push(
    replaceMethod(prisma.user, "findFirst", async () =>
      options.identifierConflict ? { id: "existing" } : null
    )
  );
  restores.push(
    replaceMethod(auth.api, "signUpEmail", async () => {
      signupCalls.push("created-1");
      return { user: { id: "created-1" } };
    })
  );
  const before = fixture.state();
  restores.push(
    replaceMethod(prisma, "$transaction", async (callback: unknown) => {
      try {
        return await (callback as (client: unknown) => Promise<unknown>)(
          fixture.tx
        );
      } catch (error) {
        // Simulate the real transaction rollback that DB-free stubs lack.
        fixture.setState(before);
        throw error;
      }
    })
  );

  return {
    fixture,
    signupCalls,
    restore: () => restores.reverse().forEach((restore) => restore()),
  };
}

const CREATE_DOSEN = {
  name: "Dosen Baru",
  email: "dosen.baru@example.com",
  password: "rahasia123",
  role: "dosen" as const,
  nip: "55667788",
};

test("creation finalization rejects a demoted or deleted actor before elevating", async () => {
  const { userService } = await loadUserService();

  for (const actor of [
    { id: "admin-1", role: "mahasiswa" },
    null,
  ]) {
    const stubs = await creationStubs({ tx: { actor } });
    try {
      await assert.rejects(
        () => userService.createUser(CREATE_DOSEN, "admin-1"),
        (error: unknown) =>
          error instanceof userService.UserServiceError &&
          error.status === 403 &&
          !(error instanceof userService.UserProvisioningError)
      );
      assert.equal(stubs.signupCalls.length, 1, "the account still exists");
      assert.equal(stubs.fixture.updates.length, 0, "no role/profile update");
      assert.equal(stubs.fixture.audits.length, 0, "no audit row");
      assert.equal(stubs.fixture.state().role, "mahasiswa");
    } finally {
      stubs.restore();
    }
  }
});

test("elevated creation commits one correct audit transition", async () => {
  const { userService } = await loadUserService();
  const stubs = await creationStubs();
  try {
    await userService.createUser(CREATE_DOSEN, "admin-1");
    assert.equal(stubs.fixture.audits.length, 1);
    assert.deepEqual(stubs.fixture.audits[0], {
      id: stubs.fixture.audits[0].id,
      userId: "created-1",
      actorId: "admin-1",
      fromRole: "mahasiswa",
      toRole: "dosen",
    });
    assert.equal(stubs.fixture.updates[0].role, "dosen");
    assert.equal(stubs.fixture.updates[0].nip, "55667788");
  } finally {
    stubs.restore();
  }
});

test("known identifier and email conflicts fail before signup", async () => {
  const { userService } = await loadUserService();

  for (const [conflict, message] of [
    [{ identifierConflict: true }, "NIP sudah digunakan."],
    [{ emailConflict: true }, "Email sudah digunakan."],
  ] as const) {
    const stubs = await creationStubs(conflict);
    try {
      await assert.rejects(
        () => userService.createUser(CREATE_DOSEN, "admin-1"),
        (error: unknown) =>
          error instanceof userService.UserServiceError &&
          error.status === 409 &&
          !(error instanceof userService.UserProvisioningError) &&
          error.message === message
      );
      assert.equal(stubs.signupCalls.length, 0, "no account may be created");
    } finally {
      stubs.restore();
    }
  }
});

test("a raced identifier conflict reports explicit partial provisioning", async () => {
  const { userService } = await loadUserService();
  const stubs = await creationStubs({
    tx: {
      updateError: Object.assign(new Error("unique"), {
        code: "P2002",
        meta: { target: ["nip"] },
      }),
    },
  });
  try {
    await assert.rejects(
      () => userService.createUser(CREATE_DOSEN, "admin-1"),
      (error: unknown) =>
        error instanceof userService.UserProvisioningError &&
        error.status === 409 &&
        error.userId === "created-1" &&
        error.accountState === "default_mahasiswa" &&
        error.issues?.[0] === "NIP sudah digunakan." &&
        /NIP sudah digunakan\./.test(error.message)
    );
    assert.equal(stubs.signupCalls.length, 1);
    assert.equal(stubs.fixture.state().role, "mahasiswa");
    assert.equal(stubs.fixture.audits.length, 0);
  } finally {
    stubs.restore();
  }
});

test("audit failure leaves no elevated role on creation", async () => {
  const { userService } = await loadUserService();
  const stubs = await creationStubs({
    tx: { auditError: new Error("AUDIT_WRITE_FAILED") },
  });
  try {
    await assert.rejects(
      () => userService.createUser(CREATE_DOSEN, "admin-1"),
      (error: unknown) =>
        error instanceof userService.UserProvisioningError &&
        error.status === 500 &&
        error.userId === "created-1" &&
        error.accountState === "default_mahasiswa"
    );
    assert.equal(stubs.fixture.state().role, "mahasiswa", "role rolled back");
    assert.equal(stubs.fixture.audits.length, 0);
  } finally {
    stubs.restore();
  }
});

test("create route emits machine-readable partial provisioning", async () => {
  const stubs = await creationStubs({
    tx: {
      updateError: Object.assign(new Error("unique"), {
        code: "P2002",
        meta: { target: ["nip"] },
      }),
    },
  });
  const restoreSession = await withAdminSession();
  const { POST } = await import("../src/app/api/admin/users/route");

  try {
    const request = new NextRequest("http://localhost/api/admin/users", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(CREATE_DOSEN),
    });
    const response = await POST(request as never);
    assert.equal(response.status, 409);
    const body = (await response.json()) as {
      partial?: boolean;
      userId?: string;
      accountState?: string;
      issues?: string[];
    };
    assert.equal(body.partial, true);
    assert.equal(body.userId, "created-1");
    assert.equal(body.accountState, "default_mahasiswa");
    assert.deepEqual(body.issues, ["NIP sudah digunakan."]);
  } finally {
    restoreSession();
    stubs.restore();
  }
});

test("partial provisioning is recognized and targets the saved user", () => {
  const partial = parsePartialProvisioning({
    partial: true,
    userId: "saved-user",
    accountState: "default_mahasiswa",
    error: "Akun dibuat tetapi finalisasi gagal: NIP sudah digunakan.",
    issues: ["NIP sudah digunakan."],
  });
  assert.equal(partial?.userId, "saved-user");
  assert.equal(partial?.accountState, "default_mahasiswa");
  assert.deepEqual(partial?.issues, ["NIP sudah digunakan."]);

  assert.equal(parsePartialProvisioning({ error: "Email sudah digunakan." }), null);
  assert.equal(parsePartialProvisioning({ partial: true }), null);
  assert.equal(parsePartialProvisioning("partial"), null);
});

test("harness validators reject missing waiters, timeouts, and cleanup failures", async () => {
  assert.doesNotThrow(() => validateWaiters([11], [11, 12]));
  assert.throws(() => validateWaiters([11], [11]), /exactly two/);
  assert.throws(() => validateWaiters([11], [12, 13]), /not retained/);
  assert.throws(() => validateWaiters([11], [11, 11]), /duplicate/);
  assert.throws(() => validateWaiters([11, 12], [11, 12, 13]), /exactly one first/);

  const settled = await settle(Promise.reject(new Error("rejected-early")));
  assert.equal(settled.status, "rejected");

  await assert.rejects(
    () => withTimeout(new Promise(() => undefined), 20, "harness probe"),
    /harness probe timed out/
  );
  assert.equal(await withTimeout(Promise.resolve("ok"), 100, "fast"), "ok");

  assert.equal(
    cleanupFailureMessage({
      remainingFixtures: 0,
      error: null,
      baselineUsers: 5,
      usersAfterCleanup: 5,
    }),
    null
  );
  assert.match(
    cleanupFailureMessage({
      remainingFixtures: 1,
      error: null,
      baselineUsers: 5,
      usersAfterCleanup: 6,
    }) ?? "",
    /cleanup failed/
  );
  assert.match(
    cleanupFailureMessage({
      remainingFixtures: 0,
      error: "delete failed",
      baselineUsers: 5,
      usersAfterCleanup: 5,
    }) ?? "",
    /cleanup failed/
  );
  assert.match(
    cleanupFailureMessage({
      remainingFixtures: 0,
      error: null,
      baselineUsers: 5,
      usersAfterCleanup: 4,
    }) ?? "",
    /existing user count changed/
  );
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
