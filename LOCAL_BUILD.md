# Local patched Linux daemon

Deployment bundle based on official `v0.17.4`
(`2b3559b107243306986176b80beb0e779f9fe53e`), retaining the verified
`b48bf99ea80e23cc61bb62c2d0cf341408e6d7fe` bundle. Build in
`/home/michaelmwu/dev/paseo-daemon-patches-v0.17.4`; preserve the shared
checkout, previous artifacts, production service and live plugin settings.
This is a fork deployment record, not an aggregate upstream proposal.

## Inputs and subsumption

[local-build-inputs.json](local-build-inputs.json) owns full input revisions.
[Release audit](local-build-release-audit.json) records November 25 GitHub states.

| Feature                                              | Revision    |
| ---------------------------------------------------- | ----------- |
| Project linking #4524 (historical #4052)             | `19395860f` |
| Transcript attachments #4627                         | `07e750d7c` |
| Cross-host/native continuation #2496, linked branch  | `b370aadf2` |
| Project local-file import #4381, linked branch       | `c5c050148` |
| Worktreeinclude conflict repairs, not #2419          | `b8be2560e` |
| Workspace launches #4525                             | `5ae973538` |
| Offline outbox #9332                                 | `8562246f1` |
| Receipt reconciliation #9548                         | `ccab6ce52` |
| Codex interruption recovery #9550                    | `b135ee8fb` |
| Per-turn changes #9333                               | `5c40d9dc0` |
| Browser tunnel/named forwarding #9334                | `ffcd2c78a` |
| Desktop element picker #3190                         | `595852d3c` |
| Back/Forward tab and plugin-screen history #10173    | `5471a0a86` |
| Desktop workspace links #10256                       | `664eb46fe` |
| Host instruction defaults/workspace overrides #10320 | `c84679f11` |
| Sticky Workspaces header/Display menu #10325         | `0c80a810a` |
| Native PR-watch composer/setup entry points #10736   | `9dc9ae0da` |

No selected feature PR is newly merged into v0.17.4, so none is removed.
This release-only rebuild retains the verified feature revisions above, including
historical linked branches. Several live PR heads are newer; the audit records
them without silently refreshing this feature stack. #10325 is closed but unmerged.

The subsequent #10736 addition starts from verified build `1f989bf43` and applies
only its two feature commits after `cf1a5a9e7`. Other feature and companion pins
stay unchanged. Reference source QA images instead of copying historical media.

#7782, #9580, #9757 and #9931 are already in the release; their merge commits
are verified ancestors of v0.17.4. #6534 and #9549/#5633 remain included once
through their selected parents. Superseded #5259 and #2419 stay excluded.
The older [recent-PR audit](local-build-pr-audit.json) is a November 20 snapshot.

## Release integration

Use the exact release package manifests, lockfile and Nix hash, including its
vendored Markdown workspace. Keep release Git discovery safeguards for
bare-repository-shaped directories. The create-worktree wrapper retains those
safeguards alongside our include source, conflict recovery and branch cleanup.

Preserve release terminal-fixture teardown and the retained-terminal regressions.
Drop the obsolete test that forbade Claude Auto mode on Vertex: the release now
allows hosted transports. Accepted-turn Codex interruption fixtures must await
native start acknowledgement; merely observing the outbound request is still
pending startup, where Stop intentionally retires the old runtime.

Keep original receipt identities when a direct prompt carries queued messages,
release queue/Stop ownership, native continuation, per-turn capture, launch leases,
provider installation/metrics, plugin worktree-manager hooks and checkout trust.
Plugin-managed worktree restores retain the plugin's ownership.

#4524 keeps its sidebar/settings entry points and current Git identity checks.
Its sheet survives sidebar regrouping. Preserve release project-settings Back
ownership, localized plural categories and #10325 sticky-header content slots.

#10736 adds composer, Git menu, Command Center and PR-tab entry points to the
native watch service. The daemon still owns polling, subscriptions, delivery and
Background work Stop. Preserve receipt-status support alongside the new session
watch service. Capability negotiation gates the new request/response; its optional
feature and Background work URL fields do not change existing wire requirements.

## Client features and limits

Project linking, sticky headers, Back/Forward history, desktop workspace links
and policy setup require a matching patched client. Replacing only the daemon
does not change an official client's UI. No packaged Electron/mobile artifact,
OS URL activation or physical-device QA is claimed.

Native PR-watch UI also needs this patched client. It does not depend on the
companion PR watcher plugin, migrate that plugin or start watches automatically.

#10320 retains sender-wide Ask each time/Allow unattended defaults and workspace
inherit/ask/unattended/blocked policies for existing conversations. Both hosts
need that revision. New-agent creation through restricted grants is outside the
prototype. #10256 remains a prototype with upstream review feedback about Add
Host lifetime, newer agent intents and embedded-browser forwarding.

## Companion plugins

All eight sources use `508-dev/paseo-plugins` at
`b36f18a358de9a1e0ef0c099e399d8b5a426a6c4`.
Feature code stays pinned. Relative to the previous bundle, only PR watcher
manifest/catalog compatibility and its regression change: admit exactly stable
0.17.4 as well as previously verified versions; keep 0.17.5 and later gated.
[Compatibility PR](https://github.com/508-dev/paseo-plugins/pull/23) is stacked on
[#14](https://github.com/508-dev/paseo-plugins/pull/14).

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

Each plugin has independently installed, locked dependencies. Plugins are trusted,
unsandboxed code. No live source is installed, reloaded or migrated by this build.
An older watcher manifest may reject 0.17.4. The install helper refuses a different
existing source; use a settings-preserving migration rather than remove/reinstall.

## Verification

All heavy commands use `paseo-resources job`. Core dependencies use the official
release lock and `npm ci --ignore-scripts`; reviewed repository patches run through
`npm run postinstall` afterward. npm 10 lacks dependency-age cooldown support.
Fresh validation logs remain in ignored `.dev/`.

### #10736 addition

- Rebuilt daemon dependency stack, server and CLI; full monorepo typecheck, lint
  and formatting pass.
- Native watch and Background work: 22 pass; authorization inventory: nine pass.
- Session watch permission/eligibility and receipt-status regression: two pass.
- Client capability gate and no-send behavior for older hosts: two pass.
- App Git policy/locales: 111 pass; Command Center contributions/shortcuts: 19 pass.
- Chromium PR pane/composer: 16 pass, covering desktop/compact watch setup, pane
  agent routing, focused/sole/explicit recipients, retries, closure, Background
  work updates and older-host guidance.
- Compiled isolated daemon advertises the new capability and rejects a missing
  watch recipient through the real RPC. All eight pinned plugins, browser/JPEG
  streaming, PTY output, launch recovery and retained output still pass.

These 165 focused tests and 16 browser cases are fresh results. No production
watch, GitHub mutation, real-provider turn or credentialed disposable-repository
test is run. Source QA media remain referenced in #10736, not copied here.

### Release base validation (`1f989bf43`)

- Daemon dependency stack, server and CLI build pass; compiled CLI reports 0.17.4.
- Full monorepo typecheck, lint and formatting pass.
- Nine receipt/turn-change/instruction/include/worktree/launch/Git-discovery files:
  194 pass, one platform skip.
- Codex provider and interrupted-turn terminal cleanup: 257 pass. Correct three
  stale interruption fixtures to distinguish native acknowledgement from pending
  startup, without changing runtime cancellation behavior.
- Manager continuation, receipts, imports and turn-capture regressions: 14 pass.
  Receipt-restart fixtures use the current real message-delivery service.
- Retained-terminal exit/adoption and upstream fixture-teardown cases: four pass.
- Project-link/store/grouping/screen, locale and outbox files: 116 pass.
- Directory synchronization: seven pass through the app's unit project/setup.
- Chromium: eight pass, covering linking/unlinking, scoped links, persistence
  failure recovery, removed projects, wide/compact sticky headers and manual order
  across sorting/reload.
- All eight companion typechecks, available lint scripts and collection validation
  pass. Watcher compatibility/workspace regression file: 16 pass.
- Compiled isolated daemon: all eight plugins run; browser RPC/JPEG streaming,
  real PTY output, host-instruction capabilities, launch lease recovery and retained
  terminal output pass. The smoke uses a temporary home and random loopback port.

Release-generated whitespace warnings are confined to seven files whose contents
match the official tag byte-for-byte; do not normalize vendored release sources.
Browser checks use watch-free `CI=1` after the previous build established the shared
host's inotify limit. No system limits or other workspaces are changed.
No full local suite or real model call is claimed. Broad CI remains an external
gate; prior repeated restored-OMP-history failures are not chased in this rebuild.

## Deploy

From independent SSH or a console, never a Paseo-managed terminal:

```bash
bash /home/michaelmwu/dev/paseo-daemon-patches-v0.17.4/scripts/replace-local-patched-daemon.sh
```

This restarts production and stops Paseo agents. The helper checks version
0.17.4, rejects shells inside the service cgroup, backs up its override/CLI link,
and points systemd at this artifact's compiled CLI with Node 22.20.0 and
`daemon run`. Keep `/home/michaelmwu/.paseo`, `127.0.0.1:6767` and the
disabled production web UI. Neither deployment helper is run during the build.

For new plugin installations, or sources already pointing to this bundle:

```bash
bash /home/michaelmwu/dev/paseo-daemon-patches-v0.17.4/scripts/install-local-companion-plugins.sh
```

The helper requires the new daemon and explicitly enabled plugins. If it refuses
an older source, stop and plan a settings-preserving migration.
