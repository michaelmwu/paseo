import { createConnection, createServer } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { TunnelMuxClient } from "@getpaseo/client/internal/node-tunnel";
import {
  decodeNetworkTunnelFrame,
  encodeNetworkTunnelFrame,
  NetworkTunnelCloseReason,
  type NetworkTunnelFrame,
} from "@getpaseo/protocol/network-tunnel";
import { startTcpForward, type TcpForward } from "./forward-tcp.js";

const forwards: TcpForward[] = [];
afterEach(async () => {
  await Promise.all(forwards.splice(0).map((forward) => forward.close()));
});

function echoTunnel(closeAfterWrite = false, rejectUpload = false) {
  const writes: Uint8Array[] = [];
  let target: { host: string; port: number } | undefined;
  let closed = 0;
  let receive: (bytes: Uint8Array) => void = () => {};
  const reply = (frame: NetworkTunnelFrame) =>
    queueMicrotask(() => receive(encodeNetworkTunnelFrame(frame)));
  const tunnel = new TunnelMuxClient(
    {
      ready: {
        maxFramePayloadBytes: 2,
        initialStreamWindowBytes: 4,
        initialConnectionWindowBytes: 1024,
      },
      onBinary(handler) {
        receive = handler;
        return () => {};
      },
      onClose() {
        return () => {};
      },
      close() {},
      async sendBinary(bytes) {
        const frame = decodeNetworkTunnelFrame(bytes);
        if (frame.type === "open") {
          target = { host: frame.host, port: frame.port };
          reply({ type: "opened", streamId: frame.streamId, initialWindowBytes: 4 });
        } else if (frame.type === "data") {
          writes.push(frame.data);
          if (rejectUpload) {
            reply({ type: "data", streamId: frame.streamId, data: Buffer.from("413") });
            reply({
              type: "close",
              streamId: frame.streamId,
              reason: NetworkTunnelCloseReason.Normal,
            });
            return;
          }
          reply(frame);
          reply({
            type: "window_update",
            streamId: frame.streamId,
            creditBytes: frame.data.length,
          });
          if (closeAfterWrite) reply({ type: "half_close", streamId: frame.streamId });
        } else if (frame.type === "half_close") {
          closed++;
          reply(frame);
        }
      },
    },
    { heartbeatIntervalMs: 0 },
  );
  return {
    tunnel,
    writes,
    get closed() {
      return closed;
    },
    get target() {
      return target;
    },
  };
}

async function exchange(port: number, payload: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    let result = "";
    socket.on("error", reject);
    socket.on("data", (data) => {
      result += data.toString();
      if (result.length === payload.length) {
        socket.destroy();
        resolve(result);
      }
    });
    socket.on("connect", () => socket.write(payload));
  });
}

describe("workspace TCP forwarding", () => {
  it("forwards both directions and splits writes at the negotiated frame size", async () => {
    const fake = echoTunnel();
    const forward = await startTcpForward(fake.tunnel, 4173, 0);
    forwards.push(forward);
    expect(await exchange(forward.port, "abcdef")).toBe("abcdef");
    expect(fake.target).toEqual({ host: "localhost", port: 4173 });
    expect(fake.writes.map((part) => part.length)).toEqual([2, 2, 2]);
  });

  it("propagates local EOF and drains the peer before closing", async () => {
    const fake = echoTunnel();
    const forward = await startTcpForward(fake.tunnel, 4173, 0);
    forwards.push(forward);
    const socket = createConnection({ host: "127.0.0.1", port: forward.port });
    await new Promise<void>((resolve, reject) => {
      socket.once("error", reject);
      socket.once("connect", () => socket.end("abcdef"));
      socket.resume();
      socket.once("close", () => resolve());
    });
    expect(Buffer.concat(fake.writes).toString()).toBe("abcdef");
    expect(fake.closed).toBe(1);
  });

  it("flushes an early response and drains a paused upload after full close", async () => {
    const forward = await startTcpForward(echoTunnel(false, true).tunnel, 4173, 0);
    forwards.push(forward);
    const data = await new Promise<string>((resolve, reject) => {
      const socket = createConnection({ host: "127.0.0.1", port: forward.port });
      const chunks: Buffer[] = [];
      socket.on("data", (chunk) => chunks.push(chunk));
      socket.on("error", reject);
      socket.on("close", () => resolve(Buffer.concat(chunks).toString()));
      socket.once("connect", () => socket.end(Buffer.alloc(256 * 1024)));
    });
    expect(data).toBe("413");
  });

  it("uses a free loopback port when the default port is occupied", async () => {
    const occupied = createServer();
    await new Promise<void>((resolve) => occupied.listen(0, "127.0.0.1", resolve));
    const busyPort = (occupied.address() as { port: number }).port;
    try {
      const forward = await startTcpForward(echoTunnel().tunnel, 4173, busyPort);
      forwards.push(forward);
      expect(forward.port).not.toBe(busyPort);
      await expect(
        startTcpForward(echoTunnel().tunnel, 4173, busyPort, false),
      ).rejects.toMatchObject({
        code: "EADDRINUSE",
      });
    } finally {
      await new Promise<void>((resolve) => occupied.close(() => resolve()));
    }
  });

  it("flushes the last response bytes before closing a local socket", async () => {
    const forward = await startTcpForward(echoTunnel(true).tunnel, 4173, 0);
    forwards.push(forward);
    const received = await new Promise<string>((resolve, reject) => {
      const socket = createConnection({ host: "127.0.0.1", port: forward.port });
      let data = "";
      socket.on("error", reject);
      socket.on("data", (part) => {
        data += part.toString();
      });
      socket.on("end", () => resolve(data));
      socket.on("connect", () => socket.write("ok"));
    });
    expect(received).toBe("ok");
  });
});
