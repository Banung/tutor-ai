import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL = "postgresql://test:test@127.0.0.1:1/synthetic_no_database";

type ScopeArgs = { where: { id?: string; reviewRevision?: number; message?: { senderType?: string; aiChatSession?: { course?: { instructors?: { some?: { userId?: string } } } } } } };

async function harness(t: TestContext, options: { role?: string; failEvent?: boolean; staleWrite?: boolean; txConflicts?: number; positiveOnly?: boolean; reviewerRevoked?: boolean } = {}) {
  const { default: prisma } = await import("../src/lib/prisma");
  const { Prisma } = await import("../src/app/generated/prisma/client");
  const service = await import("../src/lib/tutor-ai/feedback-review");
  const item = {
    id: "feedback", value: options.positiveOnly ? "positive" : "negative", reason: "incorrect", note: "Perlu diperiksa",
    reviewStatus: options.positiveOnly ? "withdrawn" : "pending", reviewRevision: 1, reviewerId: null as string | null,
    reviewedAt: null as Date | null, createdAt: new Date(), updatedAt: new Date(),
  };
  const events: Array<Record<string, unknown>> = [];
  const scopes: unknown[] = [];
  const questions: unknown[] = [];
  let transactions = 0;
  let listArgs: Record<string, unknown> | undefined;
  function replace(target: object, key: string, value: unknown) {
    const record = target as Record<string, unknown>; const original = record[key];
    record[key] = value; t.after(() => { record[key] = original; });
  }
  function allowed(args: ScopeArgs) {
    scopes.push(args);
    return args.where.message?.senderType === "ai"
      && args.where.message?.aiChatSession?.course?.instructors?.some?.userId === "lecturer"
      && (!args.where.id || args.where.id === item.id)
      && (item.value === "negative" || events.some((event) => event.toStatus === "pending"));
  }
  function detail() {
    return { ...item, reviewer: item.reviewerId ? { id: item.reviewerId, name: "Dosen pengampu" } : null,
      run: { id: "run", userMessageId: "question" },
      message: { id: "answer", content: "Jawaban yang dilaporkan", ragSources: { sources: [{ materialTitle: "Materi kuliah", pageNumber: 2, snippet: "Potongan sumber" }] }, createdAt: new Date(), aiChatSessionId: "chat", aiChatSession: { courseId: "course", course: { id: "course", title: "Statistika" } } },
      reviewEvents: events,
    };
  }
  replace(prisma.user, "findUnique", async () => ({ id: "lecturer", name: "Dosen pengampu", role: options.role ?? "dosen" }));
  replace(prisma.aiMessageFeedback, "findFirst", async (args: ScopeArgs) => allowed(args) ? detail() : null);
  replace(prisma.aiMessageFeedback, "findMany", async (args: Record<string, unknown>) => { listArgs = args; return []; });
  replace(prisma.aiMessageFeedback, "count", async () => 0);
  replace(prisma.courseInstructor, "count", async () => options.reviewerRevoked ? 0 : 1);
  replace(prisma.course, "findMany", async () => [{ id: "course", title: "Statistika" }]);
  replace(prisma.aiChatMessage, "findFirst", async (args: unknown) => { questions.push(args); return { content: "Pertanyaan terkait" }; });
  replace(prisma.aiMessageFeedback, "updateMany", async (args: ScopeArgs & { data: { reviewStatus: string; reviewRevision: { increment: number }; reviewerId: string | null; reviewedAt: Date | null } }) => {
    if (!allowed(args) || args.where.reviewRevision !== item.reviewRevision || options.staleWrite) return { count: 0 };
    const { reviewRevision, ...data } = args.data;
    Object.assign(item, data); item.reviewRevision += reviewRevision.increment;
    return { count: 1 };
  });
  replace(prisma.aiFeedbackReviewEvent, "create", async ({ data }: { data: Record<string, unknown> }) => {
    if (options.failEvent) throw new Error("synthetic history storage failure");
    events.push(data); return data;
  });
  replace(prisma, "$transaction", async (callback: (db: typeof prisma) => Promise<unknown>, args: { isolationLevel: string }) => {
    assert.equal(args.isolationLevel, "Serializable");
    transactions++;
    if (transactions <= (options.txConflicts ?? 0)) throw new Prisma.PrismaClientKnownRequestError("synthetic conflict", { code: "P2034", clientVersion: "test" });
    const before = structuredClone(item); const count = events.length;
    try { return await callback(prisma); } catch (error) { Object.assign(item, before); events.length = count; throw error; }
  });
  return { item, events, scopes, questions, get listArgs() { return listArgs; }, get transactions() { return transactions; },
    list: (userId = "lecturer", query: unknown = {}) => service.listFeedbackReviews(userId, query),
    read: (userId = "lecturer", id = "feedback") => service.getFeedbackReview(userId, id),
    change: (payload: unknown, userId = "lecturer") => service.changeFeedbackReview(userId, "feedback", payload),
  };
}

test("queue filters current negatives by assigned course and paginates with a bounded size", async (t) => {
  const h = await harness(t);
  const result = await h.list("lecturer", { courseId: "course", status: "completed", page: 2 });
  assert.equal(result.pageSize, 20);
  assert.equal(h.listArgs?.skip, 20);
  assert.equal(h.listArgs?.take, 20);
  const where = h.listArgs?.where as { value: string; reviewStatus: string; message: { aiChatSession: { course: { id: string; instructors: { some: { userId: string } } } } } };
  assert.equal(where.value, "negative"); assert.equal(where.reviewStatus, "completed");
  assert.equal(where.message.aiChatSession.course.id, "course");
  assert.equal(where.message.aiChatSession.course.instructors.some.userId, "lecturer");
});

for (const role of ["admin", "mahasiswa"]) {
  test(`${role} cannot list, inspect or update lecturer reviews`, async (t) => {
    const h = await harness(t, { role });
    for (const action of [() => h.list(), () => h.read(), () => h.change({ status: "in_review", expectedRevision: 1 })]) {
      await assert.rejects(action, (e: unknown) => (e as { status: number }).status === 403);
    }
    assert.equal(h.scopes.length, 0); assert.equal(h.events.length, 0);
  });
}

test("unassigned lecturers cannot read or mutate another course's feedback", async (t) => {
  const h = await harness(t);
  await assert.rejects(() => h.read("outsider"), (e: unknown) => (e as { status: number }).status === 404);
  await assert.rejects(() => h.change({ status: "in_review", expectedRevision: 1 }, "outsider"), (e: unknown) => (e as { status: number }).status === 404);
  assert.equal(h.events.length, 0); assert.equal(h.item.reviewStatus, "pending");
});

test("detail only fetches the question linked to the reported answer and exposes cited source summaries", async (t) => {
  const h = await harness(t);
  const detail = await h.read();
  assert.deepEqual(h.questions, [{ where: { senderType: "user", aiChatSessionId: "chat", id: "question" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { content: true } }]);
  assert.equal(detail.question, "Pertanyaan terkait");
  assert.deepEqual(detail.sources, [{ title: "Materi kuliah", pageNumber: 2, snippet: "Potongan sumber" }]);
  assert.equal("message" in detail, false); assert.equal("userId" in detail, false);
});

test("claim and completion atomically persist reviewer, completion time and status history", async (t) => {
  const h = await harness(t);
  const claimed = await h.change({ status: "in_review", expectedRevision: 1 });
  assert.equal(claimed.reviewStatus, "in_review"); assert.equal(h.item.reviewerId, "lecturer");
  const completed = await h.change({ status: "completed", expectedRevision: 2 });
  assert.equal(completed.reviewStatus, "completed"); assert.ok(h.item.reviewedAt);
  assert.equal(h.events.length, 2); assert.equal(h.events[1].actorId, "lecturer");
  assert.equal(h.events[1].fromStatus, "in_review"); assert.equal(h.events[1].toStatus, "completed");
  assert.equal(h.events[1].revision, 3);
});

test("stale review decisions cannot overwrite a newer decision or student edit", async (t) => {
  const h = await harness(t);
  await h.change({ status: "in_review", expectedRevision: 1 });
  await assert.rejects(() => h.change({ status: "completed", expectedRevision: 1 }), (e: unknown) => (e as { status: number }).status === 409);
  assert.equal(h.item.reviewStatus, "in_review"); assert.equal(h.events.length, 1);
});

test("a compare-and-set conflict writes no review history", async (t) => {
  const h = await harness(t, { staleWrite: true });
  await assert.rejects(() => h.change({ status: "in_review", expectedRevision: 1 }), (e: unknown) => (e as { status: number }).status === 409);
  assert.equal(h.events.length, 0); assert.equal(h.item.reviewStatus, "pending");
});

test("history failure rolls back the review update", async (t) => {
  const h = await harness(t, { failEvent: true });
  await assert.rejects(() => h.change({ status: "in_review", expectedRevision: 1 }), /history storage failure/);
  assert.equal(h.item.reviewStatus, "pending"); assert.equal(h.item.reviewerId, null); assert.equal(h.events.length, 0);
});

test("serializable transaction conflicts retry without duplicating events", async (t) => {
  const h = await harness(t, { txConflicts: 1 });
  await h.change({ status: "in_review", expectedRevision: 1 });
  assert.equal(h.transactions, 2); assert.equal(h.events.length, 1);
});

test("positive-only feedback is not exposed through a guessed detail ID", async (t) => {
  const h = await harness(t, { positiveOnly: true });
  await assert.rejects(() => h.read(), (e: unknown) => (e as { status: number }).status === 404);
  assert.equal(h.questions.length, 0);
});

test("invalid filters and forged review payloads are rejected", async (t) => {
  const h = await harness(t);
  for (const query of [{ status: "withdrawn" }, { page: -1 }, { page: 1.5 }]) {
    await assert.rejects(() => h.list("lecturer", query), (e: unknown) => (e as { status: number }).status === 400);
  }
  for (const payload of [{ status: "completed" }, { status: "in_review", expectedRevision: 1, reviewerId: "forged" }, { status: "unknown", expectedRevision: 1 }]) {
    await assert.rejects(() => h.change(payload), (e: unknown) => (e as { status: number }).status === 400);
  }
  assert.equal(h.events.length, 0);
});


test("an assigned lecturer can release a review whose previous reviewer lost access", async (t) => {
  const h = await harness(t, { reviewerRevoked: true });
  h.item.reviewStatus = "in_review"; h.item.reviewerId = "revoked-lecturer";
  const detail = await h.read();
  assert.deepEqual(detail.actions, ["pending"]);
  await h.change({ status: "pending", expectedRevision: 1 });
  assert.equal(h.item.reviewStatus, "pending"); assert.equal(h.item.reviewerId, null);
});

test("one assigned lecturer cannot finish work actively claimed by another", async (t) => {
  const h = await harness(t);
  h.item.reviewStatus = "in_review"; h.item.reviewerId = "other-lecturer";
  await assert.rejects(() => h.change({ status: "completed", expectedRevision: 1 }), (e: unknown) => (e as { status: number }).status === 409);
  assert.equal(h.events.length, 0);
});


test("persistent transaction conflicts stop after three attempts with no partial review", async (t) => {
  const h = await harness(t, { txConflicts: 3 });
  await assert.rejects(() => h.change({ status: "in_review", expectedRevision: 1 }), (e: unknown) => (e as { status: number }).status === 409);
  assert.equal(h.transactions, 3); assert.equal(h.events.length, 0); assert.equal(h.item.reviewStatus, "pending");
});
