import type { TunnelMuxClient } from "@getpaseo/client/node";
import { createServer, type AddressInfo, type Server, type Socket } from "node:net";

async function listen(server: Server, port: number): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
      server.off("error", reject);
      resolve();
    });
  });
  return (server.address() as AddressInfo).port;
}

export async function startTcpForward(
  tunnel: Pick<TunnelMuxClient, "openStream">,
  targetPort: number,
  localPort: number,
  allowPortFallback: boolean,
): Promise<{ port: number; close(): Promise<void> }> {
  const sockets = new Set<Socket>();
  const server = createServer({ pauseOnConnect: true, allowHalfOpen: true }, (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    socket.on("error", () => socket.destroy());
    void tunnel
      .openStream({ host: "localhost", port: targetPort, socket, onOpened: () => socket.resume() })
      .then((result) => (result.ok ? undefined : socket.destroy()))
      .catch(() => socket.destroy());
  });
  server.maxConnections = 32;
  let port: number;
  try {
    port = await listen(server, localPort);
  } catch (error) {
    if (!allowPortFallback || (error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
    port = await listen(server, 0);
  }
  let closing: Promise<void> | undefined;
  return {
    port,
    close() {
      closing ??= new Promise<void>((resolve) => {
        server.close(() => resolve());
        for (const socket of sockets) socket.destroy();
      });
      return closing;
    },
  };
}
