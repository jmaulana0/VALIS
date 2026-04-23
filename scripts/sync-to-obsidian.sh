#!/bin/zsh
# sync-to-obsidian.sh — Pull new notes from GitHub into the Obsidian vault.
#
# Topology: the Obsidian vault's "00 - Inbox" folder IS the sync repo
# (jmaulana0/valis-obsidian-sync is cloned directly at that path). The
# webhook writes new notes and images into the repo's inbox/ subfolder,
# so `git pull` is all we need — no file-moving, no second clone.
#
# Run via launchd every 5 minutes (see install-sync.sh), or manually.

VAULT_INBOX="${VAULT_INBOX:-$HOME/Documents/Obsidian/00 - Inbox}"
LOG="/tmp/valis-obsidian-sync.log"

if [ ! -d "$VAULT_INBOX/.git" ]; then
  echo "$(date): No git repo at $VAULT_INBOX — aborting." >> "$LOG"
  exit 1
fi

cd "$VAULT_INBOX" || exit 1

# Fast-forward only; if the vault has diverged (manual commits), log and stop
# rather than merging or rebasing behind the user's back.
if ! git pull --ff-only --quiet origin main >> "$LOG" 2>&1; then
  echo "$(date): git pull --ff-only failed — vault may have diverged." >> "$LOG"
  exit 1
fi
