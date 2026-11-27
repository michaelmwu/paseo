import { openHostNetworkTunnel } from "@getpaseo/client/node";
import type { Command } from "commander";
import { once } from "node:events";
import { resolveDaemonConnection } from "../../utils/client.js";
import { startTcpForward } from "./forward-tcp.js";
import {
  connectWorkspaceScriptClient,
  resolveWorkspaceScriptWorkspaceId,
  type WorkspaceScriptCommandOptions,
} from "./shared.js";

interface ForwardOptions extends WorkspaceScriptCommandOptions {
  localPort?: string;
}

export async function runForwardCommand(
  scriptName: string,
  options: ForwardOptions,
  _command: Command,
): Promise<void> {
  const client = await connectWorkspaceScriptClient(options.daemonTarget);
  try {
    const workspaceId = await resolveWorkspaceScriptWorkspaceId(client, options);
    const result = await client.listWorkspaceScripts(workspaceId);
    if (result.error) throw new Error(result.error);
    const script = result.scripts?.find((item) => item.scriptName === scriptName);
    if (!script) throw new Error(`Workspace script '${scriptName}' was not found.`);
    if (script.type !== "service" || !script.port)
      throw new Error(`Workspace script '${scriptName}' has no TCP service port.`);
    if (script.lifecycle !== "running")
      throw new Error(`Start '${scriptName}' with 'paseo script start ${scriptName}' first.`);
    const port = options.localPort === undefined ? script.port : Number(options.localPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error("--local-port must be between 1 and 65535.");

    const connection = await resolveDaemonConnection({ target: options.daemonTarget });
    const tunnel = await openHostNetworkTunnel(client, connection);
    try {
      const forward = await startTcpForward(
        tunnel,
        script.port,
        port,
        options.localPort === undefined,
      );
      const abort = new AbortController();
      let unsubscribe = () => {};
      try {
        const host = script.hostname.endsWith(".localhost")
          ? script.hostname
          : `${script.hostname}.localhost`;
        process.stdout.write(
          `Forwarding ${scriptName} → http://${host}:${forward.port}\nPress Ctrl+C to stop.\n`,
        );
        const disconnected = new Promise<Error | undefined>((resolve) => {
          unsubscribe = tunnel.onClose((error) =>
            resolve(error ?? new Error("Network tunnel closed")),
          );
        });
        const signal = abort.signal;
        const failure = await Promise.race([
          disconnected,
          once(process, "SIGINT", { signal }).then(() => undefined),
          once(process, "SIGTERM", { signal }).then(() => undefined),
        ]);
        if (failure) throw failure;
      } finally {
        abort.abort();
        unsubscribe();
        await forward.close();
      }
    } finally {
      tunnel.close();
    }
  } finally {
    await client.close().catch(() => {});
  }
}
