import test from "node:test";
import assert from "node:assert/strict";
import { reviewActions, validateReviewChange, nextFeedbackReviewStatus } from "../src/lib/tutor-ai/feedback-review-policy";

test("one lecturer claims pending work, and only that lecturer can finish or release it", () => {
  const pending = { value: "negative", reviewStatus: "pending", reviewerId: null, reviewRevision: 1 };
  assert.deepEqual(reviewActions(pending, "lecturer"), ["in_review"]);
  const active = { ...pending, reviewStatus: "in_review", reviewerId: "lecturer", reviewRevision: 2 };
  assert.deepEqual(reviewActions(active, "lecturer"), ["completed", "pending"]);
  assert.deepEqual(reviewActions(active, "other"), []);
  assert.throws(() => validateReviewChange(active, "other", { status: "completed", expectedRevision: 2 }), /dosen lain/);
});

test("changed feedback makes a previously loaded review stale", () => {
  const item = { value: "negative", reviewStatus: "pending", reviewerId: null, reviewRevision: 4 };
  assert.throws(() => validateReviewChange(item, "lecturer", { status: "in_review", expectedRevision: 3 }), /berubah/);
});

test("positive feedback is withdrawn and cannot be reviewed; negative edits reopen pending work", () => {
  assert.equal(nextFeedbackReviewStatus("positive"), "withdrawn");
  assert.equal(nextFeedbackReviewStatus("negative"), "pending");
  const withdrawn = { value: "positive", reviewStatus: "withdrawn", reviewerId: null, reviewRevision: 3 };
  assert.deepEqual(reviewActions(withdrawn, "lecturer"), []);
  assert.throws(() => validateReviewChange(withdrawn, "lecturer", { status: "in_review", expectedRevision: 3 }), /positif/);
});

test("completed reviews can be reopened, but pending reviews cannot skip directly to completed", () => {
  const completed = { value: "negative", reviewStatus: "completed", reviewerId: "lecturer", reviewRevision: 3 };
  assert.deepEqual(reviewActions(completed, "other"), ["in_review"]);
  assert.equal(validateReviewChange(completed, "other", { status: "in_review", expectedRevision: 3 }), "in_review");
  assert.throws(() => validateReviewChange({ ...completed, reviewStatus: "pending" }, "lecturer", { status: "completed", expectedRevision: 3 }), /status/);
});
