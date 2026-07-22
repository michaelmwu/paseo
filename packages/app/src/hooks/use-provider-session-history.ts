import type {
  DaemonClient,
  FetchRecentProviderSessionEntry,
} from "@getpaseo/client/internal/daemon-client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useFetchQuery } from "@/data/query";
import type { AgentHistoryUnavailableHost } from "@/hooks/use-agent-history";
import { getHostRuntimeStore, isHostRuntimeConnected, useHosts } from "@/runtime/host-runtime";

const PROVIDER_SESSION_HISTORY_LIMIT = 100;

export interface AggregatedProviderSession extends FetchRecentProviderSessionEntry {
  serverId: string;
  serverLabel: string;
}

export interface ProviderSessionHistoryHost {
  serverId: string;
  serverLabel: string;
  client: Pick<DaemonClient, "fetchRecentProviderSessions">;
}

export interface ProviderSessionHistoryResult {
  entries: AggregatedProviderSession[];
  unavailableHosts: readonly AgentHistoryUnavailableHost[];
  isLoading: boolean;
  isInitialLoad: boolean;
  isError: boolean;
  refresh: () => Promise<void>;
}

export async function fetchProviderSessionHistory(input: {
  hosts: readonly ProviderSessionHistoryHost[];
}): Promise<{ entries: AggregatedProviderSession[]; failedHostIds: string[] }> {
  const settled = await Promise.allSettled(
    input.hosts.map(async (host) => {
      const payload = await host.client.fetchRecentProviderSessions({
        limit: PROVIDER_SESSION_HISTORY_LIMIT,
        transcriptOnly: true,
      });
      const entries: AggregatedProviderSession[] = [];
      for (const entry of payload.entries) {
        entries.push(
          Object.assign({}, entry, {
            serverId: host.serverId,
            serverLabel: host.serverLabel,
          }),
        );
      }
      return {
        host,
        entries,
      };
    }),
  );
  const entries: AggregatedProviderSession[] = [];
  const failedHostIds: string[] = [];
  for (const [index, result] of settled.entries()) {
    if (result.status === "fulfilled") {
      entries.push(...result.value.entries);
      continue;
    }
    const host = input.hosts[index];
    if (host) {
      failedHostIds.push(host.serverId);
    }
  }
  entries.sort(
    (left, right) =>
      new Date(right.lastActivityAt).getTime() - new Date(left.lastActivityAt).getTime(),
  );
  return { entries, failedHostIds };
}

/**
 * Lists provider-native sessions from every connected host without importing
 * or waking any source session. The daemon owns provider-store discovery;
 * this hook only aggregates the typed rows for the transcript picker.
 */
export function useProviderSessionHistory(
  options: { enabled?: boolean } = {},
): ProviderSessionHistoryResult {
  const daemons = useHosts();
  const runtime = getHostRuntimeStore();
  const runtimeVersion = useSyncExternalStore(
    (onStoreChange) => runtime.subscribeAll(onStoreChange),
    () => runtime.getVersion(),
    () => runtime.getVersion(),
  );
  const enabled = options.enabled ?? true;
  const hosts = useMemo(() => {
    void runtimeVersion;
    const result: ProviderSessionHistoryHost[] = [];
    for (const daemon of daemons) {
      const client = runtime.getClient(daemon.serverId);
      if (!client || !isHostRuntimeConnected(runtime.getSnapshot(daemon.serverId))) {
        continue;
      }
      result.push({
        serverId: daemon.serverId,
        serverLabel: daemon.label,
        client,
      });
    }
    return result;
  }, [daemons, runtime, runtimeVersion]);
  const hostIds = useMemo(() => hosts.map((host) => host.serverId), [hosts]);
  const query = useFetchQuery({
    queryKey: ["provider-session-history", hostIds] as const,
    enabled: enabled && hosts.length > 0,
    dataShape: "list",
    staleTimeMs: 30_000,
    queryFn: async () => await fetchProviderSessionHistory({ hosts }),
  });
  const refresh = useCallback(async () => {
    if (!enabled || hosts.length === 0) {
      return;
    }
    await query.refetch();
  }, [enabled, hosts.length, query]);
  const entries = query.data?.entries ?? [];
  const unavailableHosts = useMemo<AgentHistoryUnavailableHost[]>(() => {
    void runtimeVersion;
    const unavailableByServerId = new Map<string, AgentHistoryUnavailableHost>();
    for (const daemon of daemons) {
      if (!isHostRuntimeConnected(runtime.getSnapshot(daemon.serverId))) {
        unavailableByServerId.set(daemon.serverId, {
          serverId: daemon.serverId,
          serverLabel: daemon.label,
          reason: "disconnected",
        });
      }
    }
    for (const serverId of query.data?.failedHostIds ?? []) {
      if (unavailableByServerId.has(serverId)) {
        continue;
      }
      const daemon = daemons.find((entry) => entry.serverId === serverId);
      unavailableByServerId.set(serverId, {
        serverId,
        serverLabel: daemon?.label ?? serverId,
        reason: "history_failed",
      });
    }
    return [...unavailableByServerId.values()];
  }, [daemons, query.data?.failedHostIds, runtime, runtimeVersion]);

  return {
    entries,
    unavailableHosts,
    isLoading: query.isLoading,
    isInitialLoad: query.isLoading && entries.length === 0,
    isError: query.isError,
    refresh,
  };
}
