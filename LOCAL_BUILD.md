# Local patched Linux daemon

Local deployment bundle based on `v0.17.0-beta.1` (`6c89950b2`), the newest
published tag checked on November 20, 2026. The latest stable is `v0.16.2`;
this build deliberately uses the requested beta. It retains the verified Linux
bundle `29f961ad1` while integrating the release and refreshing advanced sources.
The shared checkout, earlier artifacts, production service and live plugins are
unchanged. This is a fork deployment record, not an aggregate upstream proposal.

## Inputs

[local-build-inputs.json](local-build-inputs.json) records complete source revisions.

| Feature                                             | Revision    |
| --------------------------------------------------- | ----------- |
| Project linking #4052, live linked branch           | `ca620522f` |
| Transcript attachment contract #4627                | `07e750d7c` |
| Cross-host/native continuation #2496, linked branch | `b370aadf2` |
| Project local-file import #4381, linked branch      | `c5c050148` |
| Worktreeinclude conflict repairs, not #2419         | `b8be2560e` |
| Workspace launches #4525                            | `5ae973538` |
| Offline outbox #9332                                | `8562246f1` |
| Receipt reconciliation #9548                        | `ccab6ce52` |
| Codex interruption recovery #9550                   | `b135ee8fb` |
| Per-turn changes #9333                              | `5c40d9dc0` |
| Browser tunnel/named forwarding #9334               | `ffcd2c78a` |
| Desktop element picker #3190                        | `595852d3c` |

Closed historical PR diffs are not replayed over their live linked branches.
Feature-only refreshes exclude unrelated main history from PR branch merges.
#7782, #9580 and the #9757/#9931 startup/message-queue prerequisites are in the
release; none is replayed as an extra patch. #6534 and #9549/#5633 dependencies
remain included once. Superseded #5259 and #2419 stay excluded.

Integration preserves the release's withdrawn-message admission, browser host
registration, existing-worktree selection, provider controls and plugin instruction
contracts. The patch stack retains receipt identity, read-only uncertain-delivery
checks, fresh cross-window attachment references and per-agent FIFO barriers.
Turn snapshots serialize with Stop and skip disposable internal agents. A canceled
unsaved Codex thread is replaced rather than resumed; fixtures model that boundary.
Worktree branch rollback and remote setup stay inside their cleanup ownership.

## Companion plugins

All eight sources are pinned to `508-dev/paseo-plugins` at
`57cc6986dfc0aca97f397d07b141bf51051d233c`: current collection main
`66291e146` plus the focused [PR watcher compatibility update](https://github.com/508-dev/paseo-plugins/pull/14).

| Collection path               | Runtime ID            |
| ----------------------------- | --------------------- |
| `plugins/action-inbox`        | action-inbox          |
| `plugins/pr-watcher`          | pr-watcher            |
| `plugins/issue-workflow`      | github-issue-workflow |
| `plugins/remote-browser`      | remote-browser        |
| `plugins/agent-context`       | agent-context         |
| `plugins/project-environment` | project-environment   |
| `plugins/worktreeinclude`     | paseo-worktreeinclude |
| `plugins/replies`             | replies-508           |

This includes compact Action inbox navigation, hidden-by-default failure rows,
workspace environment overrides, streamlined PR watcher setup, browser streaming
and companion forwarding, worktreeinclude symlinks, and editable Replies suggestions.

PR watcher previously rejected the new beta. Its manifest now admits exactly
`0.17.0-beta.1` in addition to the 0.16 series. Unverified later 0.17 builds remain
gated; the daemon compatibility check is unchanged. No runtime ID, saved settings
or plugin behavior changes as part of that exception.

Each plugin has independently installed locked dependencies under
`.dev/companions/paseo-plugins/plugins/`. Plugins are trusted, unsandboxed code.
Existing installations are not removed, reloaded or migrated by this rebuild.
Moving a Git/npm/directory source needs an explicit settings-preserving migration.
The install helper refuses a different source before changing any configuration.

## Verification

All builds, installs and tests use `paseo-resources job`. Core and companion
dependencies use committed lockfiles with lifecycle scripts initially disabled.
Reviewed repository dependency patches and native PTY preparation run explicitly.
Logs are in this artifact's ignored `.dev/` directory.

- Server dependency stack, server and CLI compile.
- Full workspace typecheck, lint and formatting pass.
- Launch/receipt/delivery/turn-change/archive/projection tests: 113 pass.
- Codex process recovery tests: 29 pass.
- Sender receipt/start/capture/admission regressions: 21 targeted cases pass;
  SDK tunnel/delivery regressions: 27 pass. Nine branch/restore/rollback cases
  also pass after the final worktree integration cleanup.
- Outbox, project-link models/store, selectors, import-session and CLI forwarding:
  102 pass. Host-runtime tests use the app's unit configuration: 120 pass.
- Worktree/include tests: 61 pass, one platform skip. Tunnel schemas, framing,
  target policy and sessions: 217 pass.
- All eight independent companion typechecks and available lint scripts pass.
- Updated companion tests: Action inbox 17, environment 16, browser/tunnel 15
  including real Chrome, and PR watcher compatibility/workspace 13 pass.
- Compiled isolated supervisor smoke: all eight plugins running, browser navigation,
  streamed JPEG frames and acknowledgement, real PTY output, launch port leases
  after restart and retained launch output pass. No real model call is required.

The smoke command targets a temporary home and random loopback port:

```bash
paseo-resources job -- node scripts/smoke-local-patched-daemon.mjs
```

No full local suite, mobile/desktop binary or physical-device UI testing is claimed.
Prior server CI's restored-OMP-history failures are not chased again in this build;
broad Linux/Windows CI remains a separate gate. A patched daemon does not install
a patched client. Client UI features require the matching client.

## Deploy

Use an independent SSH login or console, not a Paseo-managed shell:

```bash
bash /home/michaelmwu/dev/paseo-daemon-patches-v0.17.0-beta.1/scripts/replace-local-patched-daemon.sh
```

This restarts production and stops Paseo-managed agents. The helper checks the
built beta version, rejects shells in the service cgroup, backs up its override
and CLI link, and points systemd directly at this artifact's compiled CLI with
Node 22.20.0 and `daemon run`. It retains `/home/michaelmwu/.paseo` and
`127.0.0.1:6767`.

For fresh plugin installations, or sources already pointing to this exact bundle:

```bash
bash /home/michaelmwu/dev/paseo-daemon-patches-v0.17.0-beta.1/scripts/install-local-companion-plugins.sh
```

The plugin helper requires this daemon version and explicitly enabled plugins.
If it refuses an older source, stop and plan a settings-preserving migration.
Neither deployment helper was executed while preparing this build.
