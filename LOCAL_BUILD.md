# Local patched Linux daemon

Deployment bundle based on official `v0.17.6`
(`afb8634dc3157e443e608382a7ef10ddf13db2a9`), retaining the v0.17.4
patch bundle at `2d64edcb5`. Build in
`/home/michaelmwu/dev/paseo-daemon-patches-v0.17.6`; preserve the shared
checkout, previous artifacts, production service and live plugin settings.
This is a fork deployment record, not an aggregate upstream proposal.

## Inputs and subsumption

[local-build-inputs.json](local-build-inputs.json) owns full input revisions.
[Earlier release audit](local-build-release-audit.json) records November 25 GitHub states.

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
| Shared workspace header management #10446            | `9d915bec3` |
| Plan feedback actions, fork michaelmwu/paseo#16      | `5b5ed81e5` |

This rebuild carries forward the recorded feature revisions, including historical
linked branches. It refreshes fork #16 and uses release #10740 instead of
the #10845 passive-watch implementation. #10325 remains closed but unmerged.

The subsequent #10736 addition starts from verified build `1f989bf43` and applies
only its two feature commits after `cf1a5a9e7`. Other feature and companion pins
stay unchanged. Reference source QA images instead of copying historical media.

#10446 then adds shared header management from `e7579bd62`, using only its two
feature commits after `311728a78`. Its archive prerequisite #10507 is already
an ancestor of v0.17.4 at `884adbcc2`; do not apply it again. Other feature and
companion revisions stay pinned.

Fork [michaelmwu/paseo#16](https://github.com/michaelmwu/paseo/pull/16) adds plan
feedback without importing its historical patch-branch base. The first four
feature commits are already in `2d64edcb5`; refresh with only `5b5ed81e5`,
the single-button UI also proposed in [upstream #10971](https://github.com/getpaseo/paseo/pull/10971).
Do not apply both PRs. Retain collapsible plan outcomes, turn capture, cancellation,
message receipts and current Codex provider options.

#7782, #9580, #9757 and #9931 are already in the release; their merge commits
are verified ancestors of v0.17.6. #6534 and #9549/#5633 remain included once
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

Keep v0.17.6's checkout trust marker and plugin launch lifecycle for forked
sessions. The import listing keys include both the host and the source/target
scope. Keep the release settings layout and queued desktop settings writes
alongside host instructions and browser routing.

#4524 keeps its sidebar/settings entry points and current Git identity checks.
Its sheet survives sidebar regrouping. Preserve release project-settings Back
ownership, localized plural categories and #10325 sticky-header content slots.

#10736 adds composer, Git menu, Command Center and PR-tab entry points to the
native watch service. The daemon still owns polling, subscriptions, delivery and
Background work Stop. Preserve receipt-status support alongside the new session
watch service. Capability negotiation gates the new request/response; its optional
feature and Background work URL fields do not change existing wire requirements.

#10446 shares Labels, read/unread, Archive and Electron-only Open in file manager
actions between the wide and compact workspace headers. Reuse the existing label
picker, read-state rules and archive owner, including warnings, Undo and active
workspace handling. Keep existing terminal/setup/script placement and #10736's
workspace-aware Git actions; do not add Rename or Pin behavior from other PRs.

Upstream #10740 owns passive watch registration in v0.17.6. Keep #10736's
change-request URL on Background work rows and the regression tests from #10845.

## Client features and limits

Project linking, sticky headers, Back/Forward history, desktop workspace links
and policy setup require a matching patched client. Replacing only the daemon
does not change an official client's UI. No packaged Electron/mobile artifact,
OS URL activation or physical-device QA is claimed.

Native PR-watch UI also needs this patched client. It does not depend on the
companion PR watcher plugin, migrate that plugin or start watches automatically.
Shared workspace header management likewise needs a matching patched client;
rebuilding or replacing only the daemon cannot add these menu rows to an official app.

Plan feedback needs the matching patched client. A host advertises `planReview`
before the client shows Add feedback. The editor gives Request changes and
Implement with notes equal weight. Older hosts retain ordinary permission actions.
The local browser export is in `packages/app/dist`; it is not deployed.

#10320 retains sender-wide Ask each time/Allow unattended defaults and workspace
inherit/ask/unattended/blocked policies for existing conversations. Both hosts
need that revision. New-agent creation through restricted grants is outside the
prototype. #10256 remains a prototype with upstream review feedback about Add
Host lifetime, newer agent intents and embedded-browser forwarding.

## Companion plugins

All eight sources use `508-dev/paseo-plugins` at
`d18039b9e1cc9ff80524942306be28fe3a464bdb`.
Feature code stays pinned. This rebuild only extends the PR-watcher
manifest/catalog compatibility to 0.17.6. It does not admit 0.17.5 or later
unverified stable version numbers. See [companion PR #30](https://github.com/508-dev/paseo-plugins/pull/30).
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
An older watcher manifest may reject 0.17.6. The install helper refuses a different
existing source; use a settings-preserving migration rather than remove/reinstall.

## Verification

All heavy commands use `paseo-resources job`. Core dependencies use the official
release lock and `npm ci --ignore-scripts`; reviewed repository patches run through
`npm run postinstall` afterward. npm 10 lacks dependency-age cooldown support.
Fresh validation logs remain in ignored `.dev/`.

### v0.17.6 and fork #16 single-button refresh

- Locked release dependencies and reviewed postinstall patches are installed in
  this worktree. The daemon stack and CLI build successfully and report 0.17.6.
- Focused tests pass: 177 server cases across worktree/launch/trust/watch paths,
  10 manager cases including plan feedback and continuation, 129 app cases
  across import and locales, four Chromium editor cases, and 17 watcher cases.
- Full typecheck and lint pass, along with 31 desktop cases and four Chromium
  browser-routing badge cases. The final worktree-core rerun passes 43 cases.
- The isolated compiled daemon loads all eight plugins, the PR watcher answers
  its list RPC, and plan-review capability, browser streaming, PTY output,
  launch recovery and retained output checks pass.
- The browser export succeeds with one Metro worker and a bounded Node heap.
  Run `CI=1 NODE_OPTIONS=--max-old-space-size=5376 npm exec --workspace=@getpaseo/app -- expo export --platform web --max-workers 1`
  after building app dependencies if the default export exhausts a worker's heap.

The previous v0.17.4 empty-conversation browser gate below was not rerun.
No new real-provider, native-device or packaged Electron QA is claimed.

### Fork #16 initial plan-feedback build (v0.17.4)

- Extract only `22ff84351` through `4798c079c` from the fork PR. Preserve current
  plan disclosure/outcome rendering, foreground admission, cancellation, turn
  capture and receipt handling. Use current Codex provider options for Plan mode.
- Full dependency stack/server/CLI rebuild, full monorepo typecheck and lint pass.
  CLI reports 0.17.4. Protocol validation is regenerated through the normal build.
- Focused checks pass: 9 manager cases (including turn-capture cancellation),
  3 session RPC/permission cases, 7 wire-schema cases, 5 client cases,
  34 outbound-validation cases, 10 authorization cases and 45 locale cases.
- Four real-Chromium component tests cover the shared draft, compact/wide controls,
  failure/retry, cancellation/reopen, pending submission and stale proposals.
- Compiled isolated-daemon smoke passes with `planReview`, a correlated unknown-agent
  rejection and all eight pinned plugins running. Browser/JPEG streaming, real PTY,
  launch recovery and retained output pass. No production restart or plugin migration.

Remaining browser gate: `codex-plan-approval.spec.ts` cannot find the initial
"Start chatting with this agent..." prompt before exercising the plan card. It
fails on the original cold route and after two test-setup adjustments (directory
hydration and sidebar navigation); neither adjustment is retained. The daemon
inventory and sidebar preconditions passed in the adjusted runs. Post-cleanup
"Workspace unavailable" screenshots do not establish the original failure's cause.
Stop retrying this check for now; keep the regression test and report it as red.
Logs: `.dev/fork-pr16-e2e.log`, `-e2e-final.log`, `-e2e-ui.log`; other fresh
validation uses `.dev/fork-pr16-*.log`. No new real-provider, native-device,
packaged Electron or installed-client QA is claimed.

### #10845 review build

- Before applying the fix, the updated watch regression reproduces the unwanted
  running count in this bundle. After applying it, all 35 tests across native
  watches, state buckets and Background work pass.
- Cases cover passive registration/restoration across PRs and MRs, shared
  observations, queued updates, per-agent Stop and active-turn Running precedence.
- Daemon dependency stack/server/CLI rebuild, full monorepo typecheck, lint and
  formatting pass. The compiled native watch registration contains the passive flag.
- Compiled isolated daemon smoke passes with all eight pinned plugins, native-watch
  capability/RPC rejection, browser/JPEG streaming, real PTY output, launch recovery
  and retained output. The production daemon and installed plugins are unchanged.

This daemon-only addition leaves client and plugin code pinned. No fresh browser,
installed-client or live-forge-account QA is claimed; the focused before/after logs
and smoke output remain in ignored `.dev/pr10845-*.log`.

### #10446 addition

- Daemon dependency stack, server and CLI rebuild pass; full monorepo typecheck
  and lint pass.
- Locale, labels, workspace/project archive and archive-navigation unit files:
  73 pass across five files.
- Chromium header scenarios: eight pass. Both layouts support read-state toggles,
  label assignment/removal and plain-directory Archive/Undo. Compact risk-warning
  cases preserve a workspace opened after the archive confirmation began.
- Chromium desktop-runtime fixture: one passes, checking the file-manager bridge
  receives the exact workspace path. This is not a packaged Electron or OS launch.
  The unrelated browser-routing prototype logs a mock-contract warning in this fixture.
- Compiled isolated daemon smoke passes with all eight pinned plugins, native-watch
  capability/RPC rejection, browser/JPEG streaming, PTY output, launch recovery and
  retained output. Production is not restarted and live plugins are not migrated.

Source QA media stay referenced in #10446 rather than copied. Native iOS/Android
and packaged desktop behavior remain unverified. Earlier results below belong to
their recorded build revisions; no broad suite is rerun for this addition.

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
bash /home/michaelmwu/dev/paseo-daemon-patches-v0.17.6/scripts/replace-local-patched-daemon.sh
```

This restarts production and stops Paseo agents. The helper checks version
0.17.6, rejects shells inside the service cgroup, backs up its override/CLI link,
and points systemd at this artifact's compiled CLI with Node 22.20.0 and
`daemon run`. Keep `/home/michaelmwu/.paseo`, `127.0.0.1:6767` and the
disabled production web UI. Neither deployment helper is run during the build.

Add `--check` to run only the preflight. By default the service pins
`PASEO_LISTEN`, so the Tailscale listener toggle in Settings is locked.
To let Paseo manage listeners, run the replacement helper with
`--config-listen`. It requires the saved `daemon.listen` to be exactly
`127.0.0.1:6767` before removing the launch override. The daemon still starts
on loopback; adding a Tailscale listener is a separate explicit action.

For new plugin installations, or sources already pointing to this bundle:

```bash
bash /home/michaelmwu/dev/paseo-daemon-patches-v0.17.6/scripts/install-local-companion-plugins.sh
```

The helper requires the new daemon and explicitly enabled plugins. If it refuses
an older source, stop and plan a settings-preserving migration.
