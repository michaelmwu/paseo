import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, test } from "vitest";

import { createProviderSessionStoreFingerprint } from "./provider-session-store-fingerprint.js";

test("fingerprints only proven physical store roots and keeps provider families separate", () => {
  const storeRoot = mkdtempSync(path.join(tmpdir(), "paseo-provider-store-fingerprint-"));
  const storeAlias = `${storeRoot}-alias`;
  symlinkSync(storeRoot, storeAlias, process.platform === "win32" ? "junction" : "dir");

  try {
    const codexFromRoot = createProviderSessionStoreFingerprint("codex", storeRoot);
    const codexFromAlias = createProviderSessionStoreFingerprint("codex", storeAlias);
    const claudeFromRoot = createProviderSessionStoreFingerprint("claude", storeRoot);

    expect(codexFromRoot).toEqual(expect.any(String));
    expect(codexFromAlias).toBe(codexFromRoot);
    expect(claudeFromRoot).not.toBe(codexFromRoot);
    expect(createProviderSessionStoreFingerprint("codex", `${storeRoot}-missing`)).toBeUndefined();
  } finally {
    rmSync(storeAlias, { recursive: true, force: true });
    rmSync(storeRoot, { recursive: true, force: true });
  }
});
