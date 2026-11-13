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
