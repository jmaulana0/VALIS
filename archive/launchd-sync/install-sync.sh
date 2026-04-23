#!/bin/zsh
# install-sync.sh — Generate and install the launchd agent for Obsidian sync.
# Run from the VALIS repo root: ./scripts/install-sync.sh

set -e

VALIS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PLIST_NAME="com.valis.obsidian-sync.plist"
DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"

# Unload existing agent if present
if launchctl list | grep -q com.valis.obsidian-sync; then
  echo "Unloading existing agent..."
  launchctl unload "$DEST" 2>/dev/null || true
fi

# Generate plist with the correct absolute path
cat > "$DEST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.valis.obsidian-sync</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/zsh</string>
        <string>${VALIS_DIR}/scripts/sync-to-obsidian.sh</string>
    </array>
    <key>StartInterval</key>
    <integer>300</integer>
    <key>StandardOutPath</key>
    <string>/tmp/valis-obsidian-sync.out</string>
    <key>StandardErrorPath</key>
    <string>/tmp/valis-obsidian-sync.err</string>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
PLIST

# Load the agent
launchctl load "$DEST"
echo "Installed and loaded $PLIST_NAME"
echo "  Script: ${VALIS_DIR}/scripts/sync-to-obsidian.sh"
echo "  Interval: every 5 minutes"
echo "  Logs: /tmp/valis-obsidian-sync.{out,err}"
