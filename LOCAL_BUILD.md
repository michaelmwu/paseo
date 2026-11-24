# Local patched Linux daemon

Deployment bundle based on official `v0.17.3`
(`dd7c0499a8c311fae7b3244722a64d73cc178e4a`), retaining the previous
verified bundle `061d48e38`. Work is isolated in
`/home/michaelmwu/dev/paseo-daemon-patches-v0.17.3`; the shared checkout,
old beta artifact, production service and live plugins are not changed.
This is a fork deployment record, not an aggregate upstream proposal.

## Inputs

[local-build-inputs.json](local-build-inputs.json) records full revisions.

| Feature                                                 | Revision    |
| ------------------------------------------------------- | ----------- |
| Project linking #4524 (historical #4052), linked branch | `19395860f` |
| Transcript attachments #4627                            | `07e750d7c` |
| Cross-host/native continuation #2496, linked branch     | `b370aadf2` |
| Project local-file import #4381, linked branch          | `c5c050148` |
| Worktreeinclude conflict repairs, not #2419             | `b8be2560e` |
| Workspace launches #4525                                | `5ae973538` |
| Offline outbox #9332                                    | `8562246f1` |
| Receipt reconciliation #9548                            | `ccab6ce52` |
| Codex interruption recovery #9550                       | `b135ee8fb` |
| Per-turn changes #9333                                  | `5c40d9dc0` |
| Browser tunnel/named forwarding #9334                   | `ffcd2c78a` |
| Desktop element picker #3190                            | `595852d3c` |
| Back/Forward tab and plugin-screen history #10173       | `5471a0a86` |
| Desktop workspace links #10256                          | `664eb46fe` |
| Host instruction defaults/workspace overrides #10320    | `c84679f11` |
| Sticky Workspaces header/Display menu #10325            | `0c80a810a` |

The latest #4524 update adds sidebar project-menu and settings entry points,
scoped matches/saved links, and stricter current-Git-fact checks. Apply only its
feature commits after main-merge `d6d29a764`, not the unrelated main history in
that branch. Preserve 0.17.3's project-settings Back ownership and the #10325
sticky-header content slots. The dialog remains alive while linking regroups
the sidebar; a local link never changes daemon project records.

#10325's PR is closed but unmerged, and the live
`sticky-workspaces-header` branch matches the requested head. Its four source/test
files are applied; existing upstream QA media are referenced rather than copied.
Other feature and companion heads remain pinned, not refreshed. A GitHub audit found none
of the selected PRs merged; historical linked branches stay intact.

#7782, #9580, #9757 and #9931 are already in the release. #6534 and #9549/#5633
remain included once through their selected parents. Superseded #5259 and #2419
stay excluded. The older [recent-PR audit](local-build-pr-audit.json) is a
November 20 snapshot, not a current all-PR inventory.

## Release integration

Release package metadata and lockfiles stay at exactly 0.17.3. Keep the release's
provider installation/metrics support, plugin worktree-manager hooks,
prepared branch-off metadata and checkout trust, live-directory restoration,
and new agent-message queue/Stop/steer ownership.

Receipt reconciliation adds original submission fingerprints to both queued
batches and direct prompts carrying queued messages. The new joined-prompt test
guards that boundary. Native continuation, Codex interrupt retirement, per-turn
capture, launch leases and worktreeinclude materialization remain present.
Worktree include warnings live in the ordinary Git recovery path; plugin-managed
restores retain the plugin's ownership.

Composer errors use the release's shared error alert while retaining View message
recovery and outbox controls. Draft attachment actions keep the chat-column rail.
#10256 retains an Electron-only listener and no-op browser/native export.

## Client features and limits

#10325 keeps the Workspaces header and Display menu reachable in Project and
Status grouping while Pinned scrolls away. It does not change ordering or
preferences. Like #10173 and #10256, it requires a matching patched client;
replacing only the daemon does not alter an official client's UI.

#10320 supports sender-wide Ask each time/Allow unattended defaults and
workspace inherit/ask/unattended/blocked overrides for existing conversations.
Existing grants stay readable and follow matching sender policies. Both daemons
need the workspace-policy revision; setup and approval need a patched client.
Creating new agents through restricted grants remains outside this prototype.

Packaged Electron, OS URL activation, native iOS/Android and physical devices
are not tested. #10256 remains a prototype with upstream review feedback about
superseded Add Host sessions, newer agent intents and embedded-browser forwarding.

## Companion plugins

All eight directory sources use `508-dev/paseo-plugins` at
`6f2957f4715e15f429fe770049de7f870e19486b`.
Feature code stays at the previous `57cc6986d` pin. The only changes are the
PR watcher manifest, matching catalog constraint and compatibility regression:
admit exactly stable 0.17.3 alongside the previously verified versions.
Unverified 0.17.4 and other 0.17 builds stay gated.
[Companion compatibility PR](https://github.com/508-dev/paseo-plugins/pull/14).

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

Dependencies are independently prepared from the unchanged plugin lockfiles.
Plugins are trusted, unsandboxed code. No live source is installed, reloaded or
migrated by this build. An old installed watcher manifest may reject 0.17.3;
update its source with a settings-preserving migration. The install helper
refuses a different existing source rather than deleting/reinstalling it.

## Verification

All heavy work uses `paseo-resources job`. Core dependencies use the official
release lock with `npm ci --ignore-scripts`; reviewed repository patches run
explicitly afterward. npm 10 does not support dependency-age cooldowns.
Logs and fresh browser recordings remain in ignored `.dev/` and test-results.

### Latest #4524 refresh

- Rebuild the daemon dependency stack, server and CLI; full monorepo typecheck,
  lint and formatting pass.
- Project-link identity/grouping, persisted store and Projects screen: 52 pass.
- Locale catalog/interpolation coverage and actual Arabic/Russian match plurals:
  45 pass. Permit locale-specific plural suffixes in the release's resource type.
- Chromium linking/settings: five pass, including desktop linking and compact
  unlinking without navigation, project-scoped saved links, persistence failure
  recovery and saved links after project removal.
- Chromium sticky Workspaces header/Display regressions: wide and compact pass.
- Compiled isolated daemon smoke passes with all eight pinned plugins, browser
  RPC/JPEG streaming, PTY output, host-instruction capabilities and launch recovery.

Browser checks use `CI=1` to disable Metro watching after the initial dev-mode
attempt hit the shared host's inotify limit. No system limits or other workspace
processes were changed. This refresh does not rerun the broad release tests below.

### Retained release verification

- Daemon dependency stack, server and CLI build pass.
- Full monorepo typecheck, lint and formatting pass.
- Nine focused delivery/receipt/prompt/inbox/outbox/include/worktree-core/launch/
  Codex-recovery files: 240 pass, one platform skip.
- New direct-plus-queued acceptance-identity regression: one passes.
- Agent manager receipt/cancellation/capture/import regressions: 13 targeted cases pass.
- Session receipt-status/error/command regressions: three targeted cases pass.
- Git worktree utility suite: 32 pass.
- App directory-sync/snapshot/outbox/workspace-link models: 70 pass.
- Host-instruction two-daemon protected-relay scenario: one passes, covering
  discovery, approval override, blocked workspace, ordinary-session rejection
  and grant revocation.
- Chromium sidebar: three pass, covering wide/compact sticky header and Display
  in both grouping modes, plus manual ordering after reload.
- All eight companion typechecks, available lint scripts and collection validation
  pass. Watcher compatibility/workspace regressions: 15 pass.
- Compiled isolated daemon: all eight plugins run; host-instruction capability/
  empty-directory checks, browser navigation/JPEG streaming/acknowledgement,
  real PTY output, launch lease recovery and retained output pass.

No full local suite or real model call is claimed. Broad Linux/Windows CI remains
an external gate; prior repeated restored-OMP-history CI failures are not chased
again in this build. No production grants or registrations are created.

## Deploy

Run from independent SSH or a console, never a Paseo-managed terminal:

```bash
bash /home/michaelmwu/dev/paseo-daemon-patches-v0.17.3/scripts/replace-local-patched-daemon.sh
```

This restarts production and stops Paseo agents. The helper checks version
0.17.3, rejects shells inside the service cgroup, backs up its override/CLI link,
and points systemd at this artifact's compiled CLI with Node 22.20.0 and
`daemon run`. It retains `/home/michaelmwu/.paseo`, `127.0.0.1:6767` and a
disabled production web UI.

For fresh plugin installations, or sources already pointing to this bundle:

```bash
bash /home/michaelmwu/dev/paseo-daemon-patches-v0.17.3/scripts/install-local-companion-plugins.sh
```

The plugin helper requires the new daemon and explicitly enabled plugins.
If it refuses an old source, stop and plan a settings-preserving migration.
Neither deployment helper is executed while preparing this build.
