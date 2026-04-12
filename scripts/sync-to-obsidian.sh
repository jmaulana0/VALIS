#!/bin/zsh
# sync-to-obsidian.sh — Pull new ideas from GitHub repo into Obsidian vault's Inbox
# Run via launchd every 5 minutes, or manually.
#
# Setup:
#   1. Clone the sync repo:  git clone git@github.com:<you>/valis-obsidian-sync.git ~/valis-obsidian-sync
#   2. Make executable:  chmod +x scripts/sync-to-obsidian.sh
#   3. Install the launchd agent:  ./scripts/install-sync.sh

SYNC_REPO="$HOME/valis-obsidian-sync"
VAULT="$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/Obsidian Vault"
INBOX="$VAULT/00 - Inbox"
LOG="$SYNC_REPO/sync.log"

# Ensure repo exists
if [ ! -d "$SYNC_REPO/.git" ]; then
  echo "$(date): Sync repo not found at $SYNC_REPO — clone it first." >> "$LOG"
  exit 1
fi

# Pull latest from GitHub
cd "$SYNC_REPO" || exit 1
git pull --quiet origin main >> "$LOG" 2>&1

# Move any new files from inbox/ to the Obsidian vault
if [ -d "$SYNC_REPO/inbox" ] && [ "$(ls -A "$SYNC_REPO/inbox/" 2>/dev/null)" ]; then
  count=0
  for file in "$SYNC_REPO/inbox/"*.md; do
    [ -f "$file" ] || continue
    basename="$(basename "$file")"
    mv "$file" "$INBOX/$basename"
    count=$((count + 1))
  done

  if [ $count -gt 0 ]; then
    echo "$(date): Moved $count file(s) to Obsidian Inbox" >> "$LOG"

    # Commit the removal so files aren't re-synced
    cd "$SYNC_REPO" || exit 1
    git add -A
    git commit -m "Synced $count idea(s) to Obsidian" --quiet
    git push --quiet origin main >> "$LOG" 2>&1
  fi
else
  # Nothing to sync — stay quiet
  :
fi
