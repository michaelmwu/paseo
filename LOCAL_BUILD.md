# Local patched Linux daemon

Local deployment bundle based on `v0.16.1` (`c09a3d81e`), the latest release checked
on November 18, 2026. This refresh builds on the task's maintenance head `2baf466c3`.
The shared checkout, earlier artifacts, production service and live plugin configuration
are unchanged. This is a fork deployment record, not a combined upstream feature proposal.

## Inputs

[local-build-inputs.json](local-build-inputs.json) records full revisions. Active PRs and
the live linked project branch are refreshed; closed historical PR diffs are not replayed.

| Feature                               | Source revision                        |
| ------------------------------------- | -------------------------------------- |
| Project linking #4052                 | `ca620522f`, live linked branch        |
| Transcript attachment contract #4627  | `07e750d7c`                            |
| Cross-host/native continuation #2496  | `b370aadf2`, retained linked branch    |
| Project local-file import #4381       | `c5c050148`, retained linked branch    |
| Worktreeinclude conflict repairs      | `b8be2560e`, not #2419                 |
| Workspace launches #4525              | `46230492d`                            |
| Offline outbox #9332                  | `8562246f1`                            |
| Receipt reconciliation #9548          | `ccab6ce52`                            |
| Codex interruption recovery #9550     | `4187a7826`, includes #9549/#5633 once |
| Per-turn changes #9333                | `174df883a`                            |
| Browser tunnel/named forwarding #9334 | `7ea5feeb3`, includes #6534 once       |
| Desktop element picker #3190          | `595852d3c`                            |

Merged #9757 message-queue and #9931 sender-bound startup/cancellation prerequisites
remain explicit backports. Feature-only deltas exclude unrelated main commits brought
into PR branches. #7782 and #9580 are already in the release; neither is replayed.
The superseded Codex-only collector #5259 stays excluded.

The refreshed receipt/outbox contract distinguishes definite rejection from unknown
delivery and checks receipts without resending uncertain attempts. It preserves exact
image payloads for reconciliation. Local maintenance safeguards still collect fresh
cross-window image references and block an agent's queued successors behind an
unresolved earlier send. Other agents can continue independently.

Release foreground serialization, cancellation during Git capture, sender-specific
readiness, archive timestamps and successor permission ownership are retained.
Launch updates validate configuration before switching, clean up failed starts and
preserve stopped output. Project-linking updates cover durable writes, verification
and incomplete host hydration.

## Companion plugins

The seven existing plugins and Replies use the canonical collection
[`508-dev/paseo-plugins`](https://github.com/508-dev/paseo-plugins), pinned at
`a5a78ada816cc05cc192686d903911c22255b0c4`. Each plugin is independently installed
from its committed lockfile under `.dev/companions/paseo-plugins/plugins/`.

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

This refresh includes workspace PR discovery, interactive browser streaming/companion
forwarding, environment-value visibility controls, and the worktreeinclude symlink fork.
Replies is prepared as a new plugin, not an update to an existing runtime ID. It
generates editable suggestions through the configured Claude CLI; it never sends
automatically. Its model/executable configuration is separate from the agent's provider.

Plugins are trusted, unsandboxed code. Existing installed sources and settings are not
changed by building or testing this bundle. Moving an existing Git/npm/directory install
to the collection needs an explicit settings-preserving migration. Do not remove and
reinstall as a source-migration shortcut. The helper refuses a different existing source
before changing any plugin configuration; it requires plugins to be explicitly enabled.

## Verification

The core dependency tree is reused from the same committed lockfile; companion installs
use `npm ci` with lifecycle scripts disabled. All builds and tests use
`paseo-resources job`. Fresh logs are in this artifact's ignored `.dev/` directory.

- Server dependency stack, server and CLI build pass.
- Full workspace typecheck, lint and formatting pass.
- Outbox, project-link models/store, host grouping, selectors and project selection:
  101 focused tests pass.
- Codex process retirement/recovery: 28 pass using the server's normal test configuration;
  launch/receipt/run-state tests: 64 pass.
- Sender startup, pending receipt recovery, capture cancellation and native OMP/Pi
  admission: 23 targeted cases pass.
- Composer submission, timeline, replica, project UI and protocol tests: 236 pass;
  SDK delivery-status/outcome tests: two pass; projection/session tests: 196 pass.
- All eight companion typechecks and available lint scripts pass.
- PR watcher workspace/recovery tests: 14 pass; browser/tunnel tests: 15 pass,
  including all nine browser cases with real Chrome explicitly enabled; environment
  tests: 16 pass; worktreeinclude copy/symlink tests: five pass; Replies tests: 25 pass.
- Compiled isolated supervisor smoke passes with all eight plugins running, browser
  navigation and streamed JPEG/ack RPC, real PTY output, restart lease recovery and
  retained launch output. No real model call is made by the Replies fixtures or smoke.

Run the compiled isolated supervisor smoke with:

```bash
paseo-resources job -- node scripts/smoke-local-patched-daemon.mjs
```

It uses a temporary daemon home and random loopback port, loads each pinned plugin,
checks browser navigation/frame-stream RPC and PTY output, and checks launch lease/output
recovery across an isolated supervisor restart. It never uses production port 6767.

Full CI remains a separate gate. Prior maintenance CI has outstanding OMP restored-history
timeouts after two fixture fixes; those cases are deferred rather than skipped or given
longer timeouts. This rebuild does not claim full server-suite, physical-device or desktop
binary verification. A patched daemon does not install a patched client; client features
require the matching client. Phone-side forwarding remains separate from host forwarding.

## Deploy

Run from an independent SSH login or console, not a Paseo-managed shell:

```bash
bash /home/michaelmwu/dev/paseo-daemon-patches-v0.16.1-refresh-20261118/scripts/replace-local-patched-daemon.sh
```

This restarts production and stops Paseo-managed agents. The helper checks the built
version, rejects shells in the service cgroup, backs up its override and CLI link, and
points systemd directly at this artifact's compiled CLI and Node 22.20.0. It preserves
`/home/michaelmwu/.paseo` and `127.0.0.1:6767`, using `daemon run`.

For a fresh plugin installation, or a reload already pointing to these exact sources:

```bash
bash /home/michaelmwu/dev/paseo-daemon-patches-v0.16.1-refresh-20261118/scripts/install-local-companion-plugins.sh
```

The plugin command requires a running 0.16.1 daemon and explicitly enabled plugins;
it does not restart the daemon. If it refuses an older source, stop and plan the
settings-preserving migration rather than deleting the existing installation.
Neither deployment command was executed while preparing this build.
