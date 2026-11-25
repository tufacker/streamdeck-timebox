#!/usr/bin/env zsh
set -euo pipefail

script_dir=${0:A:h}
plugin_name="io.github.tufacker.timebox.sdPlugin"
plugin_src="$script_dir/$plugin_name"
plugin_dst="$HOME/Library/Application Support/com.elgato.StreamDeck/Plugins/$plugin_name"

if [[ ! -f "$plugin_src/manifest.json" ]]; then
  echo "Missing plugin manifest at $plugin_src/manifest.json"
  exit 1
fi

mkdir -p "$plugin_dst"
rsync -a --delete --exclude '.DS_Store' --exclude 'logs' "$plugin_src/" "$plugin_dst/"

osascript -e 'tell application "Stream Deck" to quit' >/dev/null 2>&1 || true
sleep 1
open -a "Elgato Stream Deck"

echo "Installed $plugin_name"
