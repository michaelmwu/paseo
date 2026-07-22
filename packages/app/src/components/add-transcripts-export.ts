import type { DaemonClient } from "@getpaseo/client/internal/daemon-client";
import type { AgentAttachment } from "@getpaseo/protocol/messages";
import {
  buildChatHistoryAttachmentId,
  getChatHistorySourceKey,
  type ChatHistorySourceIdentity,
} from "@/attachments/chat-history-identity";
import type { ChatHistoryContextAttachment } from "@/attachments/types";
import {
  getTranscriptExportSourceIdentity,
  getTranscriptExportSourceKey,
  getTranscriptExportSourceServerId,
  getTranscriptExportSourceServerLabel,
  getTranscriptExportSourceTitle,
  getTranscriptExportSourceWorkspaceLabel,
  type TranscriptExportSource,
} from "@/components/transcript-source";
import {
  MAX_DRAFT_TRANSCRIPT_BYTES,
  MAX_TRANSCRIPT_ATTACHMENTS,
  MAX_TRANSCRIPT_BYTES,
  selectTranscriptCandidatesWithinLimit,
  settleWithConcurrency,
  textByteLength,
  TRANSCRIPT_EXPORT_CONCURRENCY,
} from "@/components/add-transcripts-sheet-view-model";

type TranscriptExportClient = Pick<
  DaemonClient,
  "exportAgentTranscript" | "exportProviderSessionTranscript"
>;
type TextAgentAttachment = Extract<AgentAttachment, { type: "text" }>;

interface SuccessfulTranscriptExport {
  /** The daemon revalidates and canonicalizes provider-native source identity. */
  identity: ChatHistorySourceIdentity;
  attachment: TextAgentAttachment;
  totalItemCount: number | null;
  includedItemCount: number;
  byteCount: number;
  truncated: boolean;
  capturedCursor?: { epoch: string; seq: number } | null;
}

export interface AddTranscriptsExportMessages {
  updateHost: string;
  unavailable: string;
  exportFailed: string;
  totalTooLarge: string;
  maximumSelected: string;
  attachmentTitle: (sourceTitle: string) => string;
}

export interface AddTranscriptsExportResult {
  attachments: ChatHistoryContextAttachment[];
  errorsBySource: Record<string, string>;
  successfulKeys: Set<string>;
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;
}

function resolveTranscriptByteCount(input: { text: string; reportedByteCount?: number }): number {
  return Math.max(input.reportedByteCount ?? 0, textByteLength(input.text));
}

function getExistingByteCount(
  attachments: readonly ChatHistoryContextAttachment[],
): Map<string, number> {
  return new Map(
    attachments.map((attachment) => [
      getChatHistorySourceKey(attachment.source),
      resolveTranscriptByteCount({
        text: attachment.attachment.text,
        reportedByteCount: attachment.source.byteCount,
      }),
    ]),
  );
}

function resolveTranscriptExportClient(value: DaemonClient | null): TranscriptExportClient | null {
  return value && typeof value.exportAgentTranscript === "function" ? value : null;
}

async function exportTranscriptSource(input: {
  source: TranscriptExportSource;
  getClient: (serverId: string) => DaemonClient | null;
  messages: Pick<AddTranscriptsExportMessages, "unavailable" | "updateHost">;
}): Promise<SuccessfulTranscriptExport> {
  const { source } = input;
  const client = resolveTranscriptExportClient(
    input.getClient(getTranscriptExportSourceServerId(source)),
  );
  if (!client) {
    throw new Error(input.messages.updateHost);
  }
  if (source.kind === "provider_session") {
    if (typeof client.exportProviderSessionTranscript !== "function") {
      throw new Error(input.messages.updateHost);
    }
    const response = await client.exportProviderSessionTranscript({
      providerId: source.session.providerId,
      providerHandleId: source.session.providerHandleId,
      sourceCwd: source.session.cwd,
      maxBytes: MAX_TRANSCRIPT_BYTES,
    });
    if (!response.attachment) {
      throw new Error(response.error ?? input.messages.unavailable);
    }
    return {
      identity: {
        kind: "provider_session",
        serverId: getTranscriptExportSourceServerId(source),
        providerId: response.providerId,
        providerHandleId: response.providerHandleId,
        sourceCwd: response.sourceCwd,
      },
      attachment: response.attachment,
      totalItemCount: response.totalItemCount,
      includedItemCount: response.includedItemCount,
      byteCount: response.byteCount,
      truncated: response.truncated,
    };
  }

  const response = await client.exportAgentTranscript({
    agentId: source.agent.id,
    maxBytes: MAX_TRANSCRIPT_BYTES,
  });
  if (!response.attachment) {
    throw new Error(response.error ?? input.messages.unavailable);
  }
  return {
    identity: getTranscriptExportSourceIdentity(source),
    attachment: response.attachment,
    totalItemCount: response.totalItemCount,
    includedItemCount: response.includedItemCount,
    byteCount: response.byteCount,
    truncated: response.truncated,
    capturedCursor: response.capturedCursor,
  };
}

function selectAdmittedTranscriptSources(input: {
  sources: readonly TranscriptExportSource[];
  existingAttachments: readonly ChatHistoryContextAttachment[];
  maximumSelected: string;
  errorsBySource: Record<string, string>;
}): TranscriptExportSource[] {
  const admittedSourceKeys = new Set(
    input.existingAttachments.map((attachment) => getChatHistorySourceKey(attachment.source)),
  );
  const queuedSourceKeys = new Set<string>();
  return input.sources.filter((source) => {
    const key = getTranscriptExportSourceKey(source);
    if (queuedSourceKeys.has(key)) {
      return false;
    }
    queuedSourceKeys.add(key);
    if (!admittedSourceKeys.has(key) && admittedSourceKeys.size >= MAX_TRANSCRIPT_ATTACHMENTS) {
      input.errorsBySource[key] = input.maximumSelected;
      return false;
    }
    admittedSourceKeys.add(key);
    return true;
  });
}

function collectValidTranscriptExports(input: {
  sources: readonly TranscriptExportSource[];
  results: readonly PromiseSettledResult<SuccessfulTranscriptExport>[];
  errorsBySource: Record<string, string>;
  messages: Pick<AddTranscriptsExportMessages, "exportFailed" | "totalTooLarge">;
}): Map<string, { value: SuccessfulTranscriptExport; byteCount: number }> {
  const validExportsByKey = new Map<
    string,
    { value: SuccessfulTranscriptExport; byteCount: number }
  >();
  for (const [index, result] of input.results.entries()) {
    const source = input.sources[index];
    if (!source) {
      continue;
    }
    const key = getTranscriptExportSourceKey(source);
    if (result.status === "rejected") {
      input.errorsBySource[key] = resolveErrorMessage(result.reason, input.messages.exportFailed);
      continue;
    }
    const byteCount = resolveTranscriptByteCount({
      text: result.value.attachment.text,
      reportedByteCount: result.value.byteCount,
    });
    if (byteCount > MAX_TRANSCRIPT_BYTES) {
      input.errorsBySource[key] = input.messages.totalTooLarge;
      continue;
    }
    validExportsByKey.set(key, { value: result.value, byteCount });
  }
  return validExportsByKey;
}

/**
 * Export selected sources before mutating the draft. Results stay source-keyed
 * so one host failure cannot discard successful snapshots from other hosts.
 */
export async function exportSelectedTranscripts(input: {
  sources: readonly TranscriptExportSource[];
  existingAttachments: readonly ChatHistoryContextAttachment[];
  getClient: (serverId: string) => DaemonClient | null;
  messages: AddTranscriptsExportMessages;
}): Promise<AddTranscriptsExportResult> {
  const errorsBySource: Record<string, string> = {};
  const sources = selectAdmittedTranscriptSources({
    sources: input.sources,
    existingAttachments: input.existingAttachments,
    maximumSelected: input.messages.maximumSelected,
    errorsBySource,
  });
  const results = await settleWithConcurrency({
    values: sources,
    limit: TRANSCRIPT_EXPORT_CONCURRENCY,
    task: (source) =>
      exportTranscriptSource({
        source,
        getClient: input.getClient,
        messages: input.messages,
      }),
  });

  const validExportsByKey = collectValidTranscriptExports({
    sources,
    results,
    errorsBySource,
    messages: input.messages,
  });

  const candidateSourceKeysByIdentityKey = new Map<string, string[]>();
  const candidates = [] as Array<{ key: string; byteCount: number }>;
  for (const source of sources) {
    const sourceKey = getTranscriptExportSourceKey(source);
    const validExport = validExportsByKey.get(sourceKey);
    if (!validExport) {
      continue;
    }
    const identityKey = getChatHistorySourceKey(validExport.value.identity);
    const sourceKeys = candidateSourceKeysByIdentityKey.get(identityKey);
    if (sourceKeys) {
      sourceKeys.push(sourceKey);
      continue;
    }
    candidateSourceKeysByIdentityKey.set(identityKey, [sourceKey]);
    candidates.push({ key: identityKey, byteCount: validExport.byteCount });
  }
  const sizePlan = selectTranscriptCandidatesWithinLimit({
    existingByteCountBySource: getExistingByteCount(input.existingAttachments),
    candidates,
    maxBytes: MAX_DRAFT_TRANSCRIPT_BYTES,
  });
  for (const identityKey of sizePlan.rejectedKeys) {
    for (const sourceKey of candidateSourceKeysByIdentityKey.get(identityKey) ?? []) {
      errorsBySource[sourceKey] = input.messages.totalTooLarge;
    }
  }

  const attachments: ChatHistoryContextAttachment[] = [];
  const successfulKeys = new Set<string>();
  const addedAttachmentSourceKeys = new Set<string>();
  for (const source of sources) {
    const sourceKey = getTranscriptExportSourceKey(source);
    const validExport = validExportsByKey.get(sourceKey);
    if (!validExport) {
      continue;
    }
    const identity = validExport.value.identity;
    const identityKey = getChatHistorySourceKey(identity);
    if (!sizePlan.acceptedKeys.has(identityKey)) {
      continue;
    }
    successfulKeys.add(sourceKey);
    if (addedAttachmentSourceKeys.has(identityKey)) {
      continue;
    }
    addedAttachmentSourceKeys.add(identityKey);
    attachments.push({
      kind: "chat_history",
      id: buildChatHistoryAttachmentId(identity),
      attachment: {
        ...validExport.value.attachment,
        title: input.messages.attachmentTitle(getTranscriptExportSourceTitle(source)),
      },
      source: {
        ...identity,
        workspaceLabel: getTranscriptExportSourceWorkspaceLabel(source),
        serverLabel:
          getTranscriptExportSourceServerLabel(source).trim() ||
          getTranscriptExportSourceServerId(source),
        ...(source.kind === "paseo_agent" && source.agent.status === "running"
          ? { capturedWhileRunning: true }
          : {}),
        ...(source.kind === "paseo_agent"
          ? { boundaryCursor: validExport.value.capturedCursor ?? null }
          : {}),
        ...(validExport.value.totalItemCount === null
          ? {}
          : { itemCount: validExport.value.totalItemCount }),
        includedItemCount: validExport.value.includedItemCount,
        byteCount: validExport.byteCount,
        truncated: validExport.value.truncated,
      },
    });
  }

  return { attachments, errorsBySource, successfulKeys };
}
