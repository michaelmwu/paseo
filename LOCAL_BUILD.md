# Local patched Linux daemon

This branch is a private deployment bundle. Its independent feature patches have their own
upstream review histories; do not open a combined upstream PR for this branch.

## Inputs

- Release: `v0.16.0-beta.1`, `5196801fd` (latest 0.16 tag checked November 11).
- Retained patch set: `daemon-patches-v0.15.3`, `d4dcfbbde`.
- Daemon/CLI feature delta from PR [#4525](https://github.com/getpaseo/paseo/pull/4525),
  `0c284e08836109572458bd7594ca17157fe7d725`, including lease recovery,
  persistent-shell refresh, live policy, script identity, trusted teardown, and
  serialization of recovery/spawning with workspace cleanup. Unrelated main commits
  carried by its branch are excluded.
- Merged PR [#7782](https://github.com/getpaseo/paseo/pull/7782) is already in this release;
  its previous backport is not replayed.
- Offline outbox [#9332](https://github.com/getpaseo/paseo/pull/9332): `d6a76207d`.
- Changes per foreground turn [#9333](https://github.com/getpaseo/paseo/pull/9333): `65ec8119b`.
- Remote browser tunnel and named CLI forwarding [#9334](https://github.com/getpaseo/paseo/pull/9334):
  `ef3cff40a`. Its #6534 dependency is included once, not applied separately.
- Desktop interactive element picker [#3190](https://github.com/getpaseo/paseo/pull/3190):
  `595852d3c`, adapted to the release's extracted selector controller.

The retained features include project linking, transcript attachment sources and consented
cross-host attachment sources, native session continuation, `.worktreeinclude`, project
local-file import, workspace launch definitions, Codex startup serialization, repeated
unacknowledged interrupt handling, and async-question handling.

The provider-specific idle eviction from #5259 and its follow-ups are removed, including
`agents.codexIdleBackendTimeoutMs`. The release supplies the shared collector and the live
`agents.idleRuntimeCleanup` switch instead.

Integration preserves 0.16 provider controls, immutable launch environments, background work,
workspace creation metadata, composer ownership, and persistent terminal timestamps. The release
now supplies Codex startup serialization, so its coordinator and diagnostics replace the old copy.
Repeated unacknowledged interrupt escalation preserves upstream turn-owned terminal cleanup.
Local-file import stays behind explicit missing-file approval and the workspace automation gate.
Launch recovery uses the release's complete `listAll()` registry API. Worker protocol 7 drains
released protocol 6 workers instead of reusing their version for a different metadata contract.

A local retention correction drains queued terminal output before publishing exit and keeps
the headless buffer alive for retained sessions until explicit removal. This fixes the real
launch-output regression exposed while validating #4525 with a complete dependency install.

## Verification

- Locked install with lifecycle scripts disabled; dependency patches applied explicitly.
- Server dependency stack, server and CLI builds, full workspace typecheck, formatting, and lint pass.
- Outbox, per-turn Git snapshots, tunnel framing/policy/session, and named TCP forwarding: 194 pass.
- Real tunnel/permission/reconnect integration, selector lifecycle, and locale contracts: 50 pass.
- Launch recovery, script bootstrap, worker protocol, worktreeinclude, and local-file import:
  109 pass, one existing platform skip.
- Selected Codex repeated-cancel, stale-timeout, native-fork, and secret-answer cases: five pass.
- Adapted element-picker regressions: five pass, including enabled/disabled targets, suppressed
  page actions, preserved decorative hit testing, and retained selector session tokens.
- Compiled supervisor smoke: fresh temporary home, random loopback port, daemon version
  0.16.0-beta.1, cleanup capability/default enabled, real PTY output and clean shutdown pass.
- Compiled keep-terminals restart: same launch terminal and port block are recovered;
  output remains readable after explicitly stopping the recovered launch.

The full suite and mobile/desktop builds were not run. Outbox UI, turn-change UI, Electron
routing, and the picker require a matching patched client; replacing only the daemon does not
change an installed phone or desktop app. Phone-side local forwarding remains pending in #9331.

## Replace the production daemon

From an independent SSH login or console, run:

```bash
bash /home/michaelmwu/dev/paseo-daemon-patches-v0.16.0-beta.1/scripts/replace-local-patched-daemon.sh
```

The script validates the built CLI and supervisor before writing a systemd drop-in, then
restarts `paseo.service`. Existing Paseo-managed agents stop during that restart. The script
refuses a shell in the service cgroup, preserves the current service and drop-ins, and backs
up its own previous override. Daemon state remains in `/home/michaelmwu/.paseo`.

Paseo 0.13 uses `daemon run` for foreground deployment. The old `daemon start --foreground
--listen ... --no-web-ui` flags are removed. Deployment listen/web settings are environment
overrides on `daemon run`.

## Companion plugins

These are separate, unchanged plugin source worktrees under this artifact's ignored
`.dev/companions/`, not patches in the Paseo monorepo. Keep those directories with the artifact.
Their locked host dependencies are supplied by this checkout's installed dependency tree.
Every plugin passes typecheck against the built 0.16 API. Focused tests pass: action inbox seven,
PR watcher five, issue workflow ten, and host browser three including real Chrome navigation,
JPEG capture, and clicking a page control.

Reviewed PR #1 source pins:

- `508-dev/paseo-action-inbox`: `dda7482794e9224dbf0fc51fd42206c3b1204a94`.
- `508-dev/paseo-pr-watcher`: `9f31c56f504419cbc003058b30de491fbd00f9e3`.
- `508-dev/paseo-issue-workflow`: `e7c978d5c687b0c9df11f0ddf662da23cfdd981e`.
- `508-dev/paseo-remote-browser`: `f27310af893a12f83d8eb9a402945e09b889630b`.

Action inbox, PR watcher, and issue workflow compile and reach `running` when installed in an
isolated compiled daemon. No production plugin configuration was changed. After deploying the
new daemon, install the three verified plugins with:

```bash
bash /home/michaelmwu/dev/paseo-daemon-patches-v0.16.0-beta.1/scripts/install-local-companion-plugins.sh
```

The helper requires plugins to be explicitly enabled already, verifies the reviewed revisions
and clean tracked sources, and does not restart Paseo. Plugins are trusted, unsandboxed code.
PR watcher is opt-in through `/watch-pr`; issue workflow needs `GITHUB_TOKEN` for private repos.
Client contributions require a compatible 0.16 app.

Host-browser installation is blocked despite its standalone Chrome test passing: Paseo's plugin
bundler cannot resolve `chromium-bidi/lib/cjs/bidiMapper/BidiMapper` and
`chromium-bidi/lib/cjs/cdp/CdpConnection` imported by Playwright's optional BiDi implementation.
Its manifest also has no Git preparation step for its runtime dependency. No plugin source,
lockfile, or manifest was changed to conceal that packaging issue, and the helper does not install
it. Fix and verify the plugin's packaging before enabling it in production.
