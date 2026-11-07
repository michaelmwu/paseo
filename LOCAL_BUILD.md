# Local patched Linux daemon

This branch is a private deployment bundle. Its independent feature patches have their own
upstream review histories; do not open a combined upstream PR for this branch.

## Inputs

- Release: `v0.15.3`, `d91ae138c`.
- Retained validated patch set: `daemon-patches-v0.15.1`, `fdcc35f00`.
- Daemon/CLI feature delta from PR [#4525](https://github.com/getpaseo/paseo/pull/4525),
  `0c284e08836109572458bd7594ca17157fe7d725`, including lease recovery,
  persistent-shell refresh, live policy, script identity, trusted teardown, and
  serialization of recovery/spawning with workspace cleanup. Unrelated main commits
  carried by its branch are excluded.
- Merged PR [#7782](https://github.com/getpaseo/paseo/pull/7782) is already in this release;
  its previous backport is not replayed.

The retained features include project linking, transcript attachment sources and consented
cross-host attachment sources, native session continuation, `.worktreeinclude`, project
local-file import, workspace launch definitions, Codex startup serialization, repeated
unacknowledged interrupt handling, and async-question handling.

The provider-specific idle eviction from #5259 and its follow-ups are removed, including
`agents.codexIdleBackendTimeoutMs`. The release supplies the shared collector and the live
`agents.idleRuntimeCleanup` switch instead.

Integration preserves v0.15.3 asynchronous configuration, lifecycle-hook worktree placement,
branch-ownership cleanup, and persistent terminal workers. Local-file import remains behind
the workspace automation gate with explicit missing-file approval and serialized async writes.
The prior bundle's client contributions are retained against release client APIs; the PR's
post-release client refactors are not imported.
The release's complete `WorkspaceRegistry.list()` API replaces the newer PR's `listAll()`
calls. The launch button uses the release's supported `sm` control size. Stopping a legacy
service hidden by a project launch returns its stopped status without restoring it to listings.

A local retention correction drains queued terminal output before publishing exit and keeps
the headless buffer alive for retained sessions until explicit removal. This fixes the real
launch-output regression exposed while validating #4525 with a complete dependency install.

## Verification

- Locked install with lifecycle scripts disabled; dependency patches applied explicitly.
- `npm run build:server`, full workspace `npm run typecheck`, formatting and lint pass.
- Focused launch/recovery, runtime environment, automation, port registry, worktree bootstrap,
  archive, script service, and config-write regressions pass.
- Worktreeinclude, local-file import, worktree session, worker protocol, and transcript plugin:
  79 tests pass, one existing platform skip.
- Script service, launch capability, attachment model, and config schema: 42 tests pass.
- Retained-terminal stop regression and selected config-write/session tests pass.
- Compiled supervisor smoke: fresh temporary home, random loopback port, daemon version
  0.15.3, cleanup capability/default enabled, real PTY output and clean shutdown pass.
- Compiled keep-terminals restart: same launch terminal and port block are recovered;
  output remains readable after explicitly stopping the recovered launch.

The full test suite and mobile/desktop application builds were not run. Installed client
contributions still require a client build containing the corresponding app patches.
Unchanged Codex/native-continuation behavior retains the previous bundle's validation;
those provider tests were not rerun for this rebuild.

## Replace the production daemon

From an independent SSH login or console, run:

```bash
bash /home/michaelmwu/dev/paseo-daemon-patches-v0.15.3/scripts/replace-local-patched-daemon.sh
```

The script validates the built CLI and supervisor before writing a systemd drop-in, then
restarts `paseo.service`. Existing Paseo-managed agents stop during that restart. The script
refuses a shell in the service cgroup, preserves the current service and drop-ins, and backs
up its own previous override. Daemon state remains in `/home/michaelmwu/.paseo`.

Paseo 0.13 uses `daemon run` for foreground deployment. The old `daemon start --foreground
--listen ... --no-web-ui` flags are removed. Deployment listen/web settings are environment
overrides on `daemon run`.
