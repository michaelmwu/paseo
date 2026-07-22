import { describe, expect, it, vi } from "vitest";
import { fetchProviderSessionHistory } from "@/hooks/use-provider-session-history";

describe("fetchProviderSessionHistory", () => {
  it("aggregates rows by host, sorts them by activity, and retains partial failures", async () => {
    const fetchHostA = vi.fn(async () => ({
      requestId: "a",
      entries: [
        {
          providerId: "codex",
          providerLabel: "Codex",
          providerHandleId: "older",
          cwd: "/repos/a",
          title: "Older",
          firstPromptPreview: null,
          lastPromptPreview: null,
          lastActivityAt: "2026-07-18T09:00:00.000Z",
        },
      ],
    }));
    const result = await fetchProviderSessionHistory({
      hosts: [
        {
          serverId: "host-a",
          serverLabel: "MacBook",
          client: {
            fetchRecentProviderSessions: fetchHostA,
          },
        },
        {
          serverId: "host-b",
          serverLabel: "Minibox",
          client: {
            fetchRecentProviderSessions: async () => ({
              requestId: "b",
              entries: [
                {
                  providerId: "claude",
                  providerLabel: "Claude",
                  providerHandleId: "newer",
                  cwd: "/repos/b",
                  title: "Newer",
                  firstPromptPreview: null,
                  lastPromptPreview: null,
                  lastActivityAt: "2026-07-18T10:00:00.000Z",
                },
              ],
            }),
          },
        },
        {
          serverId: "host-c",
          serverLabel: "Offline",
          client: {
            fetchRecentProviderSessions: async () => {
              throw new Error("disconnected");
            },
          },
        },
      ],
    });

    expect(result.entries).toEqual([
      expect.objectContaining({
        providerHandleId: "newer",
        serverId: "host-b",
        serverLabel: "Minibox",
      }),
      expect.objectContaining({
        providerHandleId: "older",
        serverId: "host-a",
        serverLabel: "MacBook",
      }),
    ]);
    expect(result.failedHostIds).toEqual(["host-c"]);
    expect(fetchHostA).toHaveBeenCalledWith({ limit: 100, transcriptOnly: true });
  });
});
