# Linux daemon patch bundle

Base: official [v0.18.0](https://github.com/getpaseo/paseo/releases/tag/v0.18.0),
`5369967b4ddbfb1f5c04a7a36b1b223fb32c4a1c`. It contains the requested
`15390b71688c4d93130c8754fe3dc99c969921e1` snapshot. This branch is a fork build,
not a combined upstream proposal.

## Patch sources

| Source                                                                                        | Revision                                   |
| --------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [#9332](https://github.com/getpaseo/paseo/pull/9332)                                          | `8562246f1b77d591ccae719a40a3661b69215811` |
| [#9550](https://github.com/getpaseo/paseo/pull/9550)                                          | `5918264a1c7b2ae217666b02e8abf105679a65db` |
| [#9946](https://github.com/getpaseo/paseo/pull/9946)                                          | `b3956767daf24531a491791333c6ab3b6b8e890d` |
| [#9713](https://github.com/getpaseo/paseo/pull/9713)                                          | `0f2316386f243eea3f7538deb5d46ed9669acb11` |
| [#10083](https://github.com/getpaseo/paseo/pull/10083)                                        | `d3e93a330b3081025f96778d30f5b5134282e95b` |
| [#9820](https://github.com/getpaseo/paseo/pull/9820)                                          | `11f261973abf22498e0c07096395bef31595cfda` |
| [#5777](https://github.com/getpaseo/paseo/pull/5777)                                          | `39c792728ca4d1376d284966aa2f79ab75328d6d` |
| [#10971](https://github.com/getpaseo/paseo/pull/10971)                                        | `945cc9f21191c7fa8cc4c1546bab1b9f7917bb9b` |
| [#10615](https://github.com/getpaseo/paseo/pull/10615)                                        | `7c1ee1ffa37fb61ab2bdac104ae0bcd29ac1111e` |
| [#10736](https://github.com/getpaseo/paseo/pull/10736)                                        | `50fffa8673a9e95f2e8cf23e5aa04eab1f3309d1` |
| [#7684](https://github.com/getpaseo/paseo/pull/7684)                                          | `740eedb1d212888a83d6f53ad9a9fe6ec59ac7dd` |
| [#4525](https://github.com/getpaseo/paseo/pull/4525)                                          | `f22d61b3cfe4a553d722f2515c51c44522dbd450` |
| [Fork #14 (Desktop forwarding)](https://github.com/michaelmwu/paseo/pull/14)                  | `cc74012ae756f275a4320693419fda44f0ffc250` |
| [#9334](https://github.com/getpaseo/paseo/pull/9334) (named CLI forwarding port only)         | `ffcd2c78aeb75a0536890ea120f9fbb95b16d65c` |
| [#9321](https://github.com/getpaseo/paseo/pull/9321)                                          | `fc1265118546e9c6353d00ea7675335d1d61eb6e` |
| [#10320](https://github.com/getpaseo/paseo/pull/10320)                                        | `3e037194b9596ce3669935eab6309af6e0e5aef7` |
| [#4524](https://github.com/getpaseo/paseo/pull/4524)                                          | `4e2c4d7bb4c15a26573b1d05648414da7d7f7203` |
| [#10256](https://github.com/getpaseo/paseo/pull/10256)                                        | `f0fc7bf76647e938b252f6e5544375ab37466827` |
| [#10173](https://github.com/getpaseo/paseo/pull/10173)                                        | `5471a0a86c9a367de404cd6852ec5930955056ce` |
| [#10674](https://github.com/getpaseo/paseo/pull/10674)                                        | `0085ae2d85684255a42663bf391f0735fe6ec535` |
| [#10446](https://github.com/getpaseo/paseo/pull/10446)                                        | `9d915bec3afdc2151492a44afe1ce4da0978e300` |
| [#8202](https://github.com/getpaseo/paseo/pull/8202)                                          | `17ca4f893b901c824c629f48320c053fa306435a` |
| [#9522](https://github.com/getpaseo/paseo/pull/9522)                                          | `e4a3c0075790a9e608526ab0ba390a7e1e12c9d0` |
| [#10346](https://github.com/getpaseo/paseo/pull/10346)                                        | `9fc7c3a58390c94eb6d40dc43c61920f2f52cdf5` |
| [Sticky Workspaces header](https://github.com/michaelmwu/paseo/tree/sticky-workspaces-header) | `8e9daba8ecc857361764eaa791a3df9755a6dca1` |

- Use the release's network tunnel (#10944), Tailscale setup and Refresh
  (#10801 and #10903), passive PR watches (#10740), Codex startup cancellation
  (#9931), compact-header Archive (#10507), and Linear Hub guides (#10375).
- #9332 carries the focused #9547, #9548, and #9552 delivery work. #9550 carries
  #9549. #10971 is the source of plan feedback; do not apply fork #16 too.
  #10615 replaces #9333. Named CLI forwarding uses the release's ticket
  protocol and stream multiplexer; it does not reintroduce the old tunnel.
- Retain the local outbox safeguards from the v0.17.6 bundle: protect peer-window
  attachments from garbage collection and hold a failed send's successors
  until it is retried successfully or discarded.
- Settings search (#9875) needs a separate port for Device and Host settings.
  Optional third-party, SDK, and historical patches outside the current
  consolidated stack are not included. External plugins live outside this
  branch; the build does not install or reload them.

## Build and replace

Build with the committed release lockfile and the repository's Node version.
On the Linux build host, run dependency installation and `npm run build:server`
through `paseo-resources job`. Run the replacement script from an independent
SSH login or console, since restarting the system unit can stop sessions it owns.

```sh
bash scripts/replace-local-patched-daemon.sh --check
bash scripts/replace-local-patched-daemon.sh
```

The script keeps the live Paseo home, checks the artifact version, and saves
the existing CLI link and systemd drop-in with timestamped `.bak` suffixes.
Use `--config-listen` for config-managed listeners (needed for Tailscale's
secondary listener); the primary saved address must be exactly
`127.0.0.1:6767`. Without it the deployment pins the loopback address.
