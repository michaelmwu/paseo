import { createServer, type AddressInfo, type Server, type Socket } from "node:net";
import type { TunnelMuxClient } from "@getpaseo/client/internal/node-tunnel";
const LOOPBACK = "127.0.0.1";

export interface TcpForward {
  readonly port: number;
  close(): Promise<void>;
}

async function listen(server: Server, port: number): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, LOOPBACK, () => {
      server.off("error", reject);
      resolve();
    });
  });
  return (server.address() as AddressInfo).port;
}

/** Bind the requested loopback port, falling back to a free port only for defaults. */
export async function startTcpForward(
  tunnel: Pick<TunnelMuxClient, "openStream">,
  targetPort: number,
  localPort: number = targetPort,
  allowPortFallback = true,
): Promise<TcpForward> {
  const sockets = new Set<Socket>();
  const createListener = () =>
    createServer({ allowHalfOpen: true, pauseOnConnect: true }, (socket) => {
      sockets.add(socket);
      socket.once("close", () => sockets.delete(socket));
      socket.on("error", () => socket.destroy());
      void tunnel
        .openStream({
          host: "localhost",
          port: targetPort,
          socket,
          onOpened: () => socket.resume(),
        })
        .then((result) => {
          if (!result.ok) socket.destroy();
          return result;
        })
        .catch(() => socket.destroy());
    });
  let server = createListener();
  let port: number;
  try {
    port = await listen(server, localPort);
  } catch (error) {
    if (!allowPortFallback || (error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
    server = createListener();
    port = await listen(server, 0);
  }
  return {
    port,
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}
