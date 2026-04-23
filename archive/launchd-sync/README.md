# Archived: launchd-based Obsidian sync

Retired 2026-04-23 in favor of **Obsidian Sync** (already-paid-for $5/mo
Standard plan) + the existing `obsidian-git` plugin for the GitHub
audit-trail leg.

## What was here

- `sync-to-obsidian.sh` — zsh script that ran `git pull --ff-only` in the
  vault every 5 minutes.
- `com.valis.obsidian-sync.plist` — launchd agent at
  `~/Library/LaunchAgents/com.valis.obsidian-sync.plist` that scheduled
  the script.
- `install-sync.sh` — installer that copied the plist into LaunchAgents
  and loaded it with `launchctl`.

## Why it was retired

1. **It wasn't working.** At archive time, the launchd agent had been
   failing every run with `fatal: Unable to read current working directory:
   Operation not permitted` — a macOS sandbox permission error because
   launchd agents don't get Full Disk Access by default. The script also
   expected `.git` at `00 - Inbox/.git` but the actual repo lives at the
   vault root.
2. **It was redundant.** The `obsidian-git` community plugin was
   configured with `autoPullInterval: 5, autoPullOnBoot: true,
   disablePush: true` — meaning the plugin was already doing the same
   5-minute pull inside Obsidian, and had been carrying all the real
   sync load.
3. **The underlying fragility (`.git` swaps silently breaking sync)
   became obsolete.** Obsidian Sync activation makes the vault's git
   state irrelevant for cross-device sync — Sync uses its own protocol
   against Obsidian's servers.

## New architecture

```
Capture:   Telegram → Vercel webhook → GitHub API → jmaulana0/valis-obsidian-sync
Pull:      obsidian-git plugin (inside Obsidian, every 5 min) → vault files
Sync:      Obsidian Sync (live, bidirectional) → phone + any other device
```

`obsidian-git` is kept as a belt-and-suspenders audit trail. Every
capture is still in GitHub history.

## How to restore (if you ever need to)

1. Move the three files back to `scripts/`.
2. Fix the path: the script expected `$HOME/Documents/Obsidian/00 - Inbox/.git`
   but `.git` is at `$HOME/Documents/Obsidian/.git`. Update `VAULT_INBOX`
   in `sync-to-obsidian.sh` before re-enabling.
3. Grant the shell-running-launchd Full Disk Access in System Settings
   → Privacy & Security → Full Disk Access. This is the permission gate
   that was blocking every run.
4. `bash scripts/install-sync.sh` to reload the agent.

But you probably don't want to. `obsidian-git` already does this job
reliably.
