interface TimeoutOptions<T> {
  promise: Promise<T>;
  timeoutMs: number;
  label: string;
}

interface AbortTimeoutOptions<T> {
  run: (signal: AbortSignal) => Promise<T>;
  timeoutMs: number;
  message: string;
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T>;
export function withTimeout<T>(options: TimeoutOptions<T>): Promise<T>;
export function withTimeout<T>(
  promiseOrOptions: Promise<T> | TimeoutOptions<T>,
  timeoutMs?: number,
  message?: string,
): Promise<T> {
  const options =
    typeof timeoutMs === "number"
      ? { promise: promiseOrOptions as Promise<T>, timeoutMs, message }
      : resolveTimeoutOptions(promiseOrOptions as TimeoutOptions<T>);

  if (typeof options.timeoutMs !== "number" || !options.message) {
    return Promise.reject(new Error("Timeout duration and message are required"));
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(options.message)), options.timeoutMs);
  });

  return Promise.race([options.promise, timeoutPromise]).finally(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
}

/**
 * Bounds a request whose underlying transport supports AbortSignal. Unlike a
 * Promise.race-only timeout, this actively cancels fetch-backed work before
 * returning capacity to the caller.
 */
export async function withAbortTimeout<T>(options: AbortTimeoutOptions<T>): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const request = Promise.resolve().then(async () => await options.run(controller.signal));
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
      reject(new Error(options.message));
    }, options.timeoutMs);
  });

  try {
    return await Promise.race([request, timeoutPromise]);
  } catch (error) {
    if (timedOut) {
      throw new Error(options.message, { cause: error });
    }
    throw error;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function resolveTimeoutOptions<T>(options: TimeoutOptions<T>): {
  promise: Promise<T>;
  timeoutMs: number;
  message: string;
} {
  return {
    promise: options.promise,
    timeoutMs: options.timeoutMs,
    message: `Timed out after ${options.timeoutMs}ms (${options.label})`,
  };
}
