import { describe, expect, it } from "vitest";
import {
  getTranscriptSourceExportAvailability,
  type TranscriptExportSource,
} from "@/components/transcript-source";

function providerSessionSource(supportsTranscriptExport: boolean): TranscriptExportSource {
  return {
    kind: "provider_session",
    session: {
      serverId: "host-a",
      serverLabel: "Host A",
      providerId: "codex",
      providerLabel: "Codex",
      providerHandleId: "thread-a",
      cwd: "/repos/paseo",
      title: "External session",
      firstPromptPreview: null,
      lastPromptPreview: null,
      lastActivityAt: "2026-07-19T10:00:00.000Z",
      supportsTranscriptExport,
    },
  };
}

describe("getTranscriptSourceExportAvailability", () => {
  it("requires a host upgrade before considering an external provider adapter", () => {
    expect(getTranscriptSourceExportAvailability(providerSessionSource(false), false)).toBe(
      "host_upgrade_required",
    );
  });

  it("distinguishes a current host from an unsupported provider-session adapter", () => {
    expect(getTranscriptSourceExportAvailability(providerSessionSource(false), true)).toBe(
      "source_unavailable",
    );
  });

  it("allows an external provider session when its host and adapter support export", () => {
    expect(getTranscriptSourceExportAvailability(providerSessionSource(true), true)).toBe(
      "available",
    );
  });
});
