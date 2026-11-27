import net, { type Server, type Socket } from "node:net";
import type { SocketOwnerVerifier } from "./socket-owner.js";

export interface LocalForward {
  port: number;
  close(): Promise<void>;
}

async function listen(server: Server, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () => {
      server.off("error", reject);
      const address = server.address();
      if (!address || typeof address === "string") reject(new Error("No forward port assigned"));
      else resolve(address.port);
    });
  });
}

export async function startLocalForward({
  remotePort,
  verifyOwner,
  connect,
}: {
  remotePort: number;
  verifyOwner: SocketOwnerVerifier;
  connect(socket: Socket): Promise<void>;
}): Promise<LocalForward> {
  const sockets = new Set<Socket>();
  const server = net.createServer({ pauseOnConnect: true, allowHalfOpen: true }, (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    socket.on("error", () => socket.destroy());
    const address = server.address();
    const clientPort = socket.remotePort;
    if (!address || typeof address === "string" || !clientPort) {
      socket.destroy();
      return;
    }
    void verifyOwner({ clientPort, serverPort: address.port })
      .then((allowed) => {
        if (allowed && !socket.destroyed) return connect(socket);
        socket.destroy();
        return undefined;
      })
      .catch(() => socket.destroy());
  });
  server.maxConnections = 32;
  let port: number;
  try {
    port = await listen(server, remotePort);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") throw error;
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
