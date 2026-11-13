/**
 * Pure validation helpers for the opt-in FR-002 integration harness.
 *
 * This module must stay side-effect free: it is imported by `pnpm test`
 * (tests/fr002-harness-validation.test.ts) and must never open a database
 * connection or read the environment.
 */

export type Failure = { check: string; expected: unknown; actual: unknown };

export class HarnessValidationError extends Error {
  constructor(readonly failures: Failure[]) {
    super(
      failures
        .map(
          (failure) =>
            `${failure.check}: expected ${JSON.stringify(failure.expected)}, got ${JSON.stringify(failure.actual)}`
        )
        .join("; ")
    );
    this.name = "HarnessValidationError";
  }
}

type Check = { name: string; ok: boolean; expected: unknown; actual: unknown };

function inspect(checks: Check[]) {
  const failures = checks
    .filter((check) => !check.ok)
    .map(({ name, expected, actual }) => ({ check: name, expected, actual }));
  if (failures.length > 0) throw new HarnessValidationError(failures);
}

export type OperationOutcome = {
  ok: boolean;
  status?: number;
  changed?: boolean;
};

export type ExpectedOutcome =
  | { outcome: "success"; changed?: boolean }
  | { outcome: "rejected"; status: number };

export type Transition = {
  fromStatus: string;
  toStatus: string;
  actorId: string;
};

export type LockEvidence = {
  blockerPid: number;
  baselineWaiters: number[];
  firstWaiters: number[];
  secondWaiters: number[];
};

export type LifecycleExpectation = {
  first: ExpectedOutcome;
  second: ExpectedOutcome;
  finalStatus: string;
  instructors?: number;
  transitions: Array<{ from: string; to: string }>;
};

function describeOutcome(outcome: OperationOutcome) {
  return outcome.ok
    ? { ok: true, changed: outcome.changed ?? null }
    : { ok: false, status: outcome.status ?? null };
}

function outcomeChecks(
  name: string,
  actual: OperationOutcome,
  expected: ExpectedOutcome
): Check[] {
  if (expected.outcome === "success") {
    const checks: Check[] = [
      {
        name: `${name}: outcome`,
        ok: actual.ok,
        expected: "success",
        actual: describeOutcome(actual),
      },
    ];
    if (expected.changed !== undefined) {
      checks.push({
        name: `${name}: changed`,
        ok: actual.changed === expected.changed,
        expected: expected.changed,
        actual: actual.changed ?? null,
      });
    }
    return checks;
  }

  return [
    {
      name: `${name}: outcome`,
      ok: !actual.ok,
      expected: { rejectedWithStatus: expected.status },
      actual: describeOutcome(actual),
    },
    {
      name: `${name}: rejection status`,
      ok: !actual.ok && actual.status === expected.status,
      expected: expected.status,
      actual: actual.status ?? null,
    },
  ];
}

/** Validates the blocker-scoped lock chain observed for one forced ordering. */
export function validateLockEvidence(lock: LockEvidence): void {
  const hasDuplicates = (pids: number[]) => new Set(pids).size !== pids.length;
  const duplicatePid = hasDuplicates(lock.firstWaiters) || hasDuplicates(lock.secondWaiters);

  inspect([
    {
      name: "lock: fixture blocker pid",
      ok: Number.isInteger(lock.blockerPid) && lock.blockerPid > 0,
      expected: "positive backend pid",
      actual: lock.blockerPid,
    },
    {
      name: "lock: baseline waiters before first operation",
      ok: lock.baselineWaiters.length === 0,
      expected: [],
      actual: lock.baselineWaiters,
    },
    {
      name: "lock: first operation queued as the only waiter",
      ok: lock.firstWaiters.length === 1,
      expected: 1,
      actual: lock.firstWaiters,
    },
    {
      name: "lock: second operation queued after the first",
      ok: lock.secondWaiters.length === 2,
      expected: 2,
      actual: lock.secondWaiters,
    },
    {
      name: "lock: first waiter stays in the chain",
      ok:
        lock.firstWaiters.length > 0 &&
        lock.firstWaiters.every((pid) => lock.secondWaiters.includes(pid)),
      expected: lock.firstWaiters,
      actual: lock.secondWaiters,
    },
    {
      name: "lock: distinct waiter backends",
      ok: !duplicatePid,
      expected: "no duplicate pids",
      actual: {
        firstWaiters: lock.firstWaiters,
        secondWaiters: lock.secondWaiters,
      },
    },
  ]);
}

/**
 * Validates one forced lifecycle ordering: outcome, final status, instructor
 * count, exact audit transition sequence, audit actor, and lock chain.
 */
export function validateLifecycleScenario(input: {
  name: string;
  first: OperationOutcome;
  second: OperationOutcome;
  finalStatus: string;
  instructors?: number;
  transitions: Transition[];
  actorId: string;
  lock: LockEvidence;
  expected: LifecycleExpectation;
}): void {
  validateLockEvidence(input.lock);

  const checks: Check[] = [
    ...outcomeChecks(`${input.name}: first`, input.first, input.expected.first),
    ...outcomeChecks(`${input.name}: second`, input.second, input.expected.second),
    {
      name: `${input.name}: final catalog status`,
      ok: input.finalStatus === input.expected.finalStatus,
      expected: input.expected.finalStatus,
      actual: input.finalStatus,
    },
    {
      name: `${input.name}: audit transition count`,
      ok: input.transitions.length === input.expected.transitions.length,
      expected: input.expected.transitions.length,
      actual: input.transitions.length,
    },
  ];

  if (input.expected.instructors !== undefined) {
    checks.push({
      name: `${input.name}: instructor count`,
      ok: input.instructors === input.expected.instructors,
      expected: input.expected.instructors,
      actual: input.instructors ?? null,
    });
  }

  const length = Math.max(input.transitions.length, input.expected.transitions.length);
  for (let index = 0; index < length; index += 1) {
    const actual = input.transitions[index];
    const expected = input.expected.transitions[index];
    checks.push({
      name: `${input.name}: transition ${index + 1}`,
      ok:
        Boolean(actual && expected) &&
        actual.fromStatus === expected.from &&
        actual.toStatus === expected.to,
      expected: expected ? `${expected.from}->${expected.to}` : null,
      actual: actual ? `${actual.fromStatus}->${actual.toStatus}` : null,
    });
    checks.push({
      name: `${input.name}: transition ${index + 1} actor`,
      ok: Boolean(actual) && actual.actorId === input.actorId,
      expected: input.actorId,
      actual: actual?.actorId ?? null,
    });
  }

  inspect(checks);
}

export type PreservedBefore = {
  enrollmentId: string;
  sessionId: string;
  materialId: string;
  materialContent: string | null;
  chatSessionId: string;
  messages: Array<{ id: string; content: string }>;
};

export type PreservedAfter = {
  enrollment: { id: string; isActive: boolean } | null;
  session: { id: string } | null;
  material: { id: string; textContent: string | null } | null;
  chatSession: { id: string } | null;
  messages: Array<{ id: string; content: string }>;
};

/** Validates that unpublish left every populated fixture row untouched. */
export function validatePreservation(
  before: PreservedBefore,
  after: PreservedAfter
): void {
  const afterById = new Map(after.messages.map((message) => [message.id, message.content]));
  const expectedIds = before.messages.map((message) => message.id);

  const messageChecks: Check[] = [];
  for (const message of before.messages) {
    messageChecks.push({
      name: `preservation: chat message ${message.id}`,
      ok: afterById.get(message.id) === message.content,
      expected: message.content,
      actual: afterById.get(message.id) ?? null,
    });
  }
  messageChecks.push({
    name: "preservation: chat message count",
    ok: after.messages.length === before.messages.length,
    expected: before.messages.length,
    actual: after.messages.length,
  });
  messageChecks.push({
    name: "preservation: unexpected chat messages",
    ok: after.messages.every((message) => expectedIds.includes(message.id)),
    expected: expectedIds,
    actual: after.messages.map((message) => message.id),
  });

  inspect([
    {
      name: "preservation: enrollment",
      ok:
        after.enrollment?.id === before.enrollmentId &&
        after.enrollment.isActive === true,
      expected: { id: before.enrollmentId, isActive: true },
      actual: after.enrollment,
    },
    {
      name: "preservation: course session",
      ok: after.session?.id === before.sessionId,
      expected: before.sessionId,
      actual: after.session?.id ?? null,
    },
    {
      name: "preservation: material",
      ok:
        after.material?.id === before.materialId &&
        after.material.textContent === before.materialContent,
      expected: { id: before.materialId, textContent: before.materialContent },
      actual: after.material
        ? { id: after.material.id, textContent: after.material.textContent }
        : null,
    },
    {
      name: "preservation: chat session",
      ok: after.chatSession?.id === before.chatSessionId,
      expected: before.chatSessionId,
      actual: after.chatSession?.id ?? null,
    },
    ...messageChecks,
  ]);
}

export type EndpointResult =
  | { status: "skipped"; reason: string }
  | { status: "error"; message: string }
  | {
      status: "checked";
      existingStudentCourse: number;
      existingStudentSessions: number;
      discoveryExcludes: boolean | null;
      otherStudentEnrollStatus: number;
    };

/** Validates post-unpublish endpoint authorization. Never treats failures as skipped. */
export function validateEndpoints(result: EndpointResult): void {
  if (result.status === "skipped") return;
  if (result.status === "error") {
    inspect([
      {
        name: "endpoints: request completed",
        ok: false,
        expected: "successful HTTP checks",
        actual: result.message,
      },
    ]);
    return;
  }

  inspect([
    {
      name: "endpoints: existing student course access",
      ok: result.existingStudentCourse === 200,
      expected: 200,
      actual: result.existingStudentCourse,
    },
    {
      name: "endpoints: existing student sessions access",
      ok: result.existingStudentSessions === 200,
      expected: 200,
      actual: result.existingStudentSessions,
    },
    {
      name: "endpoints: discovery excludes unpublished course",
      ok: result.discoveryExcludes === true,
      expected: true,
      actual: result.discoveryExcludes,
    },
    {
      name: "endpoints: other student self-enrollment rejected",
      ok:
        result.otherStudentEnrollStatus === 400 ||
        result.otherStudentEnrollStatus === 409,
      expected: [400, 409],
      actual: result.otherStudentEnrollStatus,
    },
  ]);
}

export type CleanupResult = {
  deletedCourses: number;
  expectedCourses: number;
  remainingFixtureCourses: number;
  error?: string;
};

/** Validates that only the fixtures were removed and none remain. */
export function validateCleanup(result: CleanupResult): void {
  inspect([
    {
      name: "cleanup: no error",
      ok: !result.error,
      expected: null,
      actual: result.error ?? null,
    },
    {
      name: "cleanup: deleted fixture courses",
      ok: result.deletedCourses === result.expectedCourses,
      expected: result.expectedCourses,
      actual: result.deletedCourses,
    },
    {
      name: "cleanup: no fixture courses remain",
      ok: result.remainingFixtureCourses === 0,
      expected: 0,
      actual: result.remainingFixtureCourses,
    },
  ]);
}
