/**
 * Some desktop integrations persist launch-time runtime configuration as a
 * provider "user" message. These complete envelopes are not user-authored
 * conversation turns and must not cross a transcript boundary.
 */
const PROVIDER_INJECTED_SYSTEM_ENVELOPE =
  /^\s*<(paseo-system|system_instruction)>[\s\S]*<\/\1>\s*$/i;
const PROVIDER_INJECTED_SYSTEM_ENVELOPE_PREFIX =
  /^\s*<(paseo-system|system_instruction)>[\s\S]*?<\/\1>\s*/i;
const MAX_PROVIDER_SESSION_LABEL_CHARS = 240;

export function isProviderInjectedSystemEnvelope(text: string): boolean {
  return PROVIDER_INJECTED_SYSTEM_ENVELOPE.test(text);
}

/**
 * Desktop integrations can prepend their runtime-owned launch instructions to
 * an otherwise user-authored message. Remove every leading envelope while
 * preserving the user-authored remainder for a read-only transcript export.
 */
export function stripProviderInjectedSystemEnvelopePrefix(text: string): string {
  let remaining = text;
  while (true) {
    const stripped = remaining.replace(PROVIDER_INJECTED_SYSTEM_ENVELOPE_PREFIX, "");
    if (stripped === remaining) return remaining;
    remaining = stripped;
  }
}

/**
 * `thread/list` metadata sometimes folds a desktop runtime's injected launch
 * instructions and the first user prompt into one preview. Strip the leading
 * runtime-owned envelope before presenting that metadata in a picker. These
 * labels are only identification hints, so keep them bounded and single-line
 * rather than sending an unbounded provider prompt through the app.
 */
export function sanitizeProviderSessionLabel(text: string): string | null {
  const normalized = stripProviderInjectedSystemEnvelopePrefix(text).replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (normalized.length <= MAX_PROVIDER_SESSION_LABEL_CHARS) return normalized;
  return `${normalized.slice(0, MAX_PROVIDER_SESSION_LABEL_CHARS - 1).trimEnd()}…`;
}
