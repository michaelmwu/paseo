# Local patched Linux daemon

This branch is a private deployment bundle. Its independent feature patches have their own
upstream review histories; do not open a combined upstream PR for this branch.

## Inputs

- Release: `v0.14.0`, `8c6de842a`.
- Retained validated patch set: `daemon-patches-v0.13.2`, `b51886e11`.
- Merged PR [#7782](https://github.com/getpaseo/paseo/pull/7782) is already in this release;
  its previous backport is not replayed.

The retained features include project linking, transcript attachment sources and consented
cross-host attachment sources, native session continuation, `.worktreeinclude`, project
local-file import, workspace launch definitions, Codex startup serialization, repeated
unacknowledged interrupt handling, and async-question handling.

The provider-specific idle eviction from #5259 and its follow-ups are removed, including
`agents.codexIdleBackendTimeoutMs`. The release supplies the shared collector and the live
`agents.idleRuntimeCleanup` switch instead.

Integration preserves v0.14.0 asynchronous project-config ownership and authorization,
virtualized Import Session results, queued Codex image/completion delivery, and plugin agent
tools. Local-file import remains behind the workspace automation gate and preserves missing-file
approval during deferred setup. Its filesystem operations are asynchronous, with per-target
publication queues preserving revision checks across concurrent daemon sessions.

## Verification

- Locked install with lifecycle scripts disabled; dependency patches applied explicitly.
- `npm run build:server`, full workspace `npm run typecheck`, formatting and lint pass.
- Focused config/launch/local-file integration: 69 tests pass, including concurrent revision
  replacement and recovery after a rejected write.
- Retained worktree/import/startup regressions: 121 tests pass, one existing platform skip.
- Client feature regressions: 109 tests pass; plugin/attachment/schema contracts: 32 tests pass.
- Selected Codex safety/interrupt/fork/image/secret-answer tests: 18 pass; native continuation:
  one selected manager test passes.
- Compiled supervisor smoke: fresh temporary home, random loopback port, daemon version
  0.14.0, cleanup capability/default enabled, real PTY output and clean shutdown pass.

The full test suite and mobile/desktop application builds were not run. Installed client
contributions still require a client build containing the corresponding app patches.

## Replace the production daemon

From an independent SSH login or console, run:

```bash
bash /home/michaelmwu/dev/paseo-daemon-patches-v0.14.0/scripts/replace-local-patched-daemon.sh
```

The script validates the built CLI and supervisor before writing a systemd drop-in, then
restarts `paseo.service`. Existing Paseo-managed agents stop during that restart. The script
refuses a shell in the service cgroup, preserves the current service and drop-ins, and backs
up its own previous override. Daemon state remains in `/home/michaelmwu/.paseo`.

Paseo 0.13 uses `daemon run` for foreground deployment. The old `daemon start --foreground
--listen ... --no-web-ui` flags are removed. Deployment listen/web settings are environment
overrides on `daemon run`.
