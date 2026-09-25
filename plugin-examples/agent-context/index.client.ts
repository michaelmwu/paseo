import { defineAttachmentSource, type PluginAttachmentSearchPayload } from "@getpaseo/plugin";
import { getPaseoClient, listHosts, type PluginClientContext } from "@getpaseo/plugin/client";
import { searchAgentTranscripts } from "./shared/transcript";

async function searchConnectedAgentTranscripts({
  query,
}: {
  query: string;
}): Promise<PluginAttachmentSearchPayload> {
  const hosts = listHosts().filter((host) => host.status === "online");
  if (hosts.length === 0) throw new Error("No connected Paseo hosts");
  const results = await Promise.allSettled(
    hosts.map((host) =>
      searchAgentTranscripts(
        { query },
        {
          paseo: getPaseoClient(host.serverId),
          sourceHost: { serverId: host.serverId, label: host.label },
        },
      ),
    ),
  );
  const items = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value.items : [],
  );
  if (items.length === 0 && results.every((result) => result.status === "rejected")) {
    throw results[0].reason;
  }
  return { items };
}

const agentTranscriptAttachments = defineAttachmentSource({
  id: "agent-transcripts",
  title: "agent transcript",
  icon: "MessageSquare",
  pickerTitle: "Attach agent transcript",
  searchPlaceholder: "Search agents on connected hosts",
  search: searchConnectedAgentTranscripts,
});

export default function contribute(client: PluginClientContext) {
  return client.addAttachmentSource(agentTranscriptAttachments);
}
