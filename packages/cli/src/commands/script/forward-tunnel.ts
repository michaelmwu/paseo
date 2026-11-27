import { TunnelMuxClient } from "@getpaseo/client/internal/node-tunnel";
import type { DaemonTransportFactory } from "@getpaseo/client/internal/daemon-client-transport-types";
import { WSTunnelHandshakeResponseSchema } from "@getpaseo/protocol/messages";

/** Reuse the authenticated session's connector, including its negotiated relay security floor. */
export function openForwardTunnel(
  factory: DaemonTransportFactory,
  ticket: string,
): Promise<TunnelMuxClient> {
  const transport = factory({ url: "ws://host-connector/ws" });
  return new Promise((resolve, reject) => {
    const failed = (error: unknown) => {
      clearTimeout(timeout);
      reject(error instanceof Error ? error : new Error("Tunnel connection failed"));
      transport.close();
    };
    const timeout = setTimeout(() => failed(new Error("Tunnel handshake timed out")), 15000);
    const stopError = transport.onError(failed);
    const stopClose = transport.onClose(() => failed(new Error("Tunnel closed during handshake")));
    transport.onOpen(() => {
      void Promise.resolve()
        .then(() => transport.send(JSON.stringify({ type: "tunnel_hello", ticket })))
        .catch(failed);
    });
    const stopHandshake = transport.onMessage((data, binary) => {
      try {
        if (binary) throw new Error("Expected tunnel handshake before data");
        const handshake = WSTunnelHandshakeResponseSchema.parse(JSON.parse(String(data)));
        if (handshake.type === "tunnel_error") throw new Error(handshake.message);
        clearTimeout(timeout);
        stopError();
        stopClose();
        stopHandshake();
        transport.onError(() => transport.close());
        resolve(
          new TunnelMuxClient({
            ready: handshake,
            sendBinary: async (bytes) => {
              await transport.send(bytes);
            },
            onClose: (listener) => transport.onClose(() => listener()),
            close: () => transport.close(),
            onBinary: (listener) =>
              transport.onMessage((frame, isBinary) => {
                if (!isBinary) return;
                if (frame instanceof ArrayBuffer) listener(new Uint8Array(frame));
                else if (ArrayBuffer.isView(frame))
                  listener(new Uint8Array(frame.buffer, frame.byteOffset, frame.byteLength));
                else transport.close();
              }),
          }),
        );
      } catch (error) {
        failed(error);
      }
    });
  });
}
