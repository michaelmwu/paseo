#!/usr/bin/env bash
set -euo pipefail

PASEO_COMPANION_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PASEO_COMPANION_NODE=/home/michaelmwu/.local/share/mise/installs/node/22.20.0/bin/node
PASEO_COMPANION_CLI="$PASEO_COMPANION_ROOT/packages/cli/dist/index.js"
export PASEO_HOME=/home/michaelmwu/.paseo

test "$(id -un)" = michaelmwu
test "$("$PASEO_COMPANION_NODE" "$PASEO_COMPANION_CLI" --version)" = '0.16.0-beta.1'
PASEO_COMPANION_STATUS="$("$PASEO_COMPANION_NODE" "$PASEO_COMPANION_CLI" daemon status --home "$PASEO_HOME")"
if ! grep -Eq '^daemonVersion: 0\.16\.0-beta\.1$' <<< "$PASEO_COMPANION_STATUS"; then
  echo 'Deploy the patched 0.16.0-beta.1 daemon before installing these plugins.' >&2
  exit 1
fi
"$PASEO_COMPANION_NODE" -e '
  const fs = require("node:fs");
  const path = require("node:path");
  const config = JSON.parse(fs.readFileSync(path.join(process.env.PASEO_HOME, "config.json"), "utf8"));
  if (config.pluginsEnabled !== true) {
    console.error("Plugins are trusted, unsandboxed code with access to the daemon machine. Enable plugins explicitly before continuing.");
    process.exit(1);
  }
'

PASEO_COMPANION_REPOSITORIES=(paseo-action-inbox paseo-pr-watcher paseo-issue-workflow)
PASEO_COMPANION_IDS=(action-inbox pr-watcher github-issue-workflow)
PASEO_COMPANION_REVISIONS=(
  dda7482794e9224dbf0fc51fd42206c3b1204a94
  9f31c56f504419cbc003058b30de491fbd00f9e3
  e7c978d5c687b0c9df11f0ddf662da23cfdd981e
)

for PASEO_COMPANION_INDEX in 0 1 2; do
  PASEO_COMPANION_DIRECTORY="$PASEO_COMPANION_ROOT/.dev/companions/${PASEO_COMPANION_REPOSITORIES[$PASEO_COMPANION_INDEX]}"
  test "$(git -C "$PASEO_COMPANION_DIRECTORY" rev-parse HEAD)" = "${PASEO_COMPANION_REVISIONS[$PASEO_COMPANION_INDEX]}"
  test -z "$(git -C "$PASEO_COMPANION_DIRECTORY" status --porcelain --untracked-files=normal -- . ':!node_modules')"
done

echo 'Installing reviewed plugin sources. Plugins execute trusted, unsandboxed code.'
for PASEO_COMPANION_INDEX in 0 1 2; do
  PASEO_COMPANION_DIRECTORY="$PASEO_COMPANION_ROOT/.dev/companions/${PASEO_COMPANION_REPOSITORIES[$PASEO_COMPANION_INDEX]}"
  "$PASEO_COMPANION_NODE" "$PASEO_COMPANION_CLI" plugin install "$PASEO_COMPANION_DIRECTORY" --id "${PASEO_COMPANION_IDS[$PASEO_COMPANION_INDEX]}"
done
"$PASEO_COMPANION_NODE" "$PASEO_COMPANION_CLI" plugin ls
echo 'Host browser remains uninstalled: its PR requires a Playwright bundling fix; see LOCAL_BUILD.md.'
