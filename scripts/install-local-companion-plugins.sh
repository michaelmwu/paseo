#!/usr/bin/env bash
set -euo pipefail

PASEO_COMPANION_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
PASEO_COMPANION_NODE=/home/michaelmwu/.local/share/mise/installs/node/22.20.0/bin/node
PASEO_COMPANION_CLI="$PASEO_COMPANION_ROOT/packages/cli/dist/index.js"
export PASEO_HOME=/home/michaelmwu/.paseo

test "$(id -un)" = michaelmwu
test "$("$PASEO_COMPANION_NODE" "$PASEO_COMPANION_CLI" --version)" = '0.16.0-beta.2'
PASEO_COMPANION_STATUS="$("$PASEO_COMPANION_NODE" "$PASEO_COMPANION_CLI" daemon status --home "$PASEO_HOME")"
if ! grep -Fxq 'daemonVersion: 0.16.0-beta.2' <<< "$PASEO_COMPANION_STATUS"; then
  echo 'Deploy the patched 0.16.0-beta.2 daemon before installing these plugins.' >&2
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

PASEO_COMPANION_PINS="$("$PASEO_COMPANION_NODE" -e '
  const fs = require("node:fs");
  const path = require("node:path");
  const { execFileSync } = require("node:child_process");
  const manifest = require(process.argv[1]);
  const root = path.dirname(process.argv[1]);
  const config = JSON.parse(fs.readFileSync(path.join(process.env.PASEO_HOME, "config.json"), "utf8"));
  for (const {repository, id, commit} of manifest.plugins) {
    const name = repository.split("/").at(-1);
    const directory = path.join(root, ".dev/companions", name);
    const existing = config.plugins?.[id];
    if (existing) {
      const files = execFileSync("git", ["-C", directory, "ls-files", "-z"], {encoding:"utf8"}).split("\0").filter(Boolean);
      for (const file of files) {
        if (file !== "paseo-plugin.json" && !/^(index\.(client|server)\.[cm]?[jt]sx?$|(client|server|shared)\/)/.test(file)) continue;
        if (/\.(test|spec)\./.test(file)) continue;
        const installed = path.join(existing.path, file);
        if (!fs.existsSync(installed) || !fs.readFileSync(path.join(directory, file)).equals(fs.readFileSync(installed))) {
          throw new Error(`Existing ${id} differs from the reviewed source (${file}). Update it explicitly before rerunning; its source and settings have not been removed.`);
        }
      }
    }
    console.log([name, id, commit, existing ? "reload" : "install"].join("\t"));
  }
' "$PASEO_COMPANION_ROOT/local-build-inputs.json")"

# Check every source before changing any daemon plugin configuration.
while IFS=$'\t' read -r PASEO_COMPANION_REPOSITORY PASEO_COMPANION_ID PASEO_COMPANION_REVISION PASEO_COMPANION_ACTION; do
  PASEO_COMPANION_DIRECTORY="$PASEO_COMPANION_ROOT/.dev/companions/$PASEO_COMPANION_REPOSITORY"
  test "$(git -C "$PASEO_COMPANION_DIRECTORY" rev-parse HEAD)" = "$PASEO_COMPANION_REVISION"
  test -z "$(git -C "$PASEO_COMPANION_DIRECTORY" status --porcelain --untracked-files=normal -- . ':!node_modules')"
done <<< "$PASEO_COMPANION_PINS"

echo 'Installing reviewed plugin sources. Plugins execute trusted, unsandboxed code.'
while IFS=$'\t' read -r PASEO_COMPANION_REPOSITORY PASEO_COMPANION_ID PASEO_COMPANION_REVISION PASEO_COMPANION_ACTION; do
  PASEO_COMPANION_DIRECTORY="$PASEO_COMPANION_ROOT/.dev/companions/$PASEO_COMPANION_REPOSITORY"
  if [[ "$PASEO_COMPANION_ACTION" = reload ]]; then
    "$PASEO_COMPANION_NODE" "$PASEO_COMPANION_CLI" plugin reload "$PASEO_COMPANION_ID"
  else
    "$PASEO_COMPANION_NODE" "$PASEO_COMPANION_CLI" plugin install "$PASEO_COMPANION_DIRECTORY" --id "$PASEO_COMPANION_ID"
  fi
done <<< "$PASEO_COMPANION_PINS"
"$PASEO_COMPANION_NODE" "$PASEO_COMPANION_CLI" plugin ls
