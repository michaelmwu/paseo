#!/usr/bin/env bash
set -euo pipefail

PASEO_BUILD_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PASEO_BUILD_NODE=/home/michaelmwu/.local/share/mise/installs/node/22.20.0/bin/node
PASEO_BUILD_CLI="$PASEO_BUILD_ROOT/packages/cli/dist/index.js"
PASEO_BUILD_HOME=/home/michaelmwu/.paseo
PASEO_BUILD_DROPIN=/etc/systemd/system/paseo.service.d/zz-local-patched-build.conf
PASEO_BUILD_LINK=/home/michaelmwu/.local/bin/paseo
PASEO_BUILD_CONFIG_LISTEN=false
PASEO_BUILD_CHECK_ONLY=false

for PASEO_BUILD_ARG in "$@"; do
  case "$PASEO_BUILD_ARG" in
    --config-listen) PASEO_BUILD_CONFIG_LISTEN=true ;;
    --check) PASEO_BUILD_CHECK_ONLY=true ;;
    -h|--help)
      echo 'Usage: replace-local-patched-daemon.sh [--config-listen] [--check]'
      echo 'By default the deployment pins the listener to 127.0.0.1:6767.'
      echo '--config-listen lets Paseo manage listeners; the saved address must be loopback-only.'
      echo '--check verifies the artifacts and selected mode without changing the service.'
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n' "$PASEO_BUILD_ARG" >&2
      exit 2
      ;;
  esac
done

if [[ "$(id -un)" != michaelmwu ]]; then
  echo 'Run this as michaelmwu from an independent SSH login or console.' >&2
  exit 1
fi

PASEO_BUILD_CGROUP="$(systemctl show paseo.service -p ControlGroup --value)"
if [[ "$PASEO_BUILD_CHECK_ONLY" = false && -n "$PASEO_BUILD_CGROUP" ]] &&
  grep -Fq ":$PASEO_BUILD_CGROUP" /proc/$$/cgroup; then
  echo 'This shell belongs to paseo.service. Open an independent SSH login first.' >&2
  exit 1
fi

test -x "$PASEO_BUILD_NODE"
test -s "$PASEO_BUILD_CLI"
test -s "$PASEO_BUILD_ROOT/packages/server/dist/scripts/supervisor-entrypoint.js"
test -x "$PASEO_BUILD_ROOT/packages/cli/bin/paseo"
test "$("$PASEO_BUILD_NODE" "$PASEO_BUILD_CLI" --version)" = '0.18.0'
if [[ -d "$PASEO_BUILD_LINK" && ! -L "$PASEO_BUILD_LINK" ]]; then
  echo "$PASEO_BUILD_LINK is a directory; refusing to replace it." >&2
  exit 1
fi

PASEO_BUILD_LISTEN_DIRECTIVE='Environment="PASEO_LISTEN=127.0.0.1:6767"'
PASEO_BUILD_LISTEN_MODE='deployment-pinned loopback'
if [[ "$PASEO_BUILD_CONFIG_LISTEN" = true ]]; then
  if ! "$PASEO_BUILD_NODE" "$PASEO_BUILD_CLI" daemon config get daemon.listen --json --home "$PASEO_BUILD_HOME" |
    "$PASEO_BUILD_NODE" -e '
      const { value } = JSON.parse(require("node:fs").readFileSync(0, "utf8"));
      process.exitCode = value === "127.0.0.1:6767" ? 0 : 1;
    '; then
    echo 'Refusing config-managed mode: saved daemon.listen must be exactly 127.0.0.1:6767.' >&2
    exit 1
  fi
  # Remove inherited overrides too, including definitions from earlier drop-ins.
  PASEO_BUILD_LISTEN_DIRECTIVE='UnsetEnvironment=PASEO_LISTEN'
  PASEO_BUILD_LISTEN_MODE='config-managed loopback'
fi
if [[ "$PASEO_BUILD_CHECK_ONLY" = true ]]; then
  printf 'Paseo 0.18.0 preflight passed (%s). No service changes made.\n' "$PASEO_BUILD_LISTEN_MODE"
  exit 0
fi

sudo -v
PASEO_BUILD_STAMP="$(date +%Y%m%d-%H%M%S)-$$"
if sudo test -f "$PASEO_BUILD_DROPIN"; then
  sudo cp -a -- "$PASEO_BUILD_DROPIN" "$PASEO_BUILD_DROPIN.$PASEO_BUILD_STAMP.bak"
fi
if [[ -e "$PASEO_BUILD_LINK" || -L "$PASEO_BUILD_LINK" ]]; then
  cp -a -- "$PASEO_BUILD_LINK" "$PASEO_BUILD_LINK.$PASEO_BUILD_STAMP.bak"
fi

PASEO_BUILD_TEMP="$(mktemp)"
trap 'rm -f -- "$PASEO_BUILD_TEMP"' EXIT
printf '%s\n' \
  '[Service]' \
  'Environment="HOME=/home/michaelmwu"' \
  "Environment=\"PASEO_HOME=$PASEO_BUILD_HOME\"" \
  "$PASEO_BUILD_LISTEN_DIRECTIVE" \
  'Environment="PASEO_WEB_UI_ENABLED=false"' \
  'ExecStart=' \
  "ExecStart=$PASEO_BUILD_NODE $PASEO_BUILD_CLI daemon run --home $PASEO_BUILD_HOME" \
  'ExecStop=' \
  "ExecStop=$PASEO_BUILD_NODE $PASEO_BUILD_CLI daemon stop --home $PASEO_BUILD_HOME --timeout 20" \
  > "$PASEO_BUILD_TEMP"

sudo install -d -m 0755 /etc/systemd/system/paseo.service.d
sudo install -m 0644 -- "$PASEO_BUILD_TEMP" "$PASEO_BUILD_DROPIN"
mkdir -p /home/michaelmwu/.local/bin
ln -sfn -- "$PASEO_BUILD_ROOT/packages/cli/bin/paseo" "$PASEO_BUILD_LINK"
sudo systemctl daemon-reload
sudo systemctl restart paseo.service

for PASEO_BUILD_ATTEMPT in {1..30}; do
  if PASEO_BUILD_STATUS="$("$PASEO_BUILD_NODE" "$PASEO_BUILD_CLI" daemon status --home "$PASEO_BUILD_HOME")" \
    && grep -Fxq 'daemonVersion: 0.18.0' <<< "$PASEO_BUILD_STATUS"; then
    printf '%s\n' "$PASEO_BUILD_STATUS"
    exit 0
  fi
  sleep 2
done

sudo systemctl --no-pager --full status paseo.service || true
sudo journalctl -u paseo.service -n 30 --no-pager
echo 'The new daemon did not report version 0.18.0. Inspect the service output above.' >&2
exit 1
