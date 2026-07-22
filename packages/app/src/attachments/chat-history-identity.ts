/** A Paseo-managed source agent. `kind` is absent in V1 persisted drafts. */
export interface PaseoAgentChatHistorySourceIdentity {
  kind?: "paseo_agent";
  serverId: string;
  agentId: string;
}

/** A provider-native session that has never been adopted by Paseo. */
export interface ProviderSessionChatHistorySourceIdentity {
  kind: "provider_session";
  serverId: string;
  providerId: string;
  providerHandleId: string;
  sourceCwd: string;
}

export type ChatHistorySourceIdentity =
  | PaseoAgentChatHistorySourceIdentity
  | ProviderSessionChatHistorySourceIdentity;

/** Stable source identity for maps and sets. */
export function getChatHistorySourceKey(source: ChatHistorySourceIdentity): string {
  if (source.kind === "provider_session") {
    return JSON.stringify([
      source.kind,
      source.serverId,
      source.providerId,
      source.providerHandleId,
      source.sourceCwd,
    ]);
  }
  // Keep V1 agent keys stable so in-memory selection and existing attachment
  // bookkeeping keep referring to the same source identity after this union
  // gained provider-native sessions.
  return JSON.stringify([source.serverId, source.agentId]);
}

export function areChatHistorySourcesEqual(
  left: ChatHistorySourceIdentity,
  right: ChatHistorySourceIdentity,
): boolean {
  return getChatHistorySourceKey(left) === getChatHistorySourceKey(right);
}

/** Stable draft attachment identity for a source session. */
export function buildChatHistoryAttachmentId(source: ChatHistorySourceIdentity): string {
  if (source.kind === "provider_session") {
    return [
      "chat_history",
      source.kind,
      encodeURIComponent(source.serverId),
      encodeURIComponent(source.providerId),
      encodeURIComponent(source.providerHandleId),
      encodeURIComponent(source.sourceCwd),
    ].join(":");
  }
  return `chat_history:${source.serverId}:${source.agentId}`;
}
