/** A total deadline, including stream setup and every read, not just HTTP headers. */
export function createDeadline(timeoutMs: number, parent?: AbortSignal) {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort(parent?.reason);
  if (parent?.aborted) abortFromParent();
  else parent?.addEventListener("abort", abortFromParent, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException("Gemini request timed out", "TimeoutError")), timeoutMs);

  return {
    signal: controller.signal,
    async run<T>(operation: Promise<T>): Promise<T> {
      let onAbort: () => void = () => {};
      const aborted = new Promise<never>((_, reject) => {
        onAbort = () => reject(controller.signal.reason);
        if (controller.signal.aborted) onAbort();
        else controller.signal.addEventListener("abort", onAbort, { once: true });
      });
      try {
        return await Promise.race([operation, aborted]);
      } finally {
        controller.signal.removeEventListener("abort", onAbort);
      }
    },
    dispose() {
      clearTimeout(timer);
      parent?.removeEventListener("abort", abortFromParent);
      controller.abort();
    },
  };
}
