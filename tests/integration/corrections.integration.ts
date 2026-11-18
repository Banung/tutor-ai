import type { Prisma } from "../../src/app/generated/prisma/client";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const enabled = process.env.RUN_LOCAL_CORRECTION_TESTS === "1";

test("correction lifecycle, scope, source freshness and run provenance on local PostgreSQL", { skip: !enabled }, async (t) => {
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, "55432"); assert.equal(url.pathname, "/tutor_ai_local");
  process.env.GEMINI_API_KEY = "synthetic-correction-integration-key";
  const { default: p } = await import("../../src/lib/prisma");
  const { createCorrectionDraft, actOnCorrection, listCourseCorrections } = await import("../../src/lib/tutor-ai/corrections");
  const { findApplicableCorrections, assertCorrectionsCurrent } = await import("../../src/lib/tutor-ai/correction-retrieval");
  const { askTutorStream } = await import("../../src/lib/tutor-ai/service");
  const { toPgVector } = await import("../../src/lib/tutor-ai/gemini");
  const prefix = `qa-correction-${randomUUID()}`;
  const ids = { teacher: `${prefix}-teacher`, other: `${prefix}-other`, student: `${prefix}-student`, admin: `${prefix}-admin`, course: `${prefix}-course`, foreignCourse: `${prefix}-foreign`, lesson: `${prefix}-lesson`, foreignLesson: `${prefix}-foreign-lesson`, material: `${prefix}-material`, foreignMaterial: `${prefix}-foreign-material`, chunk: `${prefix}-chunk`, foreignChunk: `${prefix}-foreign-chunk`, chat: `${prefix}-chat`, question: `${prefix}-question`, answer: `${prefix}-answer`, feedback: `${prefix}-feedback` };
  t.after(async () => {
    await p.aiChatSession.deleteMany({ where: { courseId: { in: [ids.course, ids.foreignCourse] } } });
    await p.course.deleteMany({ where: { id: { in: [ids.course, ids.foreignCourse] } } });
    await p.user.deleteMany({ where: { id: { in: [ids.teacher, ids.other, ids.student, ids.admin] } } });
    await p.$disconnect();
  });
  const vector = Array(768).fill(0); vector[0] = 1;
  const unrelated = Array(768).fill(0); unrelated[1] = 1;
  let embeddings = 0;
  let providerDown = false;
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
    const path = String(url);
    if (path.toLowerCase().includes("embedcontent")) { embeddings++; if (providerDown) return Response.json({ error: { message: "synthetic embedding failure" } }, { status: 400 }); return Response.json({ embeddings: [{ values: vector }] }); }
    const text = path.includes("streamGenerateContent") ? "Mean adalah jumlah seluruh nilai dibagi banyaknya data. [Sumber 1]" : "Apa itu mean?";
    const body = { candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }] };
    if (path.includes("streamGenerateContent")) return new Response(`data: ${JSON.stringify(body)}\n\n`, { headers: { "Content-Type": "text/event-stream" } });
    if (path.includes("generateContent")) return Response.json(body);
    throw new Error("Unexpected network access in local DB test");
  });
  const now = new Date();
  await p.user.createMany({ data: [[ids.teacher, "dosen"], [ids.other, "dosen"], [ids.student, "mahasiswa"], [ids.admin, "admin"]].map(([id, role]) => ({ id, name: "QA Correction", email: `${id}@local.test`, role, academicLevel: "S1", emailVerified: true, createdAt: now, updatedAt: now })) });
  await p.course.createMany({ data: [{ id: ids.course, createdBy: ids.teacher, title: "QA Correction", enrollmentKey: `${prefix}-a` }, { id: ids.foreignCourse, createdBy: ids.other, title: "QA Foreign", enrollmentKey: `${prefix}-b` }] });
  await p.courseInstructor.createMany({ data: [{ id: `${prefix}-assignment`, courseId: ids.course, userId: ids.teacher }, { id: `${prefix}-foreign-assignment`, courseId: ids.foreignCourse, userId: ids.other }] });
  await p.enrollment.create({ data: { id: `${prefix}-enrollment`, courseId: ids.course, userId: ids.student } });
  await p.courseSession.createMany({ data: [{ id: ids.lesson, courseId: ids.course, createdBy: ids.teacher, title: "QA Mean", orderNumber: 1 }, { id: ids.foreignLesson, courseId: ids.foreignCourse, createdBy: ids.other, title: "QA Foreign", orderNumber: 1 }] });
  for (const [materialId, lessonId, teacherId, chunkId, courseId] of [[ids.material, ids.lesson, ids.teacher, ids.chunk, ids.course], [ids.foreignMaterial, ids.foreignLesson, ids.other, ids.foreignChunk, ids.foreignCourse]]) {
    await p.material.create({ data: { id: materialId, courseSessionId: lessonId, uploadedBy: teacherId, title: "Definisi Mean", fileName: "qa-mean.pdf", filePath: "qa-only.pdf", isProcessed: true, processingStatus: "ready", processingJobId: "qa-job-1", pageCount: 1, chunkCount: 1, embeddingModel: "gemini-embedding-2", embeddingDimensions: 768 } });
    await p.materialChunk.create({ data: { id: chunkId, materialId, courseId, sessionId: lessonId, pageNumber: 1, chunkIndex: 0, content: "Mean adalah jumlah seluruh nilai dibagi banyaknya data.", tokenCount: 12 } });
    await p.$executeRaw`UPDATE "material_chunk" SET "embedding" = ${toPgVector(vector)}::vector WHERE "id" = ${chunkId}`;
  }
  await p.aiChatSession.create({ data: { id: ids.chat, userId: ids.student, courseId: ids.course, courseSessionId: ids.lesson } });
  await p.aiChatMessage.createMany({ data: [{ id: ids.question, aiChatSessionId: ids.chat, senderType: "user", content: "Apa itu mean?", createdAt: new Date(now.getTime() - 2000) }, { id: ids.answer, aiChatSessionId: ids.chat, senderType: "ai", content: "Jawaban awal yang perlu diperbaiki.", createdAt: new Date(now.getTime() - 1000) }] });
  await p.aiResponseRun.create({ data: { id: `${prefix}-run`, aiChatSessionId: ids.chat, requestId: `${prefix}-request`, requestHash: "qa", question: "Apa itu mean?", responseMode: "chat", status: "completed", userMessageId: ids.question, answerMessageId: ids.answer } });
  await p.aiMessageFeedback.create({ data: { id: ids.feedback, userId: ids.student, messageId: ids.answer, runId: `${prefix}-run`, value: "negative" } });
  const draft = { question: "Apa itu mean?", answer: "Mean adalah jumlah seluruh nilai dibagi banyaknya data.", rationale: "Meluruskan definisi sesuai materi", sourceChunkIds: [ids.chunk] };
  const query = { courseId: ids.course, selectedMaterialIds: [ids.material], question: draft.question, questionEmbedding: vector };
  let first: Awaited<ReturnType<typeof createCorrectionDraft>>;
  await t.test("drafts require course authority and active same-course sources", async () => {
    await assert.rejects(() => createCorrectionDraft(ids.other, ids.feedback, draft), (e: unknown) => (e as { status: number }).status === 404);
    await assert.rejects(() => createCorrectionDraft(ids.teacher, ids.feedback, { ...draft, sourceChunkIds: [ids.foreignChunk] }), (e: unknown) => (e as { status: number }).status === 409);
    await assert.rejects(() => listCourseCorrections(ids.admin), (e: unknown) => (e as { status: number }).status === 403);
    first = await createCorrectionDraft(ids.teacher, ids.feedback, draft);
    assert.equal(first.status, "draft"); assert.equal(first.version, 1);
    await assert.rejects(() => actOnCorrection(ids.other, first.id, { action: "approve", expectedActiveVersionId: null }), (e: unknown) => (e as { status: number }).status === 404);
    await assert.rejects(() => actOnCorrection(ids.admin, first.id, { action: "approve", expectedActiveVersionId: null }), (e: unknown) => (e as { status: number }).status === 403);
    assert.deepEqual(await findApplicableCorrections(query), []);
  });
  await t.test("approval embeds the question and only the scoped, selected source can be reused", async () => {
    await actOnCorrection(ids.teacher, first.id, { action: "approve", expectedActiveVersionId: null });
    const contexts = await findApplicableCorrections(query);
    assert.equal(contexts[0].id, first.id);
    assert.deepEqual(await findApplicableCorrections({ ...query, courseId: ids.foreignCourse, selectedMaterialIds: [ids.foreignMaterial] }), []);
    assert.deepEqual(await findApplicableCorrections({ ...query, selectedMaterialIds: [] }), []);
    assert.deepEqual(await findApplicableCorrections({ ...query, question: "Topik yang lain", questionEmbedding: unrelated }), []);
    assert.equal((await findApplicableCorrections({ ...query, question: "Jelaskan rata-rata aritmetika" }))[0].id, first.id, "synthetic matching vector tests semantic query path, not real model quality");
  });
  let second: Awaited<ReturnType<typeof createCorrectionDraft>>;
  await t.test("new versions replace only an explicitly acknowledged active version", async () => {
    second = await createCorrectionDraft(ids.teacher, ids.feedback, { ...draft, answer: "Rata-rata aritmetika adalah jumlah seluruh nilai dibagi banyaknya data." });
    assert.equal(second.version, 2);
    const calls = embeddings;
    await assert.rejects(() => actOnCorrection(ids.teacher, second.id, { action: "approve", expectedActiveVersionId: null }), (e: unknown) => (e as { status: number }).status === 409);
    assert.equal(embeddings, calls, "stale confirmation fails before a provider call");
    providerDown = true;
    await assert.rejects(() => actOnCorrection(ids.teacher, second.id, { action: "approve", expectedActiveVersionId: first.id }));
    providerDown = false;
    assert.equal((await p.aiAnswerCorrection.findUniqueOrThrow({ where: { id: first.id } })).status, "approved");
    assert.equal((await p.aiAnswerCorrection.findUniqueOrThrow({ where: { id: second.id } })).status, "draft");
    await actOnCorrection(ids.teacher, second.id, { action: "approve", expectedActiveVersionId: first.id });
    assert.equal((await p.aiAnswerCorrection.findUniqueOrThrow({ where: { id: first.id } })).answer, draft.answer);
    assert.equal((await p.aiAnswerCorrection.findUniqueOrThrow({ where: { id: first.id } })).status, "superseded");
    assert.equal(await p.aiAnswerCorrection.count({ where: { courseId: ids.course, questionKey: first.questionKey, status: "approved" } }), 1);
    await assert.rejects(() => p.aiAnswerCorrection.create({ data: { courseId: ids.course, questionKey: first.questionKey, question: draft.question, version: 99, answer: draft.answer, rationale: draft.rationale, sourceSnapshot: first.sourceSnapshot as Prisma.InputJsonValue, sourceFingerprint: first.sourceFingerprint, authorId: ids.teacher, authorName: "QA", status: "approved" } }), "database partial index rejects a second active version");
  });
  let savedRunId: string;
  let savedConfiguration: string;
  await t.test("actual tutor service includes the approved version and records immutable provenance", async () => {
    const stream = await askTutorStream({ courseId: ids.course, userId: ids.student, sessionId: ids.chat, content: draft.question });
    const events = await new Response(stream).text();
    assert.match(events, /event: done/); assert.doesNotMatch(events, /event: error/);
    const done = JSON.parse(events.split("\n\n").find((block) => block.startsWith("event: done\n"))!.split("data: ")[1]);
    savedRunId = done.runId;
    const run = await p.aiResponseRun.findUniqueOrThrow({ where: { id: savedRunId } });
    assert.match(JSON.stringify(run.configuration), new RegExp(second.id));
    assert.match(JSON.stringify(run.configuration), /Rata-rata aritmetika/);
    savedConfiguration = JSON.stringify(run.configuration);
  });
  await t.test("changed processing lineage invalidates sources until a newly approved version is created", async () => {
    await p.materialChunk.update({ where: { id: ids.chunk }, data: { content: "Konten sumber telah diubah." } });
    assert.deepEqual(await findApplicableCorrections(query), []);
    await p.materialChunk.update({ where: { id: ids.chunk }, data: { content: "Mean adalah jumlah seluruh nilai dibagi banyaknya data." } });
    await p.courseSession.update({ where: { id: ids.lesson }, data: { isActive: false } });
    assert.deepEqual(await findApplicableCorrections(query), []);
    await p.courseSession.update({ where: { id: ids.lesson }, data: { isActive: true } });
    await p.material.update({ where: { id: ids.material }, data: { processingJobId: "qa-job-2" } });
    assert.deepEqual(await findApplicableCorrections(query), []);
    const listing = await listCourseCorrections(ids.teacher);
    assert.equal(listing.versions.find((v) => v.id === second.id)?.effectiveStatus, "needs_review");
    const third = await createCorrectionDraft(ids.teacher, ids.feedback, draft);
    await actOnCorrection(ids.teacher, third.id, { action: "approve", expectedActiveVersionId: second.id });
    const contexts = await findApplicableCorrections(query);
    assert.equal(contexts[0].id, third.id);
    await p.material.update({ where: { id: ids.material }, data: { isActive: false } });
    assert.deepEqual(await findApplicableCorrections(query), []);
    await p.material.update({ where: { id: ids.material }, data: { isActive: true } });
    await actOnCorrection(ids.teacher, third.id, { action: "withdraw", expectedActiveVersionId: third.id, reason: "QA pencabutan koreksi" });
    assert.deepEqual(await findApplicableCorrections(query), []);
    await assert.rejects(() => assertCorrectionsCurrent(ids.course, contexts), /berubah/);
    assert.equal(JSON.stringify((await p.aiResponseRun.findUniqueOrThrow({ where: { id: savedRunId } })).configuration), savedConfiguration);
  });
  await t.test("deleting the chat does not destroy correction versions or lecturer management access", async () => {
    await p.aiChatSession.delete({ where: { id: ids.chat } });
    const listing = await listCourseCorrections(ids.teacher);
    assert.equal(listing.versions.length, 3);
    assert.ok(listing.versions.every((version) => version.feedbackId === null));
  });
});
