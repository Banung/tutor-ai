import test from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

import {
  FREEZE_REASON_MAX_LENGTH_MESSAGE,
  FREEZE_REASON_REQUIRED_MESSAGE,
  userSecurityActionSchema,
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

async function loadSecurityDeps() {
  const [{ default: prisma }, userService] = await Promise.all([
    import("../src/lib/prisma"),
    import("../src/lib/services/user.service"),
  ]);
  return { prisma, userService };
}

async function withSession(user: Record<string, unknown> | null) {
  const { auth } = await import("../src/lib/auth");
  return replaceMethod(auth.api, "getSession", async () =>
    user ? { user, session: { id: "session-1" } } : null
  );
}

type ActorRow = {
  id: string;
  role: string;
  isActive: boolean;
  isFrozen: boolean;
};

type TargetRow = {
  id: string;
  role: string;
  name: string;
  isActive: boolean;
  isFrozen: boolean;
  frozenAt: Date | null;
  frozenReason: string | null;
};

const ACTIVE_ADMIN: ActorRow = {
  id: "admin-1",
  role: "admin",
  isActive: true,
  isFrozen: false,
};

const TARGET_USER: TargetRow = {
  id: "user-1",
  role: "mahasiswa",
  name: "Target Uji",
  isActive: true,
  isFrozen: false,
  frozenAt: null,
  frozenReason: null,
};

function securityTx(options: {
  actor?: ActorRow | null;
  target?: TargetRow | null;
  sessionCount?: number;
} = {}) {
  const actor = options.actor === undefined ? ACTIVE_ADMIN : options.actor;
  const target = options.target === undefined ? TARGET_USER : options.target;
  const locks: string[] = [];
  const updates: Array<Record<string, unknown>> = [];
  const deletes: Array<Record<string, unknown>> = [];
  const logs: Array<Record<string, unknown>> = [];

  const tx = {
    $queryRaw: async (_strings: unknown, ...values: unknown[]) => {
      locks.push(String(values[0]));
      return [{ id: String(values[0]) }];
    },
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === actor?.id ? actor : target,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        return { ...(target ?? {}), ...data };
      },
    },
    session: {
      deleteMany: async (args: { where: { userId: string } }) => {
        deletes.push(args);
        return { count: options.sessionCount ?? 0 };
      },
    },
    userSecurityLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        logs.push(data);
        return data;
      },
    },
  };

  return {
    tx,
    locks,
    updates,
    deletes,
    logs,
    actorId: actor?.id ?? "missing-actor",
    targetId: target?.id ?? "missing-target",
    target,
  };
}

function isUserServiceError(
  error: unknown,
  status: number,
  message: string
) {
  return (
    error instanceof Error &&
    error.name === "UserServiceError" &&
    (error as { status?: number }).status === status &&
    error.message === message
  );
}

test("freeze requires a non-blank reason of at most 200 characters", () => {
  const freeze = (reason: unknown) =>
    userSecurityActionSchema.safeParse({ action: "freeze", reason });

  for (const reason of [undefined, "", "   "]) {
    const result = freeze(reason);
    assert.equal(result.success, false);
    assert.equal(result.error?.issues[0]?.message, FREEZE_REASON_REQUIRED_MESSAGE);
  }

  const tooLong = freeze("a".repeat(201));
  assert.equal(tooLong.success, false);
  assert.equal(tooLong.error?.issues[0]?.message, FREEZE_REASON_MAX_LENGTH_MESSAGE);

  const atLimit = freeze("a".repeat(200));
  assert.equal(atLimit.success, true);
  assert.equal(atLimit.data?.reason?.length, 200);

  assert.equal(freeze("  Melanggar aturan  ").data?.reason, "Melanggar aturan");
});

test("unfreeze and force_logout accept omitted or blank reasons", () => {
  for (const action of ["unfreeze", "force_logout"] as const) {
    assert.equal(userSecurityActionSchema.parse({ action }).reason ?? null, null);
    assert.equal(userSecurityActionSchema.parse({ action, reason: "  " }).reason, null);
    assert.equal(
      userSecurityActionSchema.parse({ action, reason: "catatan" }).reason,
      "catatan"
    );
    assert.equal(
      userSecurityActionSchema.safeParse({ action, reason: "a".repeat(201) }).success,
      false
    );
  }
});

test("security actions reject unknown fields and invalid actions", () => {
  assert.equal(
    userSecurityActionSchema.safeParse({
      action: "freeze",
      reason: "x",
      actorId: "forged",
    }).success,
    false
  );
  assert.equal(
    userSecurityActionSchema.safeParse({
      action: "unfreeze",
      reason: null,
      userId: "forged",
    }).success,
    false
  );
  assert.equal(userSecurityActionSchema.safeParse({ action: "delete" }).success, false);
});

test("freeze locks ascending, records the reason, revokes sessions, and audits", async () => {
  const { prisma, userService } = await loadSecurityDeps();
  const fixture = securityTx({
    actor: { ...ACTIVE_ADMIN, id: "z-admin" },
    sessionCount: 3,
  });
  const restore = stubTransaction(prisma, fixture.tx);

  try {
    const result = await userService.executeUserSecurityAction(
      fixture.targetId,
      { action: "freeze", reason: "Melanggar aturan" },
      fixture.actorId
    );

    assert.deepEqual(fixture.locks, ["user-1", "z-admin"]);
    assert.equal(fixture.updates.length, 1);
    assert.equal(fixture.updates[0].isFrozen, true);
    assert.ok(fixture.updates[0].frozenAt instanceof Date);
    assert.equal(fixture.updates[0].frozenReason, "Melanggar aturan");
    assert.equal("isActive" in fixture.updates[0], false);
    assert.deepEqual(fixture.deletes, [{ where: { userId: "user-1" } }]);
    assert.equal(fixture.logs.length, 1);
    assert.equal(fixture.logs[0].userId, "user-1");
    assert.equal(fixture.logs[0].actorId, "z-admin");
    assert.equal(fixture.logs[0].action, "freeze");
    assert.equal(fixture.logs[0].reason, "Melanggar aturan");
    assert.equal(fixture.logs[0].revokedSessions, 3);
    assert.equal(result.action, "freeze");
    assert.equal(result.revokedSessions, 3);
    assert.equal(result.user.isFrozen, true);
  } finally {
    restore();
  }
});

test("unfreeze clears the freeze fields and never restores a deactivated account", async () => {
  const { prisma, userService } = await loadSecurityDeps();
  const fixture = securityTx({
    target: {
      ...TARGET_USER,
      isActive: false,
      isFrozen: true,
      frozenAt: new Date("2026-01-01T00:00:00Z"),
      frozenReason: "Lama",
    },
  });
  const restore = stubTransaction(prisma, fixture.tx);

  try {
    const result = await userService.executeUserSecurityAction(
      fixture.targetId,
      { action: "unfreeze", reason: "   " },
      fixture.actorId
    );

    assert.equal(fixture.updates.length, 1);
    assert.equal(fixture.updates[0].isFrozen, false);
    assert.equal(fixture.updates[0].frozenAt, null);
    assert.equal(fixture.updates[0].frozenReason, null);
    assert.equal("isActive" in fixture.updates[0], false);
    assert.equal(fixture.deletes.length, 0);
    assert.equal(fixture.logs.length, 1);
    assert.equal(fixture.logs[0].action, "unfreeze");
    assert.equal(fixture.logs[0].reason, null);
    assert.equal(fixture.logs[0].revokedSessions, 0);
    assert.equal(result.user.isActive, false);
  } finally {
    restore();
  }
});

test("force_logout revokes sessions and leaves the user record untouched", async () => {
  const { prisma, userService } = await loadSecurityDeps();
  const fixture = securityTx({ sessionCount: 2 });
  const restore = stubTransaction(prisma, fixture.tx);

  try {
    const result = await userService.executeUserSecurityAction(
      fixture.targetId,
      { action: "force_logout", reason: "Sesi mencurigakan" },
      fixture.actorId
    );

    assert.equal(fixture.updates.length, 0);
    assert.deepEqual(fixture.deletes, [{ where: { userId: "user-1" } }]);
    assert.equal(fixture.logs.length, 1);
    assert.equal(fixture.logs[0].action, "force_logout");
    assert.equal(fixture.logs[0].reason, "Sesi mencurigakan");
    assert.equal(fixture.logs[0].revokedSessions, 2);
    assert.equal(result.action, "force_logout");
    assert.equal(result.revokedSessions, 2);
    assert.equal(result.user, fixture.target);
    assert.equal(result.user.isActive, true);
    assert.equal(result.user.isFrozen, false);
  } finally {
    restore();
  }
});

test("ALT-1: a missing target returns 404 with no session or audit writes", async () => {
  const { prisma, userService } = await loadSecurityDeps();
  const fixture = securityTx({ target: null });
  const restore = stubTransaction(prisma, fixture.tx);

  try {
    await assert.rejects(
      () =>
        userService.executeUserSecurityAction(
          "missing-target",
          { action: "freeze", reason: "Pembekuan" },
          fixture.actorId
        ),
      (error: unknown) =>
        isUserServiceError(error, 404, "Akun target tidak ditemukan.")
    );
    assert.equal(fixture.deletes.length, 0);
    assert.equal(fixture.updates.length, 0);
    assert.equal(fixture.logs.length, 0);
  } finally {
    restore();
  }
});

test("an admin cannot freeze or force-logout their own account", async () => {
  const { prisma, userService } = await loadSecurityDeps();
  const self = { ...TARGET_USER, id: "admin-1", role: "admin" };

  for (const [action, message] of [
    ["freeze", "Tidak dapat membekukan akun sendiri."],
    ["force_logout", "Tidak dapat memutus sesi akun sendiri."],
  ] as const) {
    const fixture = securityTx({ actor: ACTIVE_ADMIN, target: self });
    const restore = stubTransaction(prisma, fixture.tx);

    try {
      await assert.rejects(
        () =>
          userService.executeUserSecurityAction(
            "admin-1",
            { action, reason: action === "freeze" ? "Pembekuan" : undefined },
            "admin-1"
          ),
        (error: unknown) => isUserServiceError(error, 403, message)
      );
      assert.equal(fixture.updates.length, 0);
      assert.equal(fixture.deletes.length, 0);
      assert.equal(fixture.logs.length, 0);
    } finally {
      restore();
    }
  }
});

test("a non-admin, inactive, or frozen actor is rejected inside the transaction", async () => {
  const { prisma, userService } = await loadSecurityDeps();

  for (const actor of [
    { ...ACTIVE_ADMIN, role: "dosen" },
    { ...ACTIVE_ADMIN, isActive: false },
    { ...ACTIVE_ADMIN, isFrozen: true },
  ]) {
    const fixture = securityTx({ actor });
    const restore = stubTransaction(prisma, fixture.tx);

    try {
      await assert.rejects(
        () =>
          userService.executeUserSecurityAction(
            fixture.targetId,
            { action: "freeze", reason: "Pembekuan" },
            fixture.actorId
          ),
        (error: unknown) =>
          isUserServiceError(error, 403, "Akses admin diperlukan.")
      );
      assert.equal(fixture.updates.length, 0);
      assert.equal(fixture.deletes.length, 0);
      assert.equal(fixture.logs.length, 0);
    } finally {
      restore();
    }
  }
});

test("BR-008: role guards reject frozen or inactive accounts", async () => {
  const {
    requireAdmin,
    requireDosen,
    requireMahasiswa,
  } = await import("../src/lib/api-utils");
  const { requireTutorUser } = await import("../src/lib/tutor-ai/route-helpers");
  const request = new NextRequest("http://localhost/api/probe");

  const guards = [
    { run: requireAdmin, role: "admin" },
    { run: requireDosen, role: "dosen" },
    { run: requireMahasiswa, role: "mahasiswa" },
  ];

  for (const blocked of [{ isFrozen: true }, { isActive: false }]) {
    for (const { run, role } of guards) {
      const restore = await withSession({ id: "user-1", role, ...blocked });
      try {
        const result = await run(request);
        assert.ok(result.error, `${role} guard must reject`);
        assert.equal(result.error.status, 403);
        const body = (await result.error.json()) as { error?: string };
        assert.equal(body.error, "Akun dibekukan atau tidak aktif.");
      } finally {
        restore();
      }
    }

    const restore = await withSession({
      id: "user-1",
      role: "mahasiswa",
      ...blocked,
    });
    try {
      const result = await requireTutorUser(request);
      assert.equal(result.userId, null);
      assert.equal(result.error?.status, 403);
    } finally {
      restore();
    }
  }

  const activeRestore = await withSession({
    id: "user-1",
    role: "admin",
    isActive: true,
    isFrozen: false,
  });
  try {
    const admin = await requireAdmin(request);
    assert.equal(admin.error, null);
    const tutor = await requireTutorUser(request);
    assert.equal(tutor.error, null);
    assert.equal(tutor.userId, "user-1");
  } finally {
    activeRestore();
  }
});

test("BR-008: proxy redirects blocked users to /login without looping", async () => {
  const { default: proxy } = await import("../src/proxy");

  for (const blocked of [{ isFrozen: true }, { isActive: false }]) {
    const restore = await withSession({
      id: "user-1",
      role: "admin",
      isActive: true,
      isFrozen: false,
      ...blocked,
    });
    try {
      for (const path of ["/admin", "/dosen", "/mahasiswa", "/dashboard"]) {
        const response = await proxy(new NextRequest(`http://localhost${path}`));
        assert.equal(response.status, 307);
        assert.equal(
          new URL(response.headers.get("location") ?? "", "http://localhost").pathname,
          "/login"
        );
      }

      const login = await proxy(new NextRequest("http://localhost/login"));
      assert.equal(login.headers.get("location"), null);
    } finally {
      restore();
    }
  }

  const activeRestore = await withSession({
    id: "user-1",
    role: "admin",
    isActive: true,
    isFrozen: false,
  });
  try {
    const response = await proxy(new NextRequest("http://localhost/admin"));
    assert.equal(response.headers.get("location"), null);
  } finally {
    activeRestore();
  }
});

test("security GET returns logs for admins and rejects anonymous or non-admin", async () => {
  const { prisma } = await loadSecurityDeps();
  const { GET } = await import("../src/app/api/admin/users/[id]/security/route");
  const context = { params: Promise.resolve({ id: "user-1" }) };
  const request = new NextRequest(
    "http://localhost/api/admin/users/user-1/security"
  );
  const logs = [{ id: "log-1", action: "freeze", revokedSessions: 2 }];
  const restoreFind = replaceMethod(prisma.userSecurityLog, "findMany", async () => logs);

  try {
    let restoreSession = await withSession(null);
    try {
      const response = await GET(request, context);
      assert.equal(response.status, 401);
    } finally {
      restoreSession();
    }

    restoreSession = await withSession({
      id: "user-2",
      role: "mahasiswa",
      isActive: true,
      isFrozen: false,
    });
    try {
      const response = await GET(request, context);
      assert.equal(response.status, 403);
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
      const response = await GET(request, context);
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()) as { logs: unknown[] }, { logs });
    } finally {
      restoreSession();
    }
  } finally {
    restoreFind();
  }
});

test("security POST validates the freeze reason, missing targets, and success", async () => {
  const { prisma } = await loadSecurityDeps();
  const { POST } = await import("../src/app/api/admin/users/[id]/security/route");
  const context = { params: Promise.resolve({ id: "user-1" }) };
  const restoreSession = await withSession({
    id: "admin-1",
    role: "admin",
    isActive: true,
    isFrozen: false,
  });

  try {
    const invalid = await POST(
      new NextRequest("http://localhost/api/admin/users/user-1/security", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "freeze" }),
      }),
      context
    );
    assert.equal(invalid.status, 400);
    const invalidBody = (await invalid.json()) as {
      error?: string;
      issues?: string[];
    };
    assert.equal(invalidBody.error, FREEZE_REASON_REQUIRED_MESSAGE);
    assert.ok(invalidBody.issues?.includes(FREEZE_REASON_REQUIRED_MESSAGE));

    const missing = securityTx({ target: null });
    let restore = stubTransaction(prisma, missing.tx);
    try {
      const response = await POST(
        new NextRequest("http://localhost/api/admin/users/missing/security", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "freeze", reason: "Pembekuan" }),
        }),
        { params: Promise.resolve({ id: "missing" }) }
      );
      assert.equal(response.status, 404);
      const body = (await response.json()) as { error?: string };
      assert.equal(body.error, "Akun target tidak ditemukan.");
    } finally {
      restore();
    }

    const success = securityTx({ sessionCount: 2 });
    restore = stubTransaction(prisma, success.tx);
    try {
      const response = await POST(
        new NextRequest("http://localhost/api/admin/users/user-1/security", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "freeze", reason: "Pembekuan" }),
        }),
        context
      );
      assert.equal(response.status, 200);
      const body = (await response.json()) as {
        user?: { isFrozen?: boolean };
        action?: string;
        revokedSessions?: number;
      };
      assert.equal(body.action, "freeze");
      assert.equal(body.revokedSessions, 2);
      assert.equal(body.user?.isFrozen, true);
    } finally {
      restore();
    }
  } finally {
    restoreSession();
  }
});
