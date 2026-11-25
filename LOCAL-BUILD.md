# Local macOS build

The current base is upstream `v0.17.4` (`2b3559b10`). The local stack
comes from `e5ef73bec`, including #4524 (`bea70ee0b`) and #10674
(`39e1b6959`). Keep the release lockfile, first-Push fix, Claude Auto
mode on hosted providers, and terminal fixture teardown. The checkout
status port keeps the release's structured upstream projection alongside
the local default-branch discovery. The local receipt ledger retains the
original fingerprints for messages dispatched together.

## v0.17.0-beta.1 integration

Workspace link follow-up: apply #10256 (`664eb46fe`) on top of the Settings
search build (`ac97b19d4`). Preserve the existing browser routing lifecycle and
only accept workspace inbox readiness from Paseo app windows.

Settings search follow-up: apply #9875 (`084d2be0c`) to the verified `c6136274e`
build, retaining the earlier patch stack and beta version. Generate the search
index before desktop export, which invokes Expo directly.

Base: upstream `v0.17.0-beta.1` (`6c89950b2`). Replay the tested November 18
integration (`e9682a7e7`) relative to `v0.16.1`, preserving the beta's lockfile,
version, worktree ref actions and existing-worktree flow, host registry, queued
agent delivery, Desktop browser registration, and attention behavior.

| PR     | Reviewed source head | Integration                                                                                      |
| ------ | -------------------- | ------------------------------------------------------------------------------------------------ |
| #4525  | `5ae973538`          | Keep peer service port reservations during launch allocation.                                    |
| #5931  | `78f72f25f`          | Release cross-host attachment QA fixtures on setup failure.                                      |
| #7684  | `460cf2315`          | Share PR workflow locking and preserve approved tracking.                                        |
| #9333  | `5c40d9dc0`          | Serialize forced cancellation with turn snapshot capture; skip internal agents.                  |
| #9334  | `ffcd2c78a`          | Port early-response cleanup onto the beta's browser registration; avoid replaying main or #6534. |
| #9522  | `6f09fd470`          | Keep non-origin defaults and refresh default refs using the beta's picker.                       |
| #9550  | `b135ee8fb`          | Preserve earlier activity and discard unsaved Codex threads on retirement.                       |
| #9713  | `a1a190e78`          | Preserve chat draft and first-agent retries after terminal launch failures.                      |
| #9957  | `6910ab364`          | Reap zombie wrappers and retain reconnecting Codex runtimes.                                     |
| #10083 | `d3e93a330`          | Bind Claude Stop to the owning prompt, steering, and terminal events.                            |
| #10093 | `306dad1ab`          | Fix Linear docs links and the Hub listing.                                                       |
| #10173 | `5471a0a86`          | Navigate back and forward through workspaces, tabs, and plugin screens.                          |

Upstream #9931 owns foreground starts in the beta. Preserve the typed delivery
cause through that start promise. Record original acceptance identities for
batched delivery; publish idle only once snapshot capture and run settlement finish.

User plugins are not embedded in the bundle. The installed PR Watcher declares
`>=0.16.0-beta.1 <0.17.0`, which Paseo's compatibility check does not accept for
this beta. Do not override plugin requirements or update the live daemon.

## Prior 0.16.1 integration

Base: upstream `v0.16.1`, `c09a3d81e`.

Replays the verified integration tree from `85f06d99b529a6d61adf6a01626cd5846dbd51c4`
relative to its upstream base `5a7a60ae50809d4dcbe2126b24501080fa61f3fe`.
The three-way replay preserves the release's changes and applied without conflicts.

Retained streams: #4524, #4525, #4627, #5777, #5931, #7684, #8202,
#9321, #9332, #9333, #9334, #9469, #9520, #9522, #9547, #9548,
#9549, #9550, #9552, #9713 and the ported #3190 selector fix.
Updates existing streams to the PR heads inspected for this build. Range-diff
identifies new feature commits without replaying rebased equivalents or importing
the PRs' later-main ancestry. Current updated pins:

| PR    | Source head                                |
| ----- | ------------------------------------------ |
| #4524 | `ca620522f2efec169f586936c05f37494a02a718` |
| #4525 | `fbba8b0559eecd0d4febef22fac4885fe72877f2` |
| #7684 | `09f3369e873fd87e3e4f4bc24944fb1e93782259` |
| #9321 | `fb2dd1ec67f5d8a75c5ed472e79dfddbda4e50b5` |
| #9522 | `1153f85fc00ea078d55749127bdb549276a0267c` |
| #9547 | `8e65a727f46d9d0c8a19510ed5cbc0c3ef20d785` |
| #9548 | `a016dcc00df8074b46cc495b14920a32d5f7d89d` |
| #9549 | `aaa14c1c58ce0ea0b52fe476bbe8c6623289ca24` |
| #9550 | `719837198fcec74655f226e125c1d7c8913b28d6` |
| #9552 | `e553a4499e828b87e9f63010e5dfb85c3c112878` |
| #9713 | `9e702be0bcff7acc83b8b1a81564e5edafb3b508` |

## November 18 refresh

The November 16 build (`bcc4ab1c7`) remains the integration baseline. The table
above describes that baseline; the pins below supersede its corresponding rows.

| PR     | Reviewed source head | Integration                                                                                |
| ------ | -------------------- | ------------------------------------------------------------------------------------------ |
| #4525  | `46230492d`          | Confirm cleanup before rollback, keep stopped output, validate launch config.              |
| #9321  | `81286e5a4`          | Range-diff equivalent; retain the release host-registry port.                              |
| #9332  | `8562246f1`          | Bring forward the outbox delta and receipt checks; apply its shared prerequisite PRs once. |
| #9520  | `09d02805c`          | Respect composer tracks and the read-only state in plugin sections.                        |
| #9522  | `f7aae5d32`          | Support default branches outside `origin`.                                                 |
| #9547  | `e632fefd0`          | Handle old-host same-ID retry and distinguish replay from acceptance.                      |
| #9548  | `ccab6ce52`          | Typed outcomes, native admissions and durable receipt verification.                        |
| #9550  | `4187a7826`          | Bounded Codex admission and retained recovery ownership; keep Stop available.              |
| #9552  | `aa2a97c2d`          | Handle plugin-hidden targets and compact Send.                                             |
| #9713  | `eb79b7588`          | Preserve retry ownership across workspace creation paths.                                  |
| #9820  | `11f261973`          | Readable Codex exit errors.                                                                |
| #9946  | `b3956767d`          | Extend message admission waits without reverting release metadata.                         |
| #9957  | `163074985`          | Opt-in resource wrapper for Linux workloads.                                               |
| #10083 | `8314048df`          | Keep Claude and ACP active until Stop settles.                                             |
| #10084 | `d825366bc`          | Plugin transfer for explicitly selected files and Local Files example.                     |

Port upstream #9931 (`eabbd3d97`) for per-sender foreground startup ownership.
Use that sender promise for receipts and retries. Keep turn-change snapshots and
the release's queued-delivery contract. The outbox only resends a definite
failure; it checks uncertain delivery without submitting a second prompt.

#9321 is a feature-equivalent rebase adapted to newer host-registry APIs; the
release's host-registry API is retained. #9549 adds no new interrupt-budget logic.
For #9548/#9550, port the deliberate merge-time OpenCode acknowledgement and
Codex permission/UI fixes, not unrelated queued-delivery or canceled-start
refactors from newer main. Preserve the already-tested release-line sender/start
ownership and cancellation logic. The retry/fork hook dependency conflict keeps
both checkout context and durable draft identity dependencies.

The retained-worker regression fixture now creates its terminal before adopting
the worker into a draining pool. Empty draining workers are intentionally retired
at construction; production pool behavior is unchanged.
The new retired-worker launch fixture supplies the release-required service
proxy, and the plain-script reuse fixture includes its immutable script metadata.
The creation placement-rejection journey asserts one workspace after the final
successful retry rather than requiring navigation during the intended rejection.

Preserves the prior supersession decisions: upstream partial-code copying,
worktree-include plugin and general idle-runtime collector; no duplicate #6534,
no second-Stop #5339 policy and no superseded #9518.

Retains outbox image/failed-message ownership, launch retained-terminal output,
startup-cancellation snapshot cleanup, unsigned library-validation entitlements,
non-incremental desktop compilation, dependency patches and packaged renderer
error-boundary detection. The release's own version and lockfile remain intact.

Build locally with locked dependencies and reviewed postinstall patches. Run
focused integration tests, workspace typecheck, changed-file lint and formatting.
Package arm64 into `packages/desktop/release/local-macos` with ad-hoc signing,
notarization disabled and publishing disabled. Smoke the packaged renderer,
preload, built-in plugins, CLI and terminal against an isolated temporary daemon.
After verification, put the latest `Paseo.app`, ZIP, DMG, `SHA256SUMS`, and
`BUILD-PROVENANCE.txt` in `~/Downloads/Paseo Builds`. Reuse that folder for
each build. Do not replace an installed application or restart port 6767.

Installed user plugins are daemon-managed state, separate from this artifact.
No plugin update, push, PR, upstream release or production restart is part of this build.
