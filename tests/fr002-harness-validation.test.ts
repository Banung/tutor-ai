import test from "node:test";
import assert from "node:assert/strict";

import {
  HarnessValidationError,
  validateCleanup,
  validateEndpoints,
  validateLifecycleScenario,
  validateLockEvidence,
  validatePreservation,
  type CleanupResult,
  type LifecycleExpectation,
  type LockEvidence,
  type PreservedAfter,
  type PreservedBefore,
} from "./integration/fr002-validation";

type ScenarioInput = Parameters<typeof validateLifecycleScenario>[0];

const LOCK: LockEvidence = {
  blockerPid: 4242,
  baselineWaiters: [],
  firstWaiters: [5001],
  secondWaiters: [5001, 5002],
};

const EXPECTED: LifecycleExpectation = {
  first: { outcome: "success", changed: true },
  second: { outcome: "success", changed: true },
  finalStatus: "ARCHIVED",
  transitions: [
    { from: "DRAFT", to: "PUBLISHED" },
    { from: "PUBLISHED", to: "ARCHIVED" },
  ],
};

function scenario(overrides: Partial<ScenarioInput> = {}): ScenarioInput {
  return {
    name: "publishWinsArchive",
    first: { ok: true, changed: true },
    second: { ok: true, changed: true },
    finalStatus: "ARCHIVED",
    transitions: [
      { fromStatus: "DRAFT", toStatus: "PUBLISHED", actorId: "admin-1" },
      { fromStatus: "PUBLISHED", toStatus: "ARCHIVED", actorId: "admin-1" },
    ],
    actorId: "admin-1",
    lock: LOCK,
    expected: EXPECTED,
    ...overrides,
  };
}

function expectFailure(fn: () => void): HarnessValidationError {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof HarnessValidationError, "expected HarnessValidationError");
    return error;
  }
  assert.fail("expected validation to reject the observation");
}

function checksOf(error: HarnessValidationError) {
  return error.failures.map((failure) => failure.check);
}

test("valid lifecycle observation passes", () => {
  assert.doesNotThrow(() => validateLifecycleScenario(scenario()));
});

test("wrong final status is rejected", () => {
  const error = expectFailure(() =>
    validateLifecycleScenario(scenario({ finalStatus: "PUBLISHED" }))
  );
  assert.ok(checksOf(error).includes("publishWinsArchive: final catalog status"));
});

test("missing audit transition is rejected", () => {
  const error = expectFailure(() =>
    validateLifecycleScenario(
      scenario({
        transitions: [
          { fromStatus: "DRAFT", toStatus: "PUBLISHED", actorId: "admin-1" },
        ],
      })
    )
  );
  assert.ok(checksOf(error).includes("publishWinsArchive: audit transition count"));
});

test("duplicate audit transition is rejected", () => {
  const error = expectFailure(() =>
    validateLifecycleScenario(
      scenario({
        transitions: [
          { fromStatus: "DRAFT", toStatus: "PUBLISHED", actorId: "admin-1" },
          { fromStatus: "PUBLISHED", toStatus: "ARCHIVED", actorId: "admin-1" },
          { fromStatus: "PUBLISHED", toStatus: "ARCHIVED", actorId: "admin-1" },
        ],
      })
    )
  );
  assert.ok(checksOf(error).includes("publishWinsArchive: audit transition count"));
});

test("wrong audit transition order is rejected", () => {
  const error = expectFailure(() =>
    validateLifecycleScenario(
      scenario({
        transitions: [
          { fromStatus: "PUBLISHED", toStatus: "ARCHIVED", actorId: "admin-1" },
          { fromStatus: "DRAFT", toStatus: "PUBLISHED", actorId: "admin-1" },
        ],
      })
    )
  );
  assert.ok(checksOf(error).includes("publishWinsArchive: transition 1"));
});

test("forged audit actor is rejected", () => {
  const error = expectFailure(() =>
    validateLifecycleScenario(
      scenario({
        transitions: [
          { fromStatus: "DRAFT", toStatus: "PUBLISHED", actorId: "forged" },
          { fromStatus: "PUBLISHED", toStatus: "ARCHIVED", actorId: "forged" },
        ],
      })
    )
  );
  assert.ok(
    checksOf(error).filter((check) => check.endsWith("actor")).length === 2,
    "both transitions must report an actor mismatch"
  );
});

test("wrong rejection status is rejected", () => {
  const error = expectFailure(() =>
    validateLifecycleScenario(
      scenario({
        second: { ok: false, status: 400 },
        expected: {
          first: { outcome: "success", changed: true },
          second: { outcome: "rejected", status: 409 },
          finalStatus: "ARCHIVED",
          transitions: [{ from: "DRAFT", to: "ARCHIVED" }],
        },
        finalStatus: "ARCHIVED",
        transitions: [{ fromStatus: "DRAFT", toStatus: "ARCHIVED", actorId: "admin-1" }],
      })
    )
  );
  assert.ok(checksOf(error).includes("publishWinsArchive: second: rejection status"));
});

test("wrong instructor count is rejected", () => {
  const error = expectFailure(() =>
    validateLifecycleScenario(
      scenario({
        finalStatus: "PUBLISHED",
        instructors: 0,
        transitions: [{ fromStatus: "DRAFT", toStatus: "PUBLISHED", actorId: "admin-1" }],
        expected: {
          first: { outcome: "success", changed: true },
          second: { outcome: "rejected", status: 409 },
          finalStatus: "PUBLISHED",
          instructors: 1,
          transitions: [{ from: "DRAFT", to: "PUBLISHED" }],
        },
      })
    )
  );
  assert.ok(checksOf(error).includes("publishWinsArchive: instructor count"));
});

test("lock evidence must be scoped to a clean blocker chain", () => {
  assert.doesNotThrow(() => validateLockEvidence(LOCK));

  assert.ok(
    checksOf(
      expectFailure(() =>
        validateLockEvidence({ ...LOCK, baselineWaiters: [4999] })
      )
    ).includes("lock: baseline waiters before first operation")
  );
  assert.ok(
    checksOf(
      expectFailure(() =>
        validateLockEvidence({ ...LOCK, secondWaiters: [5002, 5003] })
      )
    ).includes("lock: first waiter stays in the chain")
  );
  assert.ok(
    checksOf(
      expectFailure(() =>
        validateLockEvidence({ ...LOCK, firstWaiters: [5001, 5001] })
      )
    ).includes("lock: distinct waiter backends")
  );
});

const BEFORE: PreservedBefore = {
  enrollmentId: "enrollment-1",
  sessionId: "session-1",
  materialId: "material-1",
  materialContent: "inline content",
  chatSessionId: "chat-1",
  messages: [
    { id: "message-1", content: "question" },
    { id: "message-2", content: "answer" },
  ],
};

function after(overrides: Partial<PreservedAfter> = {}): PreservedAfter {
  return {
    enrollment: { id: "enrollment-1", isActive: true },
    session: { id: "session-1" },
    material: { id: "material-1", textContent: "inline content" },
    chatSession: { id: "chat-1" },
    messages: [
      { id: "message-1", content: "question" },
      { id: "message-2", content: "answer" },
    ],
    ...overrides,
  };
}

test("valid preservation observation passes", () => {
  assert.doesNotThrow(() => validatePreservation(BEFORE, after()));
});

test("lost enrollment, session, material, or chat session is rejected", () => {
  assert.ok(
    checksOf(expectFailure(() => validatePreservation(BEFORE, after({ enrollment: null })))).includes(
      "preservation: enrollment"
    )
  );
  assert.ok(
    checksOf(expectFailure(() => validatePreservation(BEFORE, after({ session: null })))).includes(
      "preservation: course session"
    )
  );
  assert.ok(
    checksOf(expectFailure(() => validatePreservation(BEFORE, after({ material: null })))).includes(
      "preservation: material"
    )
  );
  assert.ok(
    checksOf(
      expectFailure(() => validatePreservation(BEFORE, after({ chatSession: null })))
    ).includes("preservation: chat session")
  );
});

test("changed preserved content is rejected", () => {
  const error = expectFailure(() =>
    validatePreservation(
      BEFORE,
      after({ material: { id: "material-1", textContent: "mutated content" } })
    )
  );
  assert.ok(checksOf(error).includes("preservation: material"));
});

test("messages are matched by id, not by content membership", () => {
  const error = expectFailure(() =>
    validatePreservation(
      BEFORE,
      after({
        messages: [
          { id: "message-2", content: "question" },
          { id: "message-1", content: "answer" },
        ],
      })
    )
  );
  assert.ok(checksOf(error).includes("preservation: chat message message-1"));
  assert.ok(checksOf(error).includes("preservation: chat message message-2"));
});

test("lost, duplicated, or extra chat messages are rejected", () => {
  assert.ok(
    checksOf(
      expectFailure(() =>
        validatePreservation(BEFORE, after({ messages: [{ id: "message-1", content: "question" }] }))
      )
    ).includes("preservation: chat message count")
  );
  assert.ok(
    checksOf(
      expectFailure(() =>
        validatePreservation(
          BEFORE,
          after({
            messages: [
              { id: "message-1", content: "question" },
              { id: "message-2", content: "answer" },
              { id: "message-3", content: "extra" },
            ],
          })
        )
      )
    ).includes("preservation: unexpected chat messages")
  );
});

const CHECKED_ENDPOINTS = {
  status: "checked" as const,
  existingStudentCourse: 200,
  existingStudentSessions: 200,
  discoveryExcludes: true,
  otherStudentEnrollStatus: 400,
};

test("valid endpoint results pass, and explicit skip is allowed", () => {
  assert.doesNotThrow(() => validateEndpoints(CHECKED_ENDPOINTS));
  assert.doesNotThrow(() =>
    validateEndpoints({ status: "skipped", reason: "--skip-http" })
  );
});

test("unexpected endpoint responses are rejected", () => {
  assert.ok(
    checksOf(
      expectFailure(() =>
        validateEndpoints({ ...CHECKED_ENDPOINTS, existingStudentCourse: 500 })
      )
    ).includes("endpoints: existing student course access")
  );
  assert.ok(
    checksOf(
      expectFailure(() =>
        validateEndpoints({ ...CHECKED_ENDPOINTS, existingStudentSessions: 403 })
      )
    ).includes("endpoints: existing student sessions access")
  );
  assert.ok(
    checksOf(
      expectFailure(() =>
        validateEndpoints({ ...CHECKED_ENDPOINTS, discoveryExcludes: false })
      )
    ).includes("endpoints: discovery excludes unpublished course")
  );
  assert.ok(
    checksOf(
      expectFailure(() =>
        validateEndpoints({ ...CHECKED_ENDPOINTS, discoveryExcludes: null })
      )
    ).includes("endpoints: discovery excludes unpublished course")
  );
});

test("unexpected self-enrollment success is rejected", () => {
  assert.ok(
    checksOf(
      expectFailure(() =>
        validateEndpoints({ ...CHECKED_ENDPOINTS, otherStudentEnrollStatus: 201 })
      )
    ).includes("endpoints: other student self-enrollment rejected")
  );
});

test("endpoint request errors are rejected, never reported as skipped", () => {
  const error = expectFailure(() =>
    validateEndpoints({ status: "error", message: "login failed with status 500" })
  );
  assert.ok(checksOf(error).includes("endpoints: request completed"));
});

const CLEANUP: CleanupResult = {
  deletedCourses: 5,
  expectedCourses: 5,
  remainingFixtureCourses: 0,
};

test("valid cleanup passes", () => {
  assert.doesNotThrow(() => validateCleanup(CLEANUP));
});

test("cleanup errors and leftovers are rejected", () => {
  assert.ok(
    checksOf(expectFailure(() => validateCleanup({ ...CLEANUP, error: "foreign key" }))).includes(
      "cleanup: no error"
    )
  );
  assert.ok(
    checksOf(expectFailure(() => validateCleanup({ ...CLEANUP, deletedCourses: 4 }))).includes(
      "cleanup: deleted fixture courses"
    )
  );
  assert.ok(
    checksOf(
      expectFailure(() => validateCleanup({ ...CLEANUP, remainingFixtureCourses: 1 }))
    ).includes("cleanup: no fixture courses remain")
  );
});
