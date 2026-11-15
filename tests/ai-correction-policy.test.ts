import test from "node:test";
import assert from "node:assert/strict";
import { correctionQuestionKey, assertActiveVersion, fingerprint } from "../src/lib/tutor-ai/correction-policy";
import { correctionDraftSchema, correctionSourcesSchema } from "../src/lib/tutor-ai/correction-schema";

test("equivalent normalized questions share a series key and different questions do not", () => {
  assert.equal(correctionQuestionKey(" Apa itu MEAN? "), correctionQuestionKey("apa itu mean"));
  assert.notEqual(correctionQuestionKey("apa itu mean"), correctionQuestionKey("apa itu median"));
});
test("approval cannot overwrite an active version the lecturer has not acknowledged", () => {
  assert.doesNotThrow(() => assertActiveVersion("v1", "v1"));
  assert.throws(() => assertActiveVersion("v2", "v1"), (error: unknown) => (error as { status: number }).status === 409);
  assert.throws(() => assertActiveVersion("v1", null));
});
test("draft validation requires bounded content, rationale and distinct sources", () => {
  const valid = { question: "Apa itu mean?", answer: "Mean adalah rata-rata aritmetika.", rationale: "Perbaikan definisi", sourceChunkIds: ["chunk-1"] };
  assert.equal(correctionDraftSchema.safeParse(valid).success, true);
  assert.equal(correctionDraftSchema.safeParse({ ...valid, sourceChunkIds: [] }).success, true);
  for (const patch of [ { sourceChunkIds: ["x", "x"] }, { answer: "x" }, { approvedBy: "forged" }]) {
    assert.equal(correctionDraftSchema.safeParse({ ...valid, ...patch }).success, false);
  }
});
test("fingerprints change with content or processing lineage, malformed snapshots are rejected", () => {
  assert.notEqual(fingerprint({ content: "lama", jobId: "a" }), fingerprint({ content: "baru", jobId: "a" }));
  assert.notEqual(fingerprint({ content: "sama", jobId: "a" }), fingerprint({ content: "sama", jobId: "b" }));
  assert.equal(correctionSourcesSchema.safeParse([]).success, true);
  assert.equal(correctionSourcesSchema.safeParse([{ kind: "page_range" }]).success, false);
});

test("retrieval ignores weak or ambiguous correction matches and bounds context to one version", async () => {
  const { selectCorrectionContext } = await import("../src/lib/tutor-ai/correction-retrieval");
  const base = { id: "v1", questionKey: "mean", question: "Apa itu mean?", answer: "Definisi mean yang didukung materi.", version: 1, sourceFingerprint: "hash", sourceSnapshot: [], similarity: 0.95 };
  assert.deepEqual(selectCorrectionContext([{ ...base, similarity: 0.5 }]), []);
  assert.deepEqual(selectCorrectionContext([{ ...base, similarity: Number.NaN }]), []);
  assert.deepEqual(selectCorrectionContext([base, { ...base, id: "v2", answer: "Definisi lain yang bertentangan.", similarity: 0.94 }]), []);
  assert.deepEqual(selectCorrectionContext([base, { ...base, id: "v2", answer: "Topik berbeda.", similarity: 0.86 }]).map((c) => c.id), ["v1"]);
});
