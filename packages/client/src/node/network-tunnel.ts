import { WSTunnelHandshakeResponseSchema } from "@getpaseo/protocol/messages";
import type { DaemonClient } from "../daemon-client.js";
import { createHostTransportFactory } from "./index.js";
import { TunnelMuxClient, type TunnelWireConnection } from "./tunnel-mux.js";

/** Open the release's ticket-authenticated tunnel over the selected CLI host transport. */
export async function openHostNetworkTunnel(
  client: DaemonClient,
  connection: string,
): Promise<TunnelMuxClient> {
  const { ticket } = await client.createNetworkTunnelTicket();

  // The tunnel uses a separate route to the same host. Require protected relay negotiation
  // on that route to protect the ticket and the forwarded bytes.
  const transport = createHostTransportFactory(connection, undefined, {
    minimumRelaySecurityMode: "protected",
  })({ url: "" });
  const wire = await new Promise<TunnelWireConnection>((resolve, reject) => {
    const binaryListeners = new Set<(bytes: Uint8Array) => void>();
    const closeListeners = new Set<(error?: Error) => void>();
    let closed = false;
    let ready = false;

    const close = (error?: Error) => {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      for (const unsubscribe of subscriptions) unsubscribe();
      transport.close();
      if (!ready) reject(error ?? new Error("Host closed the network tunnel before it was ready"));
      for (const listener of closeListeners) listener(error);
      closeListeners.clear();
      binaryListeners.clear();
    };
    const timer = setTimeout(() => close(new Error("Network tunnel handshake timed out")), 15_000);
    timer.unref();

    const subscriptions = [
      transport.onOpen(() => {
        void Promise.resolve()
          .then(() => transport.send(JSON.stringify({ type: "tunnel_hello", ticket })))
          .catch(() => close(new Error("Could not submit the network tunnel ticket")));
      }),
      transport.onError((error) => {
        close(error instanceof Error ? error : new Error("Network tunnel transport failed"));
      }),
      transport.onClose(() => close()),
      transport.onMessage((data, isBinary) => {
        if (closed) return;
        if (!ready) {
          try {
            if (isBinary) throw new Error("Expected a network tunnel handshake");
            const handshake = WSTunnelHandshakeResponseSchema.parse(JSON.parse(String(data)));
            if (handshake.type === "tunnel_error") {
              close(new Error(handshake.message));
              return;
            }
            ready = true;
            clearTimeout(timer);
            resolve({
              ready: handshake,
              async sendBinary(bytes) {
                if (closed) throw new Error("Network tunnel is closed");
                await transport.send(bytes);
              },
              onBinary(listener) {
                binaryListeners.add(listener);
                return () => binaryListeners.delete(listener);
              },
              onClose(listener) {
                if (closed) {
                  listener();
                  return () => {};
                }
                closeListeners.add(listener);
                return () => closeListeners.delete(listener);
              },
              close,
            });
          } catch {
            close(new Error("Invalid network tunnel handshake"));
          }
        } else if (isBinary) {
          const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
          if (!(bytes instanceof Uint8Array)) {
            close(new Error("Invalid binary network tunnel frame"));
            return;
          }
          for (const listener of binaryListeners) listener(bytes);
        }
      }),
    ];
  });
  return new TunnelMuxClient(wire);
}
