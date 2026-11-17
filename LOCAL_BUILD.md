# Local patched Linux daemon

Local deployment bundle based on `v0.16.1` (`c09a3d81e`), released November 17, 2026.
The shared checkout, earlier artifacts, production service and live plugin configuration
are unchanged. This is not a combined upstream feature proposal.

## Inputs

[local-build-inputs.json](local-build-inputs.json) records the source revisions. This build
reconstructs the verified `1eb6ef698` bundle on the release and refreshes active feature PRs:

| Feature                               | Source revision                        |
| ------------------------------------- | -------------------------------------- |
| Project linking #4052                 | `a9d4a6828`, retained linked branch    |
| Transcript attachment contract #4627  | `07e750d7c`                            |
| Cross-host/native continuation #2496  | `b370aadf2`, retained linked branch    |
| Project local-file import #4381       | `c5c050148`, retained linked branch    |
| Worktreeinclude conflict repairs      | `b8be2560e`, not #2419                 |
| Workspace launches #4525              | `fbba8b055`                            |
| Offline outbox #9332                  | `c41c71400`                            |
| Receipt reconciliation #9548          | `0d4b149e2`                            |
| Codex interruption recovery #9550     | `6776c4dbf`, includes #9549/#5633 once |
| Per-turn changes #9333                | `174df883a`                            |
| Browser tunnel/named forwarding #9334 | `7ea5feeb3`, includes #6534 once       |
| Desktop element picker #3190          | `595852d3c`                            |

The latest receipt/interruption stack requires merged #9757 message-queue and #9931
sender-bound startup/cancellation contracts. Their implementations are backported explicitly.
Unrelated commits from feature-branch merges are excluded. #7782 and #9580 are already in the
release; neither is replayed. The superseded Codex-only collector #5259 stays excluded.

Integration retains release provider controls and foreground serialization. Local capture
ownership guards prevent canceled prompts from reaching a provider after slow Git capture;
waiters do not mistake capture preparation for an idle result. Launch leases cover surviving
opted-in terminals, and retirement waits retain stopped output without reissuing live ports.

## Companion plugins

All seven companion pins are unchanged. Sources and their locked dependencies are retained in
the ignored `.dev/companions/` directory alongside this artifact.

| Repository                        | Runtime ID            | Revision    |
| --------------------------------- | --------------------- | ----------- |
| 508-dev/paseo-action-inbox        | action-inbox          | `ea9d65b2d` |
| 508-dev/paseo-pr-watcher          | pr-watcher            | `bc22f8dd3` |
| 508-dev/paseo-issue-workflow      | github-issue-workflow | `c05318346` |
| 508-dev/paseo-remote-browser      | remote-browser        | `3d6bea3d9` |
| 508-dev/paseo-agent-context       | agent-context         | `f5fae145a` |
| 508-dev/paseo-project-environment | project-environment   | `ceefd8213` |
| cprecioso/paseo-worktreeinclude   | paseo-worktreeinclude | `d32b1a4d1` |

Plugins are trusted, unsandboxed code. The plugin helper preserves matching existing source
paths and settings, refuses differing source content, and requires plugins to be explicitly
enabled already. Remote-browser verification uses `/usr/bin/google-chrome`. No issues or
discussions are created by either helper.

## Verification

The locked dependency install disables lifecycle scripts initially; inspected dependency
patches and the native PTY rebuild run explicitly. Logs for this rebuild live under `.dev/`.

- Server dependency stack, server and CLI build; full workspace typecheck, lint and formatting.
- Launches, scripts, receipts, queued delivery, Codex process retirement and turn changes:
  117 tests pass.
- Sender-bound starts, receipt recovery, cancellation/capture and successor permissions:
  21 targeted manager tests pass.
- Tunnel framing/demultiplexing, RPC schemas, target policy, tunnel sessions and outbox:
  246 tests pass.
- Worktreeinclude and runtime environment: 37 pass, one platform skip.
- Local-file, launch capability/target and attachment models: 19 pass.
- Codex interruption/compaction: 19 targeted tests pass. OpenCode acknowledgement: four pass.
- Final #9548/#9550 refresh: 12 targeted cases pass, covering failed Claude startup,
  OpenCode output-validation recovery, original out-of-band evidence and retirement rows.
- All seven pinned companion typechecks pass.
- Compiled isolated supervisor smoke: all seven plugins running, browser navigation/screenshot
  RPC, PTY output, restart lease recovery and stopped-launch output pass.

The compiled smoke uses a fresh temporary home and random loopback port, never production:

```bash
paseo-resources job -- node scripts/smoke-local-patched-daemon.mjs
```

The full test suite and mobile/desktop binaries are not built. Replacing the daemon does
not install a patched UI; client features require a matching client. Phone-side forwarding
is separate from the host plugin and named CLI forwarding.

Historical validation limitation: restored OMP history in `agent-loading.test.ts` timed out
after two targeted fixture fixes in the previous bundle. This rebuild does not retry that
suite or claim it green. An additional MCP/OMP regression, `delivers /follow-up to a running
OMP child while ordinary messages in the same quiet window wait`, times out at 30 seconds
after the no-capture fixture and native-start ordering adjustments; retries were stopped.
The same MCP selection passes 27 cases before that failure. Its exact pending operation is
not established, so OMP follow-up delivery is not verified by this build. CI remains the
broad-validation gate; this is not an all-green test-suite result.

## Deploy

Run from an independent SSH login or console, not a Paseo-managed shell:

```bash
bash /home/michaelmwu/dev/paseo-daemon-patches-v0.16.1/scripts/replace-local-patched-daemon.sh
bash /home/michaelmwu/dev/paseo-daemon-patches-v0.16.1/scripts/install-local-companion-plugins.sh
```

The first command restarts production and stops Paseo-managed agents. It checks the built
version, rejects shells in the service cgroup, backs up its override and CLI link, and points
systemd directly at this artifact's compiled CLI and Node 22.20.0. It preserves
`/home/michaelmwu/.paseo` and `127.0.0.1:6767`, using `daemon run`.

The second command installs/reloads the pinned plugins without restarting the daemon.
Neither deployment command was executed while preparing the build.
