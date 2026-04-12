# VALIS — Development Context

## What this is

VALIS (Voice-Activated Logging & Intelligent Sorting) is a Telegram bot that
captures voice notes, transcribes them, classifies them as **actions** or
**ideas**, and routes them to the correct destination. Zero manual sorting.

- **Actions** → Notion (task tracking database)
- **Ideas** → Obsidian (via GitHub sync → iCloud vault)

Core loop: **speak → transcribe → classify → enrich → route**

## Architecture

```
Telegram Bot  →  Vercel Serverless  →  Groq Whisper  →  Groq Llama 3.3 70B  →  Actions: Notion API
(capture)        (webhook handler)     (transcribe)     (classify + enrich)     Ideas:  GitHub → Obsidian
```

Single serverless function at `api/webhook.ts` handles the entire pipeline.

**Obsidian sync flow:** Vercel writes `.md` files to `jmaulana0/valis-obsidian-sync`
via GitHub API → launchd runs `scripts/sync-to-obsidian.sh` every 5 min →
files land in `00 - Inbox/` of the iCloud Obsidian vault → existing
`organize-inbox.sh` sorts them.

## Tech Stack

| Component | Technology |
|---|---|
| Capture | Telegram Bot API (voice messages) |
| API | Vercel Serverless Function (TypeScript) |
| Transcription | Groq Whisper `large-v3-turbo` |
| Classification | Groq Llama 3.3 70B (`llama-3.3-70b-versatile`) |
| Action Storage | Notion API (Actions database) |
| Idea Storage | GitHub API → Obsidian (iCloud vault via sync script) |

## Project Structure

```
VALIS/
├── api/
│   └── webhook.ts              # Single Vercel serverless function
├── lib/
│   ├── telegram.ts             # Telegram Bot API helpers
│   ├── transcribe.ts           # Groq Whisper transcription
│   ├── classify.ts             # Llama 3.3 70B classification + enrichment (via Groq)
│   ├── notion.ts               # Notion API writes (actions)
│   └── obsidian.ts             # GitHub API writes (ideas → Obsidian)
├── prompts/
│   └── classifier.md           # Classification prompt (the brain)
├── docs/
│   ├── architecture.md         # Why decisions were made
│   └── decisions/              # Architecture Decision Records
├── .claude/
│   └── skills/                 # Reusable AI agent workflows
│       ├── deploy/
│       │   └── SKILL.md        # Deploy to Vercel
│       ├── test-pipeline/
│       │   └── SKILL.md        # Test the full pipeline
│       └── tune-classifier/
│           └── SKILL.md        # Improve classification prompt
├── scripts/
│   ├── sync-to-obsidian.sh         # Pulls ideas from GitHub → Obsidian vault
│   └── com.valis.obsidian-sync.plist # launchd config (every 5 min)
├── .env.example
├── package.json
├── tsconfig.json
├── vercel.json
├── PRD.md
├── CLAUDE.md                   # This file
└── README.md
```

## Commands

```bash
npm install              # Install dependencies
npm run dev              # Local dev server (Vercel dev)
vercel --prod            # Deploy to production
npm test                 # Run tests
```

## Environment Variables

```
TELEGRAM_BOT_TOKEN          # From @BotFather
TELEGRAM_WEBHOOK_SECRET     # Self-generated, for webhook verification
GROQ_API_KEY                # From console.groq.com (transcription + classification)
NOTION_TOKEN                # From notion.so/my-integrations
NOTION_ACTIONS_DB_ID        # Actions database ID
NOTION_IDEAS_DB_ID          # Ideas database ID (kept for update/search)
GITHUB_TOKEN                # GitHub PAT with repo scope (for Obsidian sync)
GITHUB_OBSIDIAN_REPO        # e.g. jmaulana0/valis-obsidian-sync
```

## Key Files

- `api/webhook.ts` — The entire pipeline in one function. All logic flows through here.
- `lib/classify.ts` — Contains the classification prompt (runs on Llama 3.3 70B via Groq).
  This is the "brain" of the system. **When classification is wrong, this is what needs to change.**
- `prompts/classifier.md` — Source of truth for the classification prompt.
  The prompt in `lib/classify.ts` should match this file.
- `docs/decisions/` — ADRs for why we chose Telegram, Groq, Notion.

## Conventions

- **Single function architecture.** Everything is one Vercel serverless function.
  Do not split into multiple endpoints unless there's a clear reason.
- **Dual storage.** Actions live in Notion. Ideas live in Obsidian (synced via GitHub).
- **Classification prompt is versioned.** Changes to the classifier prompt must be
  documented in `prompts/classifier.md` with a changelog entry.
- **Errors reply to the user.** Every error path must send a Telegram message
  back so the user knows what happened. Silent failures are unacceptable.
- **Raw transcript is always saved.** Even if classification fails, the raw
  Whisper output must be persisted (in the Notion entry or as a fallback message).
- **No over-engineering.** This is an MVP for one user. No auth system, no
  multi-tenancy, no admin panel.

## Skills

VALIS uses `.claude/skills/` for repeatable AI agent workflows:

| Skill | Purpose |
|---|---|
| `/deploy` | Deploy to Vercel, set webhook, verify health |
| `/test-pipeline` | End-to-end test: send audio → check Notion entry |
| `/tune-classifier` | Review misclassifications and improve the prompt |

## Self-Improving Classification

The classifier prompt at `prompts/classifier.md` is the most important file
in this repo. It determines whether voice notes get routed correctly.

The improvement loop:
1. User captures voice notes via Telegram bot
2. Some get misclassified (action tagged as idea, or vice versa)
3. User manually re-categorizes in Notion (moves between databases)
4. `/tune-classifier` skill reviews corrections and suggests prompt improvements
5. Updated prompt is tested against past transcripts
6. If accuracy improves, prompt is committed

This is the "self-reinforcing skill" pattern — the classifier gets better
over time based on real usage data.

## Prompt/LLM Changes

Any change to the classification prompt (`prompts/classifier.md` or
`lib/classify.ts`) must:
1. Document what changed and why
2. Test against at least 5 past transcripts (mix of actions and ideas)
3. Verify no regressions on previously-correct classifications
