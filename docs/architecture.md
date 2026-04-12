# Architecture

This document explains **why** VALIS is built the way it is.
For setup, see README.md. For full requirements, see PRD.md.

## Core Design Principle

**One function, zero infrastructure.**

VALIS is a single Vercel serverless function that chains three API calls
(Groq Whisper → Groq Llama → Notion). There is no database, no queue, no background worker,
no cron job. Notion is both the UI and the database.

This is intentional. The goal is an MVP that can be built in a day and costs
$0/month. Every component that isn't strictly necessary was removed.

```
┌─────────────┐     ┌──────────────────────┐     ┌───────────────────┐
│  Telegram    │     │  Vercel              │     │  APIs             │
│              │     │  api/webhook.ts      │     │                   │
│  .ogg audio  │────▶│                      │────▶│  Groq Whisper     │
│              │     │  1 function          │     │  Groq Llama 3.3   │
│              │◀────│  3 API calls         │     │  Notion           │
│  reply       │     │  ~8s total           │     │                   │
└─────────────┘     └──────────────────────┘     └───────────────────┘
```

## Why These Choices

### Telegram (not iOS Shortcut, not a native app)

- Voice messages are native — long-press, speak, release
- Bot replies in the same chat = instant feedback loop
- Natural conversation log (scroll back to see all captures)
- Works on phone AND desktop
- Zero app code to build or maintain
- Can evolve to accept text, photos, and links later

### Groq Whisper (not OpenAI Whisper, not on-device)

- **Free tier:** 7,200 requests/day — unreachable for personal use
- **Speed:** ~10x realtime on Groq's LPU hardware (60s audio → ~6s)
- Same `whisper-large-v3-turbo` model as OpenAI, same accuracy
- MacWhisper is desktop-only, can't be called from a serverless function

### Groq Llama 3.3 70B (not Gemini, not GPT-4o-mini)

- **Same provider as transcription** — one API key for the whole pipeline
- **Free tier** (30 RPM) is sufficient for personal use
- Fast inference on Groq's LPU hardware (~1-2s per classification)
- Supports JSON mode via `response_format: { type: "json_object" }`
- High quality for binary classification + title generation + tagging

### Notion (not Obsidian, not a custom DB)

- Already used by the team for wiki + task management
- Personal workspace (free plan) keeps this separate from business
- API is simple and well-documented
- Databases have built-in views (Kanban for actions, Table for ideas)
- No separate UI to build — Notion IS the UI
- Relation property enables cross-linking ideas for synthesis later

### Vercel (not Cloudflare Workers, not AWS Lambda)

- Simpler DX than Cloudflare Workers
- Free hobby tier is sufficient
- Native TypeScript support
- Easy environment variable management
- `vercel dev` for local testing

## Why Two Notion Databases (not one)

Actions need a Kanban view (To Do → In Progress → Done).
Ideas need a Table view grouped by Theme (Product, Content, Strategy...).

A single database with a "Type" property forces both views into one layout.
Separate databases give each type the view it deserves.

The cost: Notion API writes go to different database IDs based on classification.
This is one `if` statement. The simplicity of separate views outweighs the
complexity of one branch.

## Why the Classifier Prompt is Versioned

The classification prompt is the most important file in the repo. It determines
whether voice notes get routed correctly. Getting it wrong means:

- Actions lost in the ideas pile (you forget to do things)
- Ideas cluttering the action board (noise in your task list)

The prompt will need to evolve as usage patterns emerge. Versioning it in
`prompts/classifier.md` with a changelog means:

1. You can see what changed and when
2. You can roll back if a change makes things worse
3. The `tune-classifier` skill can track improvements over time

## What's Intentionally NOT Here

- **No queue or background worker.** The pipeline runs synchronously in ~8s.
  That's fast enough. A queue adds operational complexity for no benefit.
- **No custom UI.** Notion is the UI. The Telegram chat is the input UI.
- **No auth system.** Single user. The Telegram bot token + webhook secret
  are the only auth.
- **No retry queue.** If an API call fails, retry once inline. If it fails
  again, tell the user. Don't build a dead letter queue for an MVP.
- **No analytics dashboard.** Check Vercel logs for errors. Check Notion
  for volume. That's enough for one user.
- **No multi-model fallback.** If Groq is down, the user gets an error.
  Building fallback to another provider adds complexity for a rare edge case.

## Latency Budget

```
Step                          Expected    Timeout
───────────────────────────   ────────    ───────
Telegram → Vercel webhook     ~200ms      —
Download .ogg from Telegram   ~500ms      5s
Groq Whisper transcription    ~2-6s       30s
Groq Llama classification     ~1-2s       15s
Notion API write              ~500ms      10s
Telegram reply                ~200ms      5s
───────────────────────────   ────────
Total                         ~5-10s
```

Vercel serverless functions have a 60s timeout on the hobby plan.
The full pipeline should complete in ~10s worst case. Comfortable margin.
