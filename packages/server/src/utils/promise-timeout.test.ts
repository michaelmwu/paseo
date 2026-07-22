import { describe, expect, it, vi } from "vitest";
import { withAbortTimeout } from "./promise-timeout.js";

describe("withAbortTimeout", () => {
  it("aborts fetch-backed work before releasing the caller on timeout", async () => {
    vi.useFakeTimers();
    try {
      let receivedSignal: AbortSignal | undefined;
      const result = withAbortTimeout({
        timeoutMs: 10,
        message: "provider request timed out",
        run: async (signal) => {
          receivedSignal = signal;
          return await new Promise<never>((_resolve, reject) => {
            signal.addEventListener("abort", () => reject(new Error("request aborted")), {
              once: true,
            });
          });
        },
      });
      const rejection = expect(result).rejects.toThrow("provider request timed out");

      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(10);

      await rejection;
      expect(receivedSignal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
