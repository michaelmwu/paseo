# Local patched Linux daemon

This is a private deployment bundle, not a combined upstream feature proposal. The shared
checkout, earlier build artifacts, and production daemon are unchanged.

## Inputs

Release: `v0.16.0-beta.2`, `23bae61535542a45ade7196a7b3c152705f16de3`, the latest
published 0.16 tag checked November 13, 2026. Reconstructs the previous
`daemon-patches-v0.16.0-beta.1` bundle on the release, then refreshes task-owned feature deltas.
[local-build-inputs.json](local-build-inputs.json) records every reviewed branch and plugin pin.

- Project linking #4052: linked branch through `a9d4a6828`, including hydration, repository
  identity, link merging, persistence and dismissal protections.
- Transcript attachment contract #4627: `07e750d7c`. The standalone agent-context plugin
  supplies transcript snapshots; core retains New Agent shortcuts and chat-history ordering.
- Cross-host/native continuation #2496: linked branch `b370aadf2`; retains explicit consent
  for cross-host attachment sources.
- Project local-file import #4381: linked branch `c5c050148`, adapted to release automation,
  missing-file approval, asynchronous writes and workspace creation contracts.
- Worktreeinclude: `worktreeinclude-missing-files-conflict-fixed` at `b8be2560e`, including
  its split modules and destination/source safety repairs. Does not replay #2419.
- Workspace launches #4525: `20d1b2180`, including retained output, rejection of unreadable
  configuration, restart lease recovery and live port policy. Unrelated main commits from
  its merge history are excluded.
- Offline outbox #9332: `5e9f158ca`.
- Per-turn changes #9333: `21c285b72`, plus the local cancellation repair below.
- Browser network routing and named CLI forwarding #9334: `78742fdde`, including EOF
  cleanup and routing rollback. Its #6534 dependency is included once.
- Desktop interactive picker #3190: `595852d3c`, adapted to the release selector controller.

Merged #7782 is already in the release. Do not replay its old backport or the superseded
Codex-only idle collector #5259.

Integration keeps release provider controls, startup serialization, terminal timestamps,
retained buffers and worker compatibility. Additional local corrections prevent canceled
prompts from reaching a provider after Git capture, keep pending capture from looking idle
to waiters, omit absent optional snapshot fields, and retain the release's Codex constructor
contract. Generated configuration schema and translated docs match the local features.

## Companion plugins

Seven clean, pinned source worktrees live under the ignored `.dev/companions/` directory.
Keep that directory and the checkout's dependencies with this artifact.

| Repository                        | Runtime ID            | Revision  |
| --------------------------------- | --------------------- | --------- |
| 508-dev/paseo-action-inbox        | action-inbox          | ea9d65b2d |
| 508-dev/paseo-pr-watcher          | pr-watcher            | bc22f8dd3 |
| 508-dev/paseo-issue-workflow      | github-issue-workflow | c05318346 |
| 508-dev/paseo-remote-browser      | remote-browser        | 3d6bea3d9 |
| 508-dev/paseo-agent-context       | agent-context         | f5fae145a |
| 508-dev/paseo-project-environment | project-environment   | ceefd8213 |
| cprecioso/paseo-worktreeinclude   | paseo-worktreeinclude | d32b1a4d1 |

The four new companion PRs are merged; this build uses their current main revisions.
Remote browser now uses Puppeteer, has locked preparation commands, and installs successfully.
Its previous Playwright/BiDi bundling blocker no longer applies. Chrome must be installed;
verification used `/usr/bin/google-chrome`.

The existing production agent-context, project-environment and paseo-worktreeinclude sources
already match these runtime files. The helper preserves their source paths and settings and
reloads them. It installs missing plugins, refuses to replace differing existing sources, and
checks all pins before changing plugin configuration. It does not create GitHub issues.

## Verification

- Locked dependency install with lifecycle scripts disabled; dependency patches applied explicitly.
- Server dependency stack, server and CLI build.
- Full workspace typecheck, lint and formatting.
- Refreshed worktreeinclude and forwarding/router regressions: 110 pass, one platform skip.
- Linking, project structure and transcript attachment model: 45 pass.
- Launch scripts, retained output and dismissal lifecycle: 77 pass.
- Delayed-capture cancellation: two pass, before and after the cancellation-settlement timeout.
- All seven companion plugin typechecks pass. Focused tests: action inbox 15, PR watcher nine,
  issue workflow 12, agent context ten, project environment seven, remote browser six.
- Remote browser tests use real Chrome, including concurrent startup, popups and dialogs.
- Compiled supervisor smoke in a new temporary home on a random loopback port: all seven
  plugins running, empty watcher RPC, browser navigation and screenshot RPC, real PTY output,
  restart lease/terminal recovery, readable stopped-launch output and clean shutdown.

Run the compiled smoke again with:

```bash
node scripts/smoke-local-patched-daemon.mjs
```

The full test suite and mobile/desktop binaries were not built. Daemon replacement alone
does not install patched UI on a phone or desktop; UI features require a matching client.
Phone-side forwarding remains separate from the host-side plugin and CLI forwarding.

Known validation failure: the retained test `restored OMP history accepts mode before starting
an interactive turn` in `agent-loading.test.ts` still times out after two targeted fixture
adjustments for asynchronous snapshot preparation. Further retries were stopped. This bundle
is not an all-green test-suite result; the passing compiled smoke does not exercise OMP history
restoration. Cancellation regressions and the first seven loading cases pass. CI remains the
gate for broad validation; do not merge the deployment record solely on the smoke result.

## Deploy

Use an independent SSH login or console, not a shell managed by Paseo:

```bash
bash /home/michaelmwu/dev/paseo-daemon-patches-v0.16.0-beta.2/scripts/replace-local-patched-daemon.sh
bash /home/michaelmwu/dev/paseo-daemon-patches-v0.16.0-beta.2/scripts/install-local-companion-plugins.sh
```

The first command restarts production and stops Paseo-managed agents. It checks the built
version, refuses a shell inside the service cgroup, backs up its override and CLI link,
points systemd directly at this checkout's compiled CLI and Node 22.20.0, and keeps
`/home/michaelmwu/.paseo` on `127.0.0.1:6767`. It uses `daemon run`, not the removed
`daemon start --foreground` flags.

The second command requires plugins to be explicitly enabled already and does not restart
the daemon. Plugins are trusted, unsandboxed code with access to the daemon machine.
PR watcher is opt-in through `/watch-pr`; issue workflow uses your host's GitHub credentials.
No production restart, source replacement, plugin installation or reload was performed
while preparing this artifact.
