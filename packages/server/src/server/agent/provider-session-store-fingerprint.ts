import { createHash } from "node:crypto";

import { resolveExistingPath } from "../../utils/path.js";

/**
 * An internal-only identity for a provider-native session store.
 *
 * The fingerprint is intentionally opaque: it lets the AgentManager collapse
 * duplicate profile listings without exposing an effective provider-home path
 * through the protocol, logs, or persisted draft data. A missing or
 * unresolvable store root means the store cannot be proven shared, so callers
 * must leave the fingerprint absent and skip cross-profile deduplication.
 */
export function createProviderSessionStoreFingerprint(
  providerFamily: string,
  effectiveStoreRoot: string,
): string | undefined {
  const canonicalStoreRoot = resolveExistingPath(effectiveStoreRoot);
  if (!canonicalStoreRoot) {
    return undefined;
  }

  return createHash("sha256")
    .update(providerFamily)
    .update("\0")
    .update(canonicalStoreRoot)
    .digest("hex");
}
