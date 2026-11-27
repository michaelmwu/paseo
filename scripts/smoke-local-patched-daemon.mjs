import { createServer } from "node:http";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { createPaseoClient } from "../packages/client/dist/index.js";
import {
  startDaemonInstance,
  stopDaemonInstance,
} from "../packages/server/dist/server/server/daemon-instance.js";
import { DaemonClient } from "../packages/client/dist/daemon-client.js";

const root = path.resolve(import.meta.dirname, "..");
const home = await mkdtemp(path.join(tmpdir(), "paseo-v017-smoke-"));
let instance;
let sdk;
let observer;
let stopped = false;
const inputs = JSON.parse(await readFile(path.join(root, "local-build-inputs.json"), "utf8"));
const installed = [];
const pageServer = createServer((_request, response) =>
  response.end("<title>Paseo bundle smoke</title>"),
);
try {
  await writeFile(path.join(home, "config.json"), JSON.stringify({ pluginsEnabled: true }));
  const launchOptions = {
    home,
    command: process.execPath,
    args: [path.join(root, "packages/server/dist/scripts/supervisor-entrypoint.js")],
    env: {
      ...process.env,
      PASEO_HOME: home,
      PASEO_BROWSER_EXECUTABLE: "/usr/bin/google-chrome",
      PASEO_PR_WATCHER_STATE_FILE: path.join(home, "watcher.json"),
      PASEO_LISTEN: "127.0.0.1:0",
      PASEO_RELAY_ENABLED: "false",
      PASEO_WEB_UI_ENABLED: "false",
      PASEO_DICTATION_ENABLED: "false",
      PASEO_VOICE_MODE_ENABLED: "false",
    },
    mode: "deployment",
    timeoutMs: 60_000,
  };
  const launched = await startDaemonInstance(launchOptions);
  instance = launched.instance;
  assert.ok(instance.listen);
  assert.notEqual(instance.listen, "127.0.0.1:6767");
  const url = `ws://${instance.listen}/ws`;
  observer = new DaemonClient({ url, clientId: "compiled-daemon-smoke-observer" });
  await observer.connect();
  const info = observer.getLastServerInfoMessage();
  assert.equal(info.version, inputs.release.tag.replace(/^v/, ""));
  assert.equal(info.features.idleRuntimeCleanupSetting, true);
  assert.equal(info.features.hostInstructions, true);
  assert.equal(info.features.hostInstructionWorkspacePolicies, true);
  assert.equal(info.features.agentChangeRequestSubscribe, true);
  assert.equal(info.features.planReview, true);
  await assert.rejects(
    observer.reviewAgentPlan({
      agentId: "00000000-0000-4000-8000-000000000016",
      permissionRequestId: "missing-proposal",
      action: "request_changes",
      text: "Revise the proposal.",
    }),
    /Unknown agent/,
  );
  await assert.rejects(
    observer.subscribeAgentChangeRequest({
      agentId: "missing-native-watch-smoke-agent",
      url: "https://github.com/getpaseo/paseo/pull/10736",
    }),
    /Unknown agent/,
  );
  const instructionDirectory = await observer.manageHostInstructions({ action: "list" });
  assert.deepEqual(instructionDirectory.hostPolicies, []);
  assert.deepEqual(instructionDirectory.grants, []);
  assert.deepEqual(instructionDirectory.requests, []);
  sdk = createPaseoClient({ url });
  await sdk.connect();
  const config = await sdk.config.get();
  assert.equal(config.config.idleRuntimeCleanup, true);
  const cwd = path.join(home, "workspace");
  await mkdir(cwd);
  const workspace = await sdk.workspaces.create({
    source: { kind: "directory", path: cwd },
    title: "Compiled daemon smoke",
  });
  for (const { repository, pluginPath = "", id } of inputs.plugins) {
    const directory = path.join(root, ".dev/companions", repository.split("/").at(-1), pluginPath);
    const plugin = await observer.installDirectoryPlugin(directory, id);
    assert.equal(plugin.status, "running", JSON.stringify(plugin));
    assert.equal(plugin.error, undefined, JSON.stringify(plugin));
    installed.push({ id, status: plugin.status });
  }
  assert.deepEqual(await observer.invokePluginRpc("pr-watcher", "watch.list", {}), { watches: [] });
  await new Promise((resolve, reject) => {
    pageServer.once("error", reject);
    pageServer.listen(0, "127.0.0.1", resolve);
  });
  const browserResult = await observer.invokePluginRpc("remote-browser", "browser.control", {
    workspaceId: workspace.id,
    action: "navigate",
    url: "http://127.0.0.1:" + pageServer.address().port,
  });
  assert.equal(browserResult.title, "Paseo bundle smoke");
  const browserStreamController = new AbortController();
  let browserFrame;
  let browserStreamId;
  const browserStream = observer.observePluginRpc(
    "remote-browser",
    "browser.stream",
    { workspaceId: workspace.id },
    { signal: browserStreamController.signal },
  );
  const stopBrowserStream = browserStream.subscribe({
    snapshot() {},
    binary(frame) {
      browserFrame = frame;
    },
    update(message) {
      if (message.type !== "plugin.rpc.event") return;
      const event = message.payload.event;
      if (event instanceof Uint8Array) browserFrame = event;
      else browserStreamId = event.streamId;
    },
  });
  try {
    await browserStream.ready;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (browserFrame) break;
      await delay(100);
    }
    assert.ok(browserFrame?.byteLength > 100, "Browser stream did not deliver a JPEG frame");
    assert.equal(browserFrame[4], 0xff);
    assert.equal(browserFrame[5], 0xd8);
    assert.equal(typeof browserStreamId, "string");
    await observer.invokePluginRpc("remote-browser", "browser.ack", {
      streamId: browserStreamId,
      sequence: new DataView(browserFrame.buffer, browserFrame.byteOffset, 4).getUint32(0),
    });
  } finally {
    stopBrowserStream();
    browserStreamController.abort();
    await browserStream.release();
  }
  const terminal = await workspace.terminals.create({
    command: process.execPath,
    args: ["-e", "console.log('PASEO_PATCHED_V016_OK'); setInterval(() => {}, 1000)"],
  });
  let output = "";
  for (let attempt = 0; attempt < 60; attempt++) {
    output = (await terminal.capture({ stripAnsi: true })).lines.join("\n");
    if (output.includes("PASEO_PATCHED_V016_OK")) break;
    await delay(100);
  }
  assert.ok(output.includes("PASEO_PATCHED_V016_OK"), output);
  await terminal.kill();
  await writeFile(
    path.join(cwd, "paseo.json"),
    JSON.stringify({
      worktree: { portBlockSize: 2 },
      launches: {
        smoke: {
          command: `${process.execPath} -e ${JSON.stringify("console.log('PASEO_LAUNCH_RESTART_OK'); setInterval(() => {}, 1000)")}`,
        },
      },
    }),
  );
  const started = await observer.startWorkspaceLaunch(workspace.id, "smoke");
  assert.equal(started.error, null);
  assert.ok(started.launch?.terminalId);
  for (let attempt = 0; attempt < 60; attempt++) {
    output = (
      await observer.captureTerminal(started.launch.terminalId, { stripAnsi: true })
    ).lines.join("\n");
    if (output.includes("PASEO_LAUNCH_RESTART_OK")) break;
    await delay(100);
  }
  assert.ok(output.includes("PASEO_LAUNCH_RESTART_OK"), output);
  await sdk.close();
  await stopDaemonInstance(home, {
    instance,
    timeoutMs: 20_000,
    keepTerminals: true,
    requestShutdown: async () => {
      await observer.shutdownServer({ keepTerminals: true });
    },
  });
  await observer.close();
  const relaunched = await startDaemonInstance(launchOptions);
  instance = relaunched.instance;
  observer = new DaemonClient({
    url: `ws://${instance.listen}/ws`,
    clientId: "compiled-restart-smoke",
  });
  await observer.connect();
  const recovered = await observer.listWorkspaceLaunches(workspace.id);
  assert.equal(recovered.error, null);
  assert.equal(recovered.launches.length, 1);
  assert.equal(recovered.launches[0].terminalId, started.launch.terminalId);
  assert.equal(recovered.launches[0].portBase, started.launch.portBase);
  assert.equal(recovered.launches[0].portCount, 2);
  assert.equal(recovered.launches[0].active, true);
  const stopResult = await observer.stopWorkspaceLaunch(workspace.id, "smoke");
  assert.equal(stopResult.error, null);
  output = (
    await observer.captureTerminal(started.launch.terminalId, { stripAnsi: true })
  ).lines.join("\n");
  assert.ok(output.includes("PASEO_LAUNCH_RESTART_OK"), output);
  console.log(
    JSON.stringify({
      version: info.version,
      listen: instance.listen,
      idleRuntimeCleanup: config.config.idleRuntimeCleanup,
      hostInstructions: "passed",
      terminal: "passed",
      launchRecovery: "passed",
      retainedOutput: "passed",
      build: root,
      installed,
      browserRpc: "passed",
      browserStream: "passed",
    }),
  );
} catch (error) {
  const log = await readFile(path.join(home, "daemon.log"), "utf8").catch(() => "");
  console.error(log.split("\n").slice(-25).join("\n"));
  throw error;
} finally {
  await sdk?.close();
  await observer?.close();
  if (instance) {
    await stopDaemonInstance(home, { instance, timeoutMs: 20_000, force: true });
    stopped = true;
  }
  if (pageServer.listening) await new Promise((resolve) => pageServer.close(resolve));
  if (stopped) await rm(home, { recursive: true, force: true });
}
