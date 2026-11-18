import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/synthetic_no_database";

async function harness(t: TestContext, options: { role?: string; owned?: boolean; run?: boolean; failEvent?: boolean } = {}) {
  const { default: prisma } = await import("../src/lib/prisma");
  const { saveTutorFeedback, readTutorFeedback } = await import("../src/lib/tutor-ai/feedback");
  function replace(target: object, key: string, value: unknown) {
    const record = target as Record<string, unknown>;
    const original = record[key];
    record[key] = value;
    t.after(() => { record[key] = original; });
  }
  const records = new Map<string, Record<string, unknown>>();
  const events: Array<Record<string, unknown>> = [];
  replace(prisma, "$transaction", async (callback: (tx: typeof prisma) => Promise<unknown>) => {
    const before = structuredClone([...records]);
    const count = events.length;
    try { return await callback(prisma); } catch (error) {
      records.clear(); before.forEach(([key, value]) => records.set(key, value)); events.length = count;
      throw error;
    }
  });
  replace(prisma.aiFeedbackReviewEvent, "create", async ({ data }: { data: Record<string, unknown> }) => { if (options.failEvent) throw new Error("synthetic student history failure"); events.push(data); return data; });
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
    const previous = records.get(key);
    const row = previous ? { ...previous, ...update, reviewRevision: Number(previous.reviewRevision) + 1, updatedAt: new Date() }
      : { id: "feedback", reviewRevision: 1, ...create, updatedAt: new Date() };
    records.set(key, row);
    return row;
  });
  replace(prisma.aiMessageFeedback, "findUnique", async ({ where }: { where: unknown }) => records.get(JSON.stringify(where)) ?? null);
  const scope = { userId: "student", courseId: "course", sessionId: "chat", messageId: "answer" };
  return {
    records, events,
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


test("repeated identical feedback preserves a completed review, changed notes reopen it with history", async (t) => {
  const h = await harness(t);
  await h.save({ value: "negative", note: "Kurang jelas" });
  const row = [...h.records.values()][0];
  row.reviewStatus = "completed";
  row.reviewerId = "lecturer";
  row.reviewedAt = new Date();
  await h.save({ value: "negative", note: "Kurang jelas" });
  assert.equal(h.events.length, 1);
  assert.equal((await h.read())?.reviewStatus, "completed");
  await h.save({ value: "negative", note: "Perlu penjelasan lain" });
  const latest = await h.read();
  assert.equal(latest?.reviewStatus, "pending");
  assert.equal(latest?.reviewerId, null);
  assert.equal(latest?.reviewRevision, 2);
  assert.deepEqual(h.events[1].feedbackBefore, { value: "negative", reason: null, note: "Kurang jelas" });
  assert.equal(h.events[1].fromStatus, "completed");
});

test("changing to positive withdraws review and another negative edit restores a single queue item", async (t) => {
  const h = await harness(t);
  await h.save({ value: "negative" });
  await h.save({ value: "positive" });
  assert.equal((await h.read())?.reviewStatus, "withdrawn");
  await h.save({ value: "negative" });
  assert.equal(h.records.size, 1);
  assert.equal((await h.read())?.reviewStatus, "pending");
  assert.equal(h.events.length, 3);
});


test("student feedback is rolled back when its history cannot be saved", async (t) => {
  const h = await harness(t, { failEvent: true });
  await assert.rejects(() => h.save({ value: "negative" }), /student history failure/);
  assert.equal(h.records.size, 0); assert.equal(h.events.length, 0);
});
