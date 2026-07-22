import { describe, expect, it, vi } from "vitest";
import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import type { AggregatedAgent } from "@/hooks/use-aggregated-agents";
import { getChatHistorySourceKey } from "@/attachments/chat-history-identity";
import { exportSelectedTranscripts } from "@/components/add-transcripts-export";
import {
  getTranscriptExportSourceKey,
  type TranscriptExportSource,
} from "@/components/transcript-source";

function agent(overrides: Partial<AggregatedAgent>): AggregatedAgent {
  return {
    id: "agent-1",
    serverId: "host-a",
    serverLabel: "Host A",
    title: "Source agent",
    status: "idle",
    lastActivityAt: new Date("2026-07-18T10:00:00.000Z"),
    cwd: "/repos/paseo",
    workspaceId: "workspace-a",
    provider: "codex",
    pendingPermissionCount: 0,
    requiresAttention: false,
    attentionReason: null,
    attentionTimestamp: null,
    archivedAt: null,
    createdAt: new Date("2026-07-18T09:00:00.000Z"),
    labels: {},
    projectPlacement: null,
    ...overrides,
  };
}

function transcriptResponse(text: string, totalItemCount: number | null = 1) {
  return {
    requestId: "request-1",
    agentId: "agent-1",
    attachment: {
      type: "text" as const,
      mimeType: "text/plain" as const,
      contextKind: "chat_history" as const,
      title: "Chat history",
      text,
    },
    totalItemCount,
    includedItemCount: 1,
    byteCount: new TextEncoder().encode(text).length,
    truncated: totalItemCount === null,
    capturedCursor: { epoch: "timeline-1", seq: 10 },
    error: null,
  };
}

function paseoAgentSource(value: AggregatedAgent): TranscriptExportSource {
  return { kind: "paseo_agent", agent: value };
}

function providerSessionSource(): Extract<TranscriptExportSource, { kind: "provider_session" }> {
  return {
    kind: "provider_session",
    session: {
      serverId: "host-c",
      serverLabel: "Host C",
      providerId: "codex",
      providerLabel: "Codex",
      providerHandleId: "thread-c",
      cwd: "/repos/external",
      title: "External Codex task",
      firstPromptPreview: null,
      lastPromptPreview: "Review this change",
      lastActivityAt: "2026-07-18T11:00:00.000Z",
      supportsTranscriptExport: true,
    },
  };
}

const messages = {
  updateHost: "Update this host",
  unavailable: "Transcript unavailable",
  exportFailed: "Export failed",
  totalTooLarge: "Too large",
  maximumSelected: "Too many transcripts",
  attachmentTitle: (title: string) => `Transcript · ${title}`,
};

describe("exportSelectedTranscripts", () => {
  it("routes each source to its own host and preserves partial success", async () => {
    const sourceA = agent({ id: "agent-a", serverId: "host-a", title: "Alpha" });
    const sourceB = agent({ id: "agent-b", serverId: "host-b", title: "Beta" });
    const exportA = vi.fn(async () => transcriptResponse("[User] Alpha", null));
    const exportB = vi.fn(async () => {
      throw new Error("Host B disconnected");
    });
    const clients = new Map([
      ["host-a", { exportAgentTranscript: exportA }],
      ["host-b", { exportAgentTranscript: exportB }],
    ]);

    const result = await exportSelectedTranscripts({
      sources: [paseoAgentSource(sourceA), paseoAgentSource(sourceB)],
      existingAttachments: [],
      getClient: (serverId) =>
        (clients.get(serverId) as unknown as DaemonClient | undefined) ?? null,
      messages,
    });

    expect(exportA).toHaveBeenCalledWith({ agentId: "agent-a", maxBytes: 128 * 1024 });
    expect(exportB).toHaveBeenCalledWith({ agentId: "agent-b", maxBytes: 128 * 1024 });
    expect(result.attachments).toHaveLength(1);
    expect(result.attachments[0]).toMatchObject({
      id: "chat_history:host-a:agent-a",
      attachment: { title: "Transcript · Alpha", text: "[User] Alpha" },
      source: {
        serverId: "host-a",
        agentId: "agent-a",
        truncated: true,
        includedItemCount: 1,
      },
    });
    expect(result.attachments[0]?.source).not.toHaveProperty("itemCount");
    expect(result.successfulKeys).toEqual(
      new Set([getChatHistorySourceKey({ serverId: "host-a", agentId: "agent-a" })]),
    );
    expect(result.errorsBySource).toEqual({
      [getChatHistorySourceKey({ serverId: "host-b", agentId: "agent-b" })]: "Host B disconnected",
    });
  });

  it("reports a missing host without invoking another host's client", async () => {
    const source = agent({ id: "agent-c", serverId: "host-c" });

    const result = await exportSelectedTranscripts({
      sources: [paseoAgentSource(source)],
      existingAttachments: [],
      getClient: () => null,
      messages,
    });

    expect(result.attachments).toEqual([]);
    expect(result.errorsBySource).toEqual({
      [getChatHistorySourceKey({ serverId: "host-c", agentId: "agent-c" })]: "Update this host",
    });
  });

  it("enforces the five-transcript limit when a Fork transcript already exists", async () => {
    const existingSource = { serverId: "host-a", agentId: "fork-agent" };
    const sources = Array.from({ length: 5 }, (_, index) =>
      agent({ id: `agent-${index + 1}`, serverId: "host-a" }),
    );
    const exportAgentTranscript = vi.fn(async (input: { agentId: string }) =>
      transcriptResponse(`[Assistant] ${input.agentId}`),
    );

    const result = await exportSelectedTranscripts({
      sources: sources.map(paseoAgentSource),
      existingAttachments: [
        {
          kind: "chat_history",
          id: "chat_history:fork-draft",
          attachment: {
            type: "text",
            mimeType: "text/plain",
            contextKind: "chat_history",
            title: "Fork context",
            text: "[Assistant] Existing Fork context",
          },
          source: existingSource,
        },
      ],
      getClient: () => ({ exportAgentTranscript }) as unknown as DaemonClient,
      messages,
    });

    expect(exportAgentTranscript).toHaveBeenCalledTimes(4);
    expect(result.attachments).toHaveLength(4);
    expect(result.errorsBySource).toEqual({
      [getChatHistorySourceKey({ serverId: "host-a", agentId: "agent-5" })]: "Too many transcripts",
    });
  });

  it("exports a provider-native session without treating it as a Paseo agent", async () => {
    const source = providerSessionSource();
    const exportProviderSessionTranscript = vi.fn(async () => ({
      requestId: "request-c",
      providerId: "codex",
      providerHandleId: "thread-c",
      sourceCwd: "/repos/external",
      attachment: {
        type: "text" as const,
        mimeType: "text/plain" as const,
        contextKind: "chat_history" as const,
        title: "Chat history",
        text: "[User] Review this change",
      },
      totalItemCount: 1,
      includedItemCount: 1,
      byteCount: 25,
      truncated: false,
      error: null,
    }));

    const result = await exportSelectedTranscripts({
      sources: [source],
      existingAttachments: [],
      getClient: () =>
        ({
          exportAgentTranscript: vi.fn(),
          exportProviderSessionTranscript,
        }) as unknown as DaemonClient,
      messages,
    });

    expect(exportProviderSessionTranscript).toHaveBeenCalledWith({
      providerId: "codex",
      providerHandleId: "thread-c",
      sourceCwd: "/repos/external",
      maxBytes: 128 * 1024,
    });
    expect(result.attachments).toMatchObject([
      {
        id: "chat_history:provider_session:host-c:codex:thread-c:%2Frepos%2Fexternal",
        attachment: { title: "Transcript · External Codex task" },
        source: {
          kind: "provider_session",
          serverId: "host-c",
          providerId: "codex",
          providerHandleId: "thread-c",
          sourceCwd: "/repos/external",
        },
      },
    ]);
  });

  it("uses the daemon's canonical provider-session identity when refreshing an existing snapshot", async () => {
    const source = providerSessionSource();
    source.session.cwd = "/repos/symlink";
    const response = {
      requestId: "request-canonical",
      providerId: "codex",
      providerHandleId: "thread-c",
      sourceCwd: "/repos/physical",
      attachment: {
        type: "text" as const,
        mimeType: "text/plain" as const,
        contextKind: "chat_history" as const,
        title: "Chat history",
        text: "[Assistant] Canonical snapshot",
      },
      totalItemCount: 1,
      includedItemCount: 1,
      byteCount: 100 * 1024,
      truncated: false,
      error: null,
    };

    const result = await exportSelectedTranscripts({
      sources: [source],
      existingAttachments: [
        {
          kind: "chat_history",
          id: "chat_history:canonical-existing",
          attachment: {
            type: "text",
            mimeType: "text/plain",
            contextKind: "chat_history",
            title: "Previous snapshot",
            text: "[Assistant] Previous canonical snapshot",
          },
          source: {
            kind: "provider_session",
            serverId: "host-c",
            providerId: "codex",
            providerHandleId: "thread-c",
            sourceCwd: "/repos/physical",
            byteCount: 320 * 1024,
          },
        },
      ],
      getClient: () =>
        ({
          exportAgentTranscript: vi.fn(),
          exportProviderSessionTranscript: vi.fn(async () => response),
        }) as unknown as DaemonClient,
      messages,
    });

    expect(result.errorsBySource).toEqual({});
    expect(result.attachments).toMatchObject([
      {
        id: "chat_history:provider_session:host-c:codex:thread-c:%2Frepos%2Fphysical",
        source: { sourceCwd: "/repos/physical" },
      },
    ]);
    expect(result.successfulKeys).toEqual(new Set([getTranscriptExportSourceKey(source)]));
  });
});
