import type { StoredAgentRecord } from "./agent-storage.js";

export type ArchivedStoredAgentRecord = StoredAgentRecord & { archivedAt: string };

interface BuildArchivedAgentRecordOptions {
  archivedAt?: string;
  updatedAt?: string;
}

export function buildArchivedAgentRecord(
  record: StoredAgentRecord,
  options?: BuildArchivedAgentRecordOptions,
): ArchivedStoredAgentRecord {
  const archivedAt = options?.archivedAt ?? new Date().toISOString();
  const updatedAt = options?.updatedAt ?? record.updatedAt;
  return {
    ...record,
    archivedAt,
    // Restoring a failed send's previous archive must not hide the newer unarchive update.
    updatedAt: Date.parse(updatedAt) < Date.parse(record.updatedAt) ? record.updatedAt : updatedAt,
    lastStatus: normalizeArchivedStatus(record.lastStatus),
    requiresAttention: false,
    attentionReason: null,
    attentionTimestamp: null,
  };
}

function normalizeArchivedStatus(
  status: StoredAgentRecord["lastStatus"],
): StoredAgentRecord["lastStatus"] {
  return status === "running" || status === "initializing" ? "idle" : status;
}
