import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/synthetic_no_database";

async function harness(t: TestContext, options: { role?: string; owned?: boolean; run?: boolean } = {}) {
  const { default: prisma } = await import("../src/lib/prisma");
  const { saveTutorFeedback, readTutorFeedback } = await import("../src/lib/tutor-ai/feedback");
  function replace(target: object, key: string, value: unknown) {
    const record = target as Record<string, unknown>;
    const original = record[key];
    record[key] = value;
    t.after(() => { record[key] = original; });
  }
  const records = new Map<string, Record<string, unknown>>();
  replace(prisma.user, "findUnique", async () => ({ role: options.role ?? "mahasiswa" }));
  replace(prisma.aiChatMessage, "findFirst", async (args: { where: { senderType: string; aiChatSession: { userId: string; courseId: string } } }) => {
    assert.equal(args.where.senderType, "ai");
    assert.equal(args.where.aiChatSession.userId, "student");
    assert.equal(args.where.aiChatSession.courseId, "course");
    return options.owned === false ? null : { id: "answer" };
  });
  replace(prisma.aiResponseRun, "findFirst", async () => options.run === false ? null : { id: "run" });
  replace(prisma.aiMessageFeedback, "upsert", async ({ where, create, update }: { where: unknown; create: Record<string, unknown>; update: Record<string, unknown> }) => {
    const key = JSON.stringify(where);
    const row = { ...(records.get(key) ?? create), ...update, updatedAt: new Date() };
    records.set(key, row);
    return row;
  });
  replace(prisma.aiMessageFeedback, "findUnique", async ({ where }: { where: unknown }) => records.get(JSON.stringify(where)) ?? null);
  const scope = { userId: "student", courseId: "course", sessionId: "chat", messageId: "answer" };
  return {
    records,
    save: (payload: unknown) => saveTutorFeedback(scope, payload),
    read: () => readTutorFeedback(scope),
  };
}

test("feedback upserts one record, links its run and can be read again", async (t) => {
  const h = await harness(t);
  await h.save({ value: "negative", reason: "incorrect", note: "Perhitungan kurang tepat" });
  await h.save({ value: "positive", reason: null, note: "Sudah jelas" });
  await h.save({ value: "positive", reason: null, note: "Sudah jelas" });
  assert.equal(h.records.size, 1);
  const feedback = await h.read();
  assert.equal(feedback?.value, "positive");
  assert.equal(feedback?.runId, "run");
  assert.equal(feedback?.reason, null);
});

test("legacy persisted answers can receive feedback without a response run", async (t) => {
  const h = await harness(t, { run: false });
  const feedback = await h.save({ value: "positive" });
  assert.equal(feedback.runId, null);
});

test("foreign chats, missing answers and user messages cannot receive feedback", async (t) => {
  const h = await harness(t, { owned: false });
  await assert.rejects(() => h.save({ value: "positive" }), (e: unknown) => (e as { status: number }).status === 404);
  await assert.rejects(() => h.read(), (e: unknown) => (e as { status: number }).status === 404);
  assert.equal(h.records.size, 0);
});

for (const role of ["admin", "dosen"]) {
  test(`${role} cannot write or inspect student feedback`, async (t) => {
    const h = await harness(t, { role });
    await assert.rejects(() => h.save({ value: "positive" }), (e: unknown) => (e as { status: number }).status === 403);
    await assert.rejects(() => h.read(), (e: unknown) => (e as { status: number }).status === 403);
    assert.equal(h.records.size, 0);
  });
}

test("payload validation rejects invalid values, reasons and oversized notes", async (t) => {
  const h = await harness(t);
  for (const payload of [{ value: "other" }, { value: "negative", reason: "unknown" }, { value: "negative", note: "a".repeat(501) }, { value: "positive", runId: "forged" }]) {
    await assert.rejects(() => h.save(payload), (e: unknown) => (e as { status: number }).status === 400);
  }
  const feedback = await h.save({ value: "negative", note: "a".repeat(500) });
  assert.equal(feedback.note?.length, 500);
});
