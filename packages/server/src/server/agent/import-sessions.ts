import type { z } from "zod";
import type { Logger } from "pino";
import pLimit from "p-limit";
import type { ProviderSnapshotManager } from "./provider-snapshot-manager.js";
import type {
  AgentManager,
  ManagedAgent,
  ManagedImportableProviderSession,
} from "./agent-manager.js";
import type { AgentStorage, StoredAgentRecord } from "./agent-storage.js";
import type { AgentPersistenceHandle, AgentProvider } from "./agent-sdk-types.js";
import { ensureAgentLoaded, type AgentLoaderManager } from "./agent-loading.js";
import { unarchiveAgentState } from "./agent-prompt.js";
import { toRecentProviderSessionDescriptorPayload } from "./agent-projections.js";
import type { WorkspaceProvisioningService } from "../session/workspace-provisioning/workspace-provisioning-service.js";
import type { PersistedWorkspaceRecord } from "../workspace-registry.js";
import type {
  FetchRecentProviderSessionsRequestMessage,
  ImportAgentRequestMessageSchema,
  RecentProviderSessionDescriptorPayload,
} from "@getpaseo/protocol/messages";
import { getParentAgentIdFromLabels, PARENT_AGENT_ID_LABEL } from "@getpaseo/protocol/agent-labels";
import { canonicalizeExistingPath, createRealpathAwarePathMatcher } from "../../utils/path.js";

type ImportAgentRequestMessage = z.infer<typeof ImportAgentRequestMessageSchema>;

const METADATA_GENERATION_PROMPT_PREFIX =
  "Generate metadata for a coding agent based on the user prompt.";
const PROVIDER_SESSION_TRANSCRIPT_EXPORT_CONCURRENCY = 2;
export type ImportSessionAgentManager = AgentLoaderManager &
  Pick<
    AgentManager,
    | "archiveSnapshot"
    | "closeAgent"
    | "getTimeline"
    | "importProviderSession"
    | "notifyAgentState"
    | "unarchiveSnapshot"
  >;

// Transcript reads and imports both transition ownership of a provider-native
// handle. Keep them in one handle-level queue so an external read cannot slip
// past an import that adopts the same source midway through its eligibility
// check. The queue is deliberately scoped to an AgentManager instance: native
// handles have no meaning across daemon hosts.
const providerSessionHandleMutations = new WeakMap<object, Map<string, Promise<unknown>>>();
const providerSessionTranscriptReadLimits = new WeakMap<object, ReturnType<typeof pLimit>>();

export interface NormalizedImportAgentRequest {
  provider: AgentProvider;
  providerHandleId: string;
  cwd?: string;
  workspaceId?: string;
  labels?: Record<string, string>;
  requestId: string;
}

export class ImportSessionsRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ImportSessionsRequestError";
  }
}

export interface ListImportableProviderSessionsInput {
  request: FetchRecentProviderSessionsRequestMessage;
  agentManager: Pick<AgentManager, "listAgents" | "listImportableSessions">;
  agentStorage: Pick<AgentStorage, "list">;
  providerSnapshotManager: Pick<ProviderSnapshotManager, "getProviderLabel">;
}

export interface ListImportableProviderSessionsResult {
  entries: RecentProviderSessionDescriptorPayload[];
  filteredAlreadyImportedCount: number;
}

export interface ImportProviderSessionInput {
  request: NormalizedImportAgentRequest;
  workspaceProvisioning: Pick<WorkspaceProvisioningService, "runInImportWorkspace">;
  agentManager: ImportSessionAgentManager;
  agentStorage: AgentStorage;
  logger: Logger;
}

export interface ImportProviderSessionResult {
  snapshot: ManagedAgent;
  timelineSize: number;
  createdWorkspace: PersistedWorkspaceRecord | null;
}

export interface ReadEligibleImportableProviderSessionTimelineInput {
  requestId: string;
  provider: AgentProvider;
  providerHandleId: string;
  cwd: string;
  limit: number;
  agentManager: Pick<
    AgentManager,
    "listAgents" | "listImportableSessions" | "readImportableSessionTimeline"
  >;
  agentStorage: Pick<AgentStorage, "list">;
  providerSnapshotManager: Pick<ProviderSnapshotManager, "getProviderLabel">;
}

interface ImportedProviderSession {
  snapshot: ManagedAgent;
  timelineSize: number;
}

// COMPAT(import-agent-request-v1): accept legacy {provider, sessionId} shape
// alongside the new {providerId, providerHandleId} shape. Old clients
// (< target daemon floor) send the legacy fields. Drop the fallbacks and the
// .optional() in messages.ts when the supported client floor is >= the daemon
// version that ships the new shape (target: 2026-11-08).
export function normalizeImportAgentRequest(
  msg: ImportAgentRequestMessage,
): NormalizedImportAgentRequest | { error: string } {
  const provider = msg.providerId ?? msg.provider;
  const providerHandleId = msg.providerHandleId ?? msg.sessionId;
  if (!provider || !providerHandleId) {
    return { error: "Import requires providerId and providerHandleId" };
  }
  return {
    provider: provider as AgentProvider,
    providerHandleId,
    cwd: msg.cwd,
    workspaceId: msg.workspaceId,
    labels: msg.labels,
    requestId: msg.requestId,
  };
}

export async function listImportableProviderSessions(
  input: ListImportableProviderSessionsInput,
): Promise<ListImportableProviderSessionsResult> {
  const { request, agentManager, agentStorage, providerSnapshotManager } = input;
  const limit = request.limit ?? 20;
  const sinceTimestamp = parseRecentProviderSessionsSince(request.since);
  const providerFilter = request.providers ? new Set(request.providers) : undefined;
  const importedHandles = await collectImportedProviderSessionHandles(agentManager, agentStorage);
  const archivedHandles = request.transcriptOnly
    ? await collectArchivedProviderSessionHandles(agentStorage)
    : null;

  const sessions = await agentManager.listImportableSessions({
    limit,
    providerFilter,
    ...(request.transcriptOnly ? { deduplicateSharedStores: true } : {}),
    ...(request.cwd ? { cwd: request.cwd } : {}),
  });
  let filteredAlreadyImportedCount = 0;
  const candidates: ManagedImportableProviderSession[] = [];
  const matchesRequestCwd = request.cwd ? createRealpathAwarePathMatcher(request.cwd) : null;
  for (const session of sessions) {
    if (matchesRequestCwd && !matchesRequestCwd(session.cwd)) {
      continue;
    }
    if (sinceTimestamp !== null && session.lastActivityAt.getTime() < sinceTimestamp) {
      continue;
    }
    if (isMetadataGenerationSession(session)) {
      continue;
    }
    if (
      importedHandles.has(toProviderSessionHandleKey(session.provider, session.providerHandleId))
    ) {
      filteredAlreadyImportedCount += 1;
      continue;
    }
    if (
      archivedHandles?.has(toProviderSessionHandleKey(session.provider, session.providerHandleId))
    ) {
      continue;
    }
    candidates.push(session);
  }

  const entries = candidates
    .sort((a, b) => b.lastActivityAt.getTime() - a.lastActivityAt.getTime())
    .slice(0, limit)
    .map((descriptor) => {
      const source = request.transcriptOnly
        ? { ...descriptor, cwd: canonicalizeExistingPath(descriptor.cwd) }
        : descriptor;
      return toRecentProviderSessionDescriptorPayload(source, {
        providerLabel: providerSnapshotManager.getProviderLabel(descriptor.provider),
      });
    });

  return { entries, filteredAlreadyImportedCount };
}

/**
 * Uses the same visibility policy as the import picker before reading an
 * unmanaged provider session. A native handle alone is not sufficient
 * authority: imported and internal metadata-generation sessions stay hidden.
 */
export function readEligibleImportableProviderSessionTimeline(
  input: ReadEligibleImportableProviderSessionTimelineInput,
) {
  const limit = getProviderSessionTranscriptReadLimit(input.agentManager);
  if (limit.activeCount + limit.pendingCount >= PROVIDER_SESSION_TRANSCRIPT_EXPORT_CONCURRENCY) {
    return Promise.reject(new Error("Transcript export is busy. Please retry."));
  }
  const key = toProviderSessionHandleKey(input.provider, input.providerHandleId);
  return limit(() =>
    serializeProviderSessionHandleMutations(
      input.agentManager,
      [key],
      async () => await readEligibleImportableProviderSessionTimelineNow(input),
    ),
  );
}

async function readEligibleImportableProviderSessionTimelineNow(
  input: ReadEligibleImportableProviderSessionTimelineInput,
) {
  const listing = await listImportableProviderSessions({
    request: {
      type: "fetch_recent_provider_sessions_request",
      requestId: input.requestId,
      providers: [input.provider],
      limit: 200,
      transcriptOnly: true,
    },
    agentManager: input.agentManager,
    agentStorage: input.agentStorage,
    providerSnapshotManager: input.providerSnapshotManager,
  });
  // Do not pass the canonical client-facing cwd into a provider listing.
  // Some runtimes filter before Paseo can apply its realpath-aware matcher,
  // which would hide a provider record that retained a symlink spelling.
  const matchesRequestedCwd = createRealpathAwarePathMatcher(input.cwd);
  const eligible = listing.entries.some(
    (entry) =>
      entry.providerId === input.provider &&
      entry.providerHandleId === input.providerHandleId &&
      matchesRequestedCwd(entry.cwd),
  );
  if (!eligible) {
    throw new Error("Provider session is not eligible for transcript export");
  }

  const result = await input.agentManager.readImportableSessionTimeline({
    provider: input.provider,
    providerHandleId: input.providerHandleId,
    sourceCwd: input.cwd,
    limit: input.limit,
  });
  return {
    ...result,
    source: {
      ...result.source,
      cwd: canonicalizeExistingPath(result.source.cwd),
    },
  };
}

function getProviderSessionTranscriptReadLimit(agentManager: object): ReturnType<typeof pLimit> {
  const existing = providerSessionTranscriptReadLimits.get(agentManager);
  if (existing) {
    return existing;
  }
  const limit = pLimit(PROVIDER_SESSION_TRANSCRIPT_EXPORT_CONCURRENCY);
  providerSessionTranscriptReadLimits.set(agentManager, limit);
  return limit;
}

export async function importProviderSession(
  input: ImportProviderSessionInput,
): Promise<ImportProviderSessionResult> {
  const cwd = input.request.cwd;
  if (!cwd) {
    throw new Error("Import requires cwd from the selected provider session");
  }
  const keys = await resolveProviderSessionImportMutationKeys(input);
  return serializeProviderSessionHandleMutations(input.agentManager, keys, async () => {
    const placement = await input.workspaceProvisioning.runInImportWorkspace(
      { cwd, requestedWorkspaceId: input.request.workspaceId },
      (workspace) => importProviderSessionNow(input, cwd, workspace.workspaceId),
    );
    return { ...placement.value, createdWorkspace: placement.createdWorkspace };
  });
}

async function importProviderSessionNow(
  input: ImportProviderSessionInput,
  cwd: string,
  workspaceId: string,
): Promise<ImportedProviderSession> {
  const { provider, providerHandleId, labels } = input.request;

  const matchingRecords = (await input.agentStorage.list()).filter((record) =>
    recordMatchesProviderHandle(record, { provider, providerHandleId }),
  );
  const activeRecord = matchingRecords.find((record) => !record.archivedAt);
  if (activeRecord) {
    throw new Error(`Provider session is already imported: ${providerHandleId}`);
  }
  const archivedRecord = matchingRecords.find((record) => record.archivedAt);
  if (archivedRecord?.persistence && archivedRecord.archivedAt) {
    if (!createRealpathAwarePathMatcher(cwd)(archivedRecord.cwd)) {
      throw new Error(`Provider session cwd does not match import cwd: ${providerHandleId}`);
    }
    const requestedParentAgentId = getParentAgentIdFromLabels(input.request.labels);
    const labelPatch: Record<string, string | null> = { ...input.request.labels };
    if (
      Object.hasOwn(archivedRecord.labels, PARENT_AGENT_ID_LABEL) ||
      Object.hasOwn(input.request.labels ?? {}, PARENT_AGENT_ID_LABEL)
    ) {
      labelPatch[PARENT_AGENT_ID_LABEL] = requestedParentAgentId;
    }
    await unarchiveAgentState(input.agentStorage, input.agentManager, archivedRecord.id, {
      workspaceId,
      labels: Object.keys(labelPatch).length > 0 ? labelPatch : undefined,
    });
    try {
      const snapshot = await ensureAgentLoaded(archivedRecord.id, {
        agentManager: input.agentManager,
        agentStorage: input.agentStorage,
        logger: input.logger,
      });
      return {
        snapshot,
        timelineSize: input.agentManager.getTimeline(snapshot.id).length,
      };
    } catch (error) {
      await rollbackArchivedImport(input, archivedRecord, archivedRecord.archivedAt);
      throw error;
    }
  }

  const snapshot = await input.agentManager.importProviderSession({
    provider,
    providerHandleId,
    cwd,
    workspaceId,
    labels,
  });
  await unarchiveAgentState(input.agentStorage, input.agentManager, snapshot.id);

  return {
    snapshot,
    timelineSize: input.agentManager.getTimeline(snapshot.id).length,
  };
}

async function serializeProviderSessionHandleMutations<T>(
  agentManager: object,
  keys: readonly string[],
  operation: () => Promise<T>,
): Promise<T> {
  const uniqueKeys = [...new Set(keys)].sort();
  return await serializeProviderSessionHandleMutationsAtIndex(
    agentManager,
    uniqueKeys,
    0,
    operation,
  );
}

async function serializeProviderSessionHandleMutationsAtIndex<T>(
  agentManager: object,
  keys: readonly string[],
  index: number,
  operation: () => Promise<T>,
): Promise<T> {
  if (index >= keys.length) {
    return await operation();
  }
  const key = keys[index];
  if (!key) {
    return await operation();
  }
  let mutations = providerSessionHandleMutations.get(agentManager);
  if (!mutations) {
    mutations = new Map();
    providerSessionHandleMutations.set(agentManager, mutations);
  }

  const previous = mutations.get(key) ?? Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(
      async () =>
        await serializeProviderSessionHandleMutationsAtIndex(
          agentManager,
          keys,
          index + 1,
          operation,
        ),
    );
  mutations.set(key, next);
  try {
    return await next;
  } finally {
    if (mutations.get(key) === next) {
      mutations.delete(key);
    }
  }
}

async function resolveProviderSessionImportMutationKeys(
  input: ImportProviderSessionInput,
): Promise<string[]> {
  const identity = {
    provider: input.request.provider,
    providerHandleId: input.request.providerHandleId,
  };
  const matchingRecords = (await input.agentStorage.list()).filter((record) =>
    recordMatchesProviderHandle(record, identity),
  );
  const keys = [toProviderSessionHandleKey(identity.provider, identity.providerHandleId)];
  for (const record of matchingRecords) {
    collectProviderSessionHandleKeys(keys, record.provider, record.persistence);
  }
  return keys;
}

async function rollbackArchivedImport(
  input: ImportProviderSessionInput,
  archivedRecord: StoredAgentRecord,
  archivedAt: string,
): Promise<void> {
  try {
    if (input.agentManager.getAgent(archivedRecord.id)) {
      await input.agentManager.closeAgent(archivedRecord.id);
    }
    await input.agentManager.archiveSnapshot(archivedRecord.id, archivedAt);
  } catch (error) {
    input.logger.error(
      { err: error, agentId: archivedRecord.id },
      "Failed to re-archive provider session after import failure",
    );
  }

  try {
    await input.agentStorage.upsert(archivedRecord);
  } catch (error) {
    input.logger.error(
      { err: error, agentId: archivedRecord.id },
      "Failed to restore archived agent record after import failure",
    );
  }
}

function recordMatchesProviderHandle(
  record: StoredAgentRecord,
  identity: { provider: string; providerHandleId: string },
): boolean {
  return (
    record.persistence?.provider === identity.provider &&
    (record.persistence.sessionId === identity.providerHandleId ||
      record.persistence.nativeHandle === identity.providerHandleId)
  );
}

function parseRecentProviderSessionsSince(since: string | undefined): number | null {
  if (!since) {
    return null;
  }
  const timestamp = Date.parse(since);
  if (Number.isNaN(timestamp)) {
    throw new ImportSessionsRequestError("invalid_since", "Invalid recent provider sessions since");
  }
  return timestamp;
}

async function collectImportedProviderSessionHandles(
  agentManager: Pick<AgentManager, "listAgents">,
  agentStorage: Pick<AgentStorage, "list">,
): Promise<Set<string>> {
  const handles = new Set<string>();
  const records = await agentStorage.list();
  const storedRecordsById = new Map(records.map((record) => [record.id, record]));

  for (const agent of agentManager.listAgents()) {
    if (storedRecordsById.get(agent.id)?.archivedAt) {
      continue;
    }
    collectProviderSessionHandleKeys(handles, agent.provider, agent.persistence);
  }

  for (const record of records) {
    if (record.archivedAt) {
      continue;
    }
    collectProviderSessionHandleKeys(handles, record.provider, record.persistence);
  }

  return handles;
}

async function collectArchivedProviderSessionHandles(
  agentStorage: Pick<AgentStorage, "list">,
): Promise<Set<string>> {
  const handles = new Set<string>();
  const records = await agentStorage.list();
  for (const record of records) {
    if (!record.archivedAt) {
      continue;
    }
    collectProviderSessionHandleKeys(handles, record.provider, record.persistence);
  }
  return handles;
}

function toProviderSessionHandleKey(provider: string, providerHandleId: string): string {
  return `${provider}\0${providerHandleId}`;
}

function isMetadataGenerationSession(input: { firstPromptPreview: string | null }): boolean {
  return (
    input.firstPromptPreview?.trimStart().startsWith(METADATA_GENERATION_PROMPT_PREFIX) ?? false
  );
}

function collectProviderSessionHandleKeys(
  target: Set<string> | string[],
  provider: AgentProvider | StoredAgentRecord["provider"] | string,
  persistence: AgentPersistenceHandle | null | undefined,
): void {
  if (!persistence) {
    return;
  }

  addProviderSessionHandleKey(target, toProviderSessionHandleKey(provider, persistence.sessionId));
  if (persistence.nativeHandle) {
    addProviderSessionHandleKey(
      target,
      toProviderSessionHandleKey(provider, persistence.nativeHandle),
    );
  }
}

function addProviderSessionHandleKey(target: Set<string> | string[], key: string): void {
  if (target instanceof Set) {
    target.add(key);
    return;
  }
  target.push(key);
}
