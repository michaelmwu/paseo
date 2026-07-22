import type { AggregatedAgent } from "@/hooks/use-aggregated-agents";
import type { AggregatedProviderSession } from "@/hooks/use-provider-session-history";
import {
  getChatHistorySourceKey,
  type ChatHistorySourceIdentity,
} from "@/attachments/chat-history-identity";

export type TranscriptExportSource =
  | { kind: "paseo_agent"; agent: AggregatedAgent }
  | { kind: "provider_session"; session: AggregatedProviderSession };

/**
 * A picker row can be unavailable because its host predates the export RPC, or
 * because this particular provider cannot read a native session safely. Keep
 * those cases distinct: updating a current host cannot add an adapter that
 * Paseo does not implement.
 */
export type TranscriptSourceExportAvailability =
  | "available"
  | "host_upgrade_required"
  | "source_unavailable";

export function getTranscriptSourceExportAvailability(
  source: TranscriptExportSource,
  hostSupportsTranscriptExport: boolean | undefined,
): TranscriptSourceExportAvailability {
  if (hostSupportsTranscriptExport !== true) {
    return "host_upgrade_required";
  }
  if (source.kind === "provider_session" && source.session.supportsTranscriptExport !== true) {
    return "source_unavailable";
  }
  return "available";
}

export function getTranscriptExportSourceIdentity(
  source: TranscriptExportSource,
): ChatHistorySourceIdentity {
  if (source.kind === "provider_session") {
    return {
      kind: source.kind,
      serverId: source.session.serverId,
      providerId: source.session.providerId,
      providerHandleId: source.session.providerHandleId,
      sourceCwd: source.session.cwd,
    };
  }
  return {
    serverId: source.agent.serverId,
    agentId: source.agent.id,
  };
}

export function getTranscriptExportSourceKey(source: TranscriptExportSource): string {
  return getChatHistorySourceKey(getTranscriptExportSourceIdentity(source));
}

export function getTranscriptExportSourceTitle(source: TranscriptExportSource): string {
  if (source.kind === "provider_session") {
    return (
      source.session.title?.trim() ||
      source.session.lastPromptPreview?.trim() ||
      source.session.firstPromptPreview?.trim() ||
      source.session.cwd
    );
  }
  return (
    source.agent.title?.trim() ||
    source.agent.projectPlacement?.workspaceName?.trim() ||
    source.agent.cwd ||
    source.agent.id
  );
}

export function getTranscriptExportSourceWorkspaceLabel(source: TranscriptExportSource): string {
  return source.kind === "provider_session"
    ? source.session.cwd
    : source.agent.projectPlacement?.workspaceName?.trim() || source.agent.cwd;
}

export function getTranscriptExportSourceServerId(source: TranscriptExportSource): string {
  return source.kind === "provider_session" ? source.session.serverId : source.agent.serverId;
}

export function getTranscriptExportSourceServerLabel(source: TranscriptExportSource): string {
  return source.kind === "provider_session" ? source.session.serverLabel : source.agent.serverLabel;
}

export function getTranscriptExportSourceProvider(source: TranscriptExportSource): string {
  return source.kind === "provider_session" ? source.session.providerId : source.agent.provider;
}

export function getTranscriptExportSourceLastActivity(source: TranscriptExportSource): Date {
  return source.kind === "provider_session"
    ? new Date(source.session.lastActivityAt)
    : source.agent.lastActivityAt;
}
