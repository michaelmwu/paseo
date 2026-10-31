#!/usr/bin/env bash
set -euo pipefail

PASEO_BUILD_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PASEO_BUILD_NODE=/home/michaelmwu/.local/share/mise/installs/node/22.20.0/bin/node
PASEO_BUILD_CLI="$PASEO_BUILD_ROOT/packages/cli/dist/index.js"
PASEO_BUILD_HOME=/home/michaelmwu/.paseo
PASEO_BUILD_DROPIN=/etc/systemd/system/paseo.service.d/zz-local-patched-build.conf
PASEO_BUILD_LINK=/home/michaelmwu/.local/bin/paseo

if [[ "$(id -un)" != michaelmwu ]]; then
  echo 'Run this as michaelmwu from an independent SSH login or console.' >&2
  exit 1
fi

PASEO_BUILD_CGROUP="$(systemctl show paseo.service -p ControlGroup --value)"
if [[ -n "$PASEO_BUILD_CGROUP" ]] && grep -Fq ":$PASEO_BUILD_CGROUP" /proc/$$/cgroup; then
  echo 'This shell belongs to paseo.service. Open an independent SSH login first.' >&2
  exit 1
fi

test -x "$PASEO_BUILD_NODE"
test -s "$PASEO_BUILD_CLI"
test -s "$PASEO_BUILD_ROOT/packages/server/dist/scripts/supervisor-entrypoint.js"
test -x "$PASEO_BUILD_ROOT/packages/cli/bin/paseo"
test "$("$PASEO_BUILD_NODE" "$PASEO_BUILD_CLI" --version)" = '0.14.0'
if [[ -d "$PASEO_BUILD_LINK" && ! -L "$PASEO_BUILD_LINK" ]]; then
  echo "$PASEO_BUILD_LINK is a directory; refusing to replace it." >&2
  exit 1
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
  'Environment="PASEO_LISTEN=127.0.0.1:6767"' \
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
    && grep -Eq '^daemonVersion: 0\.14\.0$' <<< "$PASEO_BUILD_STATUS"; then
    printf '%s\n' "$PASEO_BUILD_STATUS"
    exit 0
  fi
  sleep 2
done

sudo systemctl --no-pager --full status paseo.service || true
sudo journalctl -u paseo.service -n 30 --no-pager
echo 'The new daemon did not report version 0.14.0. Inspect the service output above.' >&2
exit 1
