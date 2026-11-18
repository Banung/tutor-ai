/**
 * Pure validators shared by the FR-003 live harness and its DB-free tests.
 * Nothing here touches the network or a database.
 */

export function settle<T>(promise: Promise<T>): Promise<PromiseSettledResult<T>> {
  return promise.then(
    (value): PromiseSettledResult<T> => ({ status: "fulfilled", value }),
    (reason): PromiseSettledResult<T> => ({ status: "rejected", reason })
  );
}

/**
 * Note: a timeout only stops *waiting*. It does not cancel the underlying
 * operation. Callers must not treat a timeout as confirmed settlement.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Asserts exactly one first waiter, then exactly two distinct waiters with the
 * first still queued. This is what proves the observed lock ordering.
 */
export function validateWaiters(first: number[], second: number[]): void {
  if (first.length !== 1) {
    throw new Error(`expected exactly one first waiter, got ${JSON.stringify(first)}`);
  }
  if (second.length !== 2) {
    throw new Error(`expected exactly two waiters, got ${JSON.stringify(second)}`);
  }
  if (new Set(second).size !== second.length) {
    throw new Error(`duplicate waiter PIDs ${JSON.stringify(second)}`);
  }
  if (!second.includes(first[0])) {
    throw new Error(
      `first waiter ${first[0]} was not retained: ${JSON.stringify(second)}`
    );
  }
  if (second.filter((pid) => pid !== first[0]).length !== 1) {
    throw new Error(`expected exactly one new waiter: ${JSON.stringify(second)}`);
  }
}

export function cleanupFailureMessage(input: {
  remainingFixtures: number;
  error: string | null;
  baselineUsers: number;
  usersAfterCleanup: number;
}): string | null {
  if (input.remainingFixtures !== 0 || input.error) {
    return `cleanup failed: ${JSON.stringify(input)}`;
  }
  if (
    input.baselineUsers >= 0 &&
    input.usersAfterCleanup !== input.baselineUsers
  ) {
    return `existing user count changed: ${input.baselineUsers} -> ${input.usersAfterCleanup}`;
  }
  return null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export type PairSafety = {
  /** The blocker transaction was released (commit or rollback succeeded). */
  blockerReleased: boolean;
  /** A failed commit leaves the transaction outcome unknown. */
  releaseUncertain: boolean;
  /** Every started operation settled before the drain deadline. */
  operationsSettled: boolean;
  /** Original failure plus any release/drain failures, all retained. */
  failures: string[];
  cleanupSafe: boolean;
};

export class LockPairError extends Error {
  constructor(
    message: string,
    readonly safety: PairSafety,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = "LockPairError";
  }
}

/**
 * Runs a blocker-confirmed pair: begin+lock, start first, confirm its waiter,
 * start second, confirm both distinct waiters, then release. On any failure it
 * attempts rollback and a bounded drain, records every failure, and reports
 * whether fixture deletion is safe. It never hides an unresolved operation.
 */
export async function runLockedPairSafely<T, U>(hooks: {
  begin: () => Promise<void>;
  release: () => Promise<void>;
  rollback: () => Promise<void>;
  first: () => Promise<T>;
  second: () => Promise<U>;
  waitFirst: () => Promise<number[]>;
  waitSecond: () => Promise<number[]>;
  validate: (first: number[], second: number[]) => void;
  settleTimeoutMs: number;
}): Promise<{
  first: PromiseSettledResult<T>;
  second: PromiseSettledResult<U>;
  waiters: { first: number[]; second: number[] };
  safety: PairSafety;
}> {
  const failures: string[] = [];
  const started: Array<Promise<PromiseSettledResult<unknown>>> = [];
  let blockerReleased = false;
  let releaseUncertain = false;
  let operationsSettled = false;

  try {
    await hooks.begin();

    const firstSettled = settle(hooks.first());
    started.push(firstSettled);
    const firstWaiters = await hooks.waitFirst();

    const secondSettled = settle(hooks.second());
    started.push(secondSettled);
    const secondWaiters = await hooks.waitSecond();
    hooks.validate(firstWaiters, secondWaiters);

    try {
      await hooks.release();
      blockerReleased = true;
    } catch (error) {
      releaseUncertain = true;
      failures.push(`blocker release failed: ${errorMessage(error)}`);
      throw error;
    }

    try {
      await withTimeout(
        Promise.all(started),
        hooks.settleTimeoutMs,
        "locked pair settle"
      );
      operationsSettled = true;
    } catch (error) {
      failures.push(`operation settlement failed: ${errorMessage(error)}`);
      throw error;
    }

    const [first, second] = await Promise.all([firstSettled, secondSettled]);
    return {
      first: first as PromiseSettledResult<T>,
      second: second as PromiseSettledResult<U>,
      waiters: { first: firstWaiters, second: secondWaiters },
      safety: {
        blockerReleased,
        releaseUncertain,
        operationsSettled,
        failures,
        cleanupSafe: blockerReleased && operationsSettled && !releaseUncertain,
      },
    };
  } catch (original) {
    const originalMessage = errorMessage(original);
    if (!failures.includes(originalMessage)) {
      failures.push(`operation failed: ${originalMessage}`);
    }

    if (!blockerReleased) {
      try {
        await hooks.rollback();
        blockerReleased = true;
      } catch (error) {
        failures.push(`blocker rollback failed: ${errorMessage(error)}`);
      }
    }

    if (!operationsSettled) {
      try {
        await withTimeout(
          Promise.allSettled(started),
          hooks.settleTimeoutMs,
          "locked pair drain"
        );
        operationsSettled = true;
      } catch (error) {
        failures.push(`operation drain failed: ${errorMessage(error)}`);
      }
    }

    const safety: PairSafety = {
      blockerReleased,
      releaseUncertain,
      operationsSettled,
      failures,
      cleanupSafe: blockerReleased && operationsSettled && !releaseUncertain,
    };
    throw new LockPairError(originalMessage, safety, original);
  }
}

export type CleanupDecision =
  | { allowed: true; reason: null }
  | { allowed: false; reason: string };

/** Fixture deletion is allowed only when every pair confirmed release+drain. */
export function cleanupDecision(safeties: PairSafety[]): CleanupDecision {
  const unsafe = safeties.filter((safety) => !safety.cleanupSafe);
  if (unsafe.length === 0) {
    return { allowed: true, reason: null };
  }
  const reason = unsafe
    .flatMap((safety) => safety.failures)
    .filter(Boolean)
    .join("; ");
  return {
    allowed: false,
    reason:
      reason ||
      "blocker release or operation settlement was not confirmed",
  };
}

/**
 * Deletes fixtures only after the safety gate passes. A deferred decision
 * leaves fixtures untouched and must be reported as a failure, never success.
 */
export async function runSafeCleanup(
  safeties: PairSafety[],
  cleanup: () => Promise<void>
): Promise<{ ran: boolean; decision: CleanupDecision }> {
  const decision = cleanupDecision(safeties);
  if (!decision.allowed) return { ran: false, decision };
  await cleanup();
  return { ran: true, decision };
}
