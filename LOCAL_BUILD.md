# Local patched Linux daemon

This branch is a private deployment bundle. Its independent feature patches have their own
upstream review histories; do not open a combined upstream PR for this branch.

## Inputs

- Release: `v0.13.2`, `d2941157a`.
- Retained local patch set: `daemon-patches-v0.12.0-beta.2`, `3e38d077c`.
- Backport: merged PR [#7782](https://github.com/getpaseo/paseo/pull/7782),
  `8e5f5367666951a7f5933cbb9f66c8047ba8a399`.

The retained features include project linking, transcript attachment sources and consented
cross-host attachment sources, native session continuation, `.worktreeinclude`, project
local-file import, workspace launch definitions, Codex startup serialization, repeated
unacknowledged interrupt handling, and async-question handling.

The provider-specific idle eviction from #5259 and its follow-ups are removed, including
`agents.codexIdleBackendTimeoutMs`. #7782 supplies the shared collector and the live
`agents.idleRuntimeCleanup` switch instead. Neither v0.13.1 nor v0.13.2 contains that merge;
it is explicitly backported here.

Integration preserves v0.13.2 workspace setup observations, workspace sorting, runtime-store
ownership, plugin translations and serialized icons. Local-file import remains behind the
workspace automation gate and preserves missing-file approval during deferred setup.

## Verification

- Locked install with lifecycle scripts disabled; dependency patches applied explicitly.
- `npm run build:server`, full workspace `npm run typecheck`, formatting and lint pass.
- Retained patch regressions: 136 server tests pass, one existing platform skip; 116 app tests pass.
- Merged cleanup: 19 collector tests, 64 config/bootstrap/finish-subscription tests, seven
  selected manager tests and 15 selected Codex safety/interrupt/fork tests pass.
- Compiled supervisor smoke: fresh temporary home, random loopback port, daemon version
  0.13.2, cleanup capability/default enabled, real PTY output and clean shutdown pass.

The full test suite and mobile/desktop application builds were not run. Installed client
contributions still require a client build containing the corresponding app patches.

## Replace the production daemon

From an independent SSH login or console, run:

```bash
bash /home/michaelmwu/dev/paseo-daemon-patches-v0.13.2/scripts/replace-local-patched-daemon.sh
```

The script validates the built CLI and supervisor before writing a systemd drop-in, then
restarts `paseo.service`. Existing Paseo-managed agents stop during that restart. The script
refuses a shell in the service cgroup, preserves the current service and drop-ins, and backs
up its own previous override. Daemon state remains in `/home/michaelmwu/.paseo`.

Paseo 0.13 uses `daemon run` for foreground deployment. The old `daemon start --foreground
--listen ... --no-web-ui` flags are removed. Deployment listen/web settings are environment
overrides on `daemon run`.
