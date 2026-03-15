# PRD | VALIS — Voice-Activated Logging & Intelligent Sorting

> **speak → transcribe → classify → enrich → route**
>
> Capture voice notes on-the-go. Zero manual sorting. $0/month.

---

## 1. Problem

Ideas and actions die in transit. You're walking, driving, or running — a thought hits — and by the time you sit down at a computer, it's gone or half-remembered.

Current workarounds fail:

- **Voice memos** → pile up, never get processed
- **Notes apps** → typing while walking is slow and dangerous
- **"I'll remember it"** → you won't

The core pain: **there is no zero-friction path from spoken thought to organized, actionable output.**

---

## 2. Solution

A Telegram bot that listens to your voice, transcribes it, classifies it as either an **action** or an **idea**, enriches it with a title/tags/priority, and writes it directly to the correct Notion database.

The entire interaction happens inside a Telegram chat. No app to install. No screen to design. No manual sorting.

---

## 3. User Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         TELEGRAM CHAT                               │
│                                                                     │
│  YOU:  🎤 "We should rethink the onboarding flow, it's way too     │
│         long and people drop off at step 3"                         │
│                                                                     │
│  BOT:  💡 Idea saved                                                │
│        Title: Simplify onboarding flow                              │
│        Theme: Product                                               │
│        Tags: #onboarding #ux #retention                             │
│                                                                     │
│  YOU:  🎤 "Message Sarah about the partnership deck, need it        │
│         before Thursday"                                            │
│                                                                     │
│  BOT:  ✅ Action saved                                              │
│        Title: Get partnership deck from Sarah                       │
│        Priority: High                                               │
│        Due: Thursday                                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Architecture

```
┌─────────────┐     ┌──────────────────────┐     ┌───────────────────┐
│  Telegram    │     │  Vercel Serverless    │     │  External APIs    │
│              │     │  Function (webhook)   │     │                   │
│  Voice msg   │────▶│                      │────▶│  1. Groq Whisper   │
│  from user   │     │  1. Receive webhook   │     │     large-v3-turbo│
│              │     │  2. Download audio    │     │     (transcribe)  │
│              │◀────│  3. Transcribe (Groq) │     │                   │
│  Bot reply   │     │  4. Classify+enrich   │────▶│  2. Gemini 3.1    │
│  with result │     │     (Gemini)          │     │     Flash-Lite    │
│              │     │  5. Write to Notion   │     │     (classify +   │
└─────────────┘     │  6. Reply to user     │     │      enrich)      │
                    └──────────────────────┘     │                   │
                                                  │  3. Notion API    │
                                                  │     (write)       │
                                                  └───────────────────┘
```

### Pipeline Detail

```
STEP 1: RECEIVE          STEP 2: TRANSCRIBE       STEP 3: CLASSIFY+ENRICH     STEP 4: ROUTE
──────────────           ──────────────────       ───────────────────────     ─────────────

Telegram webhook  ──▶    Groq Whisper API   ──▶   Gemini 3.1 Flash-Lite ──▶  Notion API
                         large-v3-turbo                                       
receives voice           transcribes .ogg          Input: transcript          If type=action:
message + chat ID        audio to text             Output: JSON               → write to Actions DB
                                                    {                         
downloads .ogg           Returns: raw               type: action | idea      If type=idea:
audio file via           transcript string          title: string             → write to Ideas DB
Telegram File API                                   body: string             
                                                    tags: [string]           Then reply to user
                                                    priority?: string         in Telegram with
                                                    theme?: string            confirmation
                                                    due_hint?: string        
                                                   }                         
```

---

## 5. Components

### 5.1 Capture — Telegram Bot

- **Platform:** Telegram Bot API
- **Input:** Voice messages (`.ogg` format, Opus codec)
- **Interaction:** User sends voice message → bot replies with classification result
- **Setup:** Create bot via [@BotFather](https://t.me/BotFather), receive bot token
- **Why Telegram:**
  - Voice messages are native (long-press mic, speak, release)
  - Bot replies create a natural conversation log
  - Works on phone and desktop
  - No app to build or maintain
  - Scroll back to see everything you've ever captured

### 5.2 API — Vercel Serverless Function

- **Runtime:** Node.js (TypeScript)
- **Endpoint:** Single webhook handler (`/api/webhook`)
- **Hosting:** Vercel Hobby plan (free)
- **Why Vercel:** Simple DX, free tier sufficient, easy to iterate

### 5.3 Transcription — Groq Whisper

- **Model:** `whisper-large-v3-turbo`
- **Cost:** $0.04/hour (~$0.0007 per 1-minute voice note)
- **Free tier:** 7,200 requests/day
- **Latency:** ~10x realtime (a 60s clip transcribes in ~6s)
- **Why Groq:** Fastest Whisper API available, essentially free for personal use, excellent accuracy

### 5.4 Classification & Enrichment — Gemini 3.1 Flash-Lite

- **Model:** `gemini-3.1-flash-lite` (Preview)
- **Cost:** Free tier available. Paid: $0.25/1M input tokens, $1.50/1M output tokens
- **Why Gemini 3.1 Flash-Lite:**
  - Newest generation model (3.1), purpose-built for high-volume simple tasks
  - Optimized for classification, data processing, structured output
  - Free tier is generous for personal use
  - Supports structured JSON output natively
  - Cheapest option if usage ever exceeds free tier

**Classification prompt (system):**

```
You are a voice note classifier. Given a transcript of a voice note, determine
whether it is an ACTION (something to do) or an IDEA (something to think about,
develop, or write about later).

Respond with JSON only. No markdown. No explanation.

Schema:
{
  "type": "action" | "idea",
  "title": "5-7 word summary",
  "body": "cleaned up version of the transcript, fixing filler words and 
           false starts but preserving meaning and voice",
  "tags": ["lowercase-tag", ...],    // 1-5 tags
  "priority": "high" | "medium" | "low",   // actions only
  "due_hint": "string or null",             // actions only, extracted from speech
  "theme": "string"                         // ideas only: Product | Content | Strategy | Operations | Personal
}

Rules:
- If the speaker says to DO something, contact someone, send something, 
  build something, fix something → ACTION
- If the speaker is thinking out loud, exploring a concept, describing a 
  vision, or brainstorming → IDEA
- When ambiguous, classify as IDEA (ideas are cheaper to ignore than missed actions)
- Title should be crisp and scannable, not a sentence
- Body should read naturally — remove "um", "uh", "like", false starts
- Tags should be reusable across notes (prefer recurring tags over one-off ones)
```

### 5.5 Storage — Notion (Personal Workspace)

Two databases in a dedicated personal Notion workspace (free plan).

#### Actions DB — Kanban View

| Property | Type | Purpose | Example |
|---|---|---|---|
| Title | Title | Short action description | "Get partnership deck from Sarah" |
| Status | Select | Workflow stage | `To Do` / `In Progress` / `Done` |
| Priority | Select | Urgency | `High` / `Medium` / `Low` |
| Due | Date | Deadline (if mentioned) | 2026-03-20 |
| Tags | Multi-select | Categorization | `#partnerships`, `#sarah` |
| Body | Text | Cleaned-up transcript | Full enriched text |
| Raw Transcript | Text | Original Whisper output | Unedited transcript |
| Telegram Timestamp | Date | When the voice note was sent | Auto |
| Created | Created time | Notion record creation | Auto |

**Default Kanban columns:** To Do → In Progress → Done

#### Ideas DB — Table + Gallery View

| Property | Type | Purpose | Example |
|---|---|---|---|
| Title | Title | Short idea summary | "Simplify onboarding flow" |
| Theme | Select | High-level category | `Product` / `Content` / `Strategy` / `Operations` / `Personal` |
| Status | Select | Maturity stage | `Raw` / `Developing` / `Published` |
| Tags | Multi-select | Categorization | `#onboarding`, `#ux` |
| Body | Text | Cleaned-up transcript | Full enriched text |
| Raw Transcript | Text | Original Whisper output | Unedited transcript |
| Related Ideas | Relation | Cross-link for synthesis | Links to other idea entries |
| Telegram Timestamp | Date | When the voice note was sent | Auto |
| Created | Created time | Notion record creation | Auto |

**Synthesis workflow:**
1. Ideas arrive as `Raw`
2. Periodically filter by theme → review related ideas
3. Combine into `Developing` → draft article/post/internal doc
4. Finalize → `Published`

---

## 6. Tech Stack Summary

| Component | Technology | Cost |
|---|---|---|
| Capture | Telegram Bot API | Free |
| API / Hosting | Vercel Serverless (Hobby) | Free |
| Transcription | Groq Whisper `large-v3-turbo` | Free tier / ~$0.04/hr |
| Classification | Gemini 3.1 Flash-Lite | Free tier / ~$0.25/1M input tokens |
| Storage | Notion API (personal workspace) | Free |
| **Total** | | **$0/month** |

---

## 7. API Keys & Setup Required

| Service | What to create | Where |
|---|---|---|
| Telegram | Bot token via @BotFather | [t.me/BotFather](https://t.me/BotFather) |
| Groq | API key | [console.groq.com](https://console.groq.com) |
| Google AI Studio | API key for Gemini | [aistudio.google.com](https://aistudio.google.com) |
| Notion | Internal integration + database IDs | [notion.so/my-integrations](https://www.notion.so/my-integrations) |

All keys stored as Vercel environment variables. Never committed to code.

---

## 8. Error Handling

| Failure | What happens | User sees |
|---|---|---|
| Groq transcription fails | Retry once, then reply with error | "⚠️ Couldn't transcribe. Try again?" |
| Gemini classification fails | Retry once, then save raw transcript to Ideas DB as unclassified | "⚠️ Saved but couldn't classify. Check your Ideas board." |
| Notion write fails | Retry once, then reply with the classified JSON so user can manually save | "⚠️ Couldn't save to Notion. Here's what I got: [JSON]" |
| Audio too short (<1s) | Skip processing | "⚠️ Voice note too short. Try again?" |
| Audio too long (>5min) | Process anyway (Whisper handles long audio) | Normal response |
| Non-voice message (text) | Reply with help text | "Send me a voice message and I'll sort it for you." |
| Unknown error | Log to Vercel, reply with generic error | "⚠️ Something went wrong. Try again." |

---

## 9. Project Structure

```
VALIS/
├── api/
│   └── webhook.ts          # Single Vercel serverless function
├── lib/
│   ├── telegram.ts          # Telegram Bot API helpers (download audio, send reply)
│   ├── transcribe.ts        # Groq Whisper API call
│   ├── classify.ts          # Gemini 3.1 Flash-Lite classification + enrichment
│   └── notion.ts            # Notion API writes (actions DB + ideas DB)
├── .env.example             # Template for required env vars
├── .gitignore
├── package.json
├── tsconfig.json
├── vercel.json              # Route config
├── PRD.md                   # This document
└── README.md                # Setup instructions
```

---

## 10. Environment Variables

```
TELEGRAM_BOT_TOKEN=          # From @BotFather
TELEGRAM_WEBHOOK_SECRET=     # Self-generated, for webhook verification
GROQ_API_KEY=                # From console.groq.com
GEMINI_API_KEY=              # From aistudio.google.com
NOTION_TOKEN=                # From notion.so/my-integrations
NOTION_ACTIONS_DB_ID=        # Actions database ID
NOTION_IDEAS_DB_ID=          # Ideas database ID
```

---

## 11. Scope

### In scope (MVP)

- Telegram bot receives voice messages
- Transcription via Groq Whisper
- Binary classification (action vs. idea) via Gemini 3.1 Flash-Lite
- Enrichment: auto-generated title, cleaned body, tags, priority (actions), theme (ideas)
- Write to correct Notion DB
- Reply to user with confirmation
- Basic error handling with retry

### NOT in scope (future)

| Feature | Rationale for deferral |
|---|---|
| Text message input | Voice-first MVP; text adds branching logic without testing the core loop |
| Idea synthesis / auto-merge | Requires retrieval + comparison logic; manual synthesis via Notion views is fine for now |
| Content generation (LinkedIn posts, tweets) | Depends on having enough enriched ideas first |
| Multi-user / auth | Solo user MVP |
| Daily digest notifications | Nice-to-have; not needed to validate the core capture loop |
| "Continue this thought" threading | Requires conversation state; defer to post-MVP |
| Edit/undo after classification | Can manually edit in Notion |
| Custom classification categories | Binary is sufficient to validate; expand after learning patterns |
| Mobile app | Telegram IS the app |

---

## 12. Success Criteria

The MVP is successful if:

1. **Capture friction < 5 seconds** — from pulling out phone to finishing a voice note
2. **Classification accuracy > 90%** — spot-check 20 notes, ≤2 misclassified
3. **I actually use it daily for 1 week** — the real test is habit formation
4. **My Notion boards have useful, scannable entries** — not garbled transcripts

---

## 13. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Gemini 3.1 Flash-Lite preview breaks/changes | Medium | High | Pin model version; fallback to Gemini 2.5 Flash (stable) |
| Groq free tier rate-limited | Low | Medium | 7,200 req/day is massive headroom; fallback to OpenAI Whisper |
| Transcription errors mess up classification | Medium | Medium | Keep raw transcript in Notion for manual correction |
| Telegram bot latency feels slow | Low | Medium | Groq Whisper is ~6s, Gemini is ~1s, Notion is ~1s. Total ~8s is acceptable |
| Ambiguous notes get misclassified | Medium | Low | Default to idea (cheaper to ignore); user can manually move in Notion |
| Vercel cold starts add latency | Low | Low | First request after idle may take 2-3s extra; acceptable for async capture |

---

## 14. Implementation Order

```
Phase 1: Foundation                    Phase 2: Integration               Phase 3: Polish
─────────────────                      ────────────────────               ──────────────────

1. Create Telegram bot                 4. Wire up Groq Whisper            7. Error handling + retries
   (@BotFather)                           transcription                   8. Telegram reply formatting
2. Set up Vercel project               5. Wire up Gemini 3.1              9. Test with 20 real voice notes
   with webhook endpoint                  Flash-Lite classification       10. Adjust classification prompt
3. Set up Notion workspace             6. Wire up Notion API writes           based on results
   with two databases                     to both databases
```

Each phase is independently testable. Phase 1 gives you a bot that echoes. Phase 2 gives you the full pipeline. Phase 3 makes it reliable.
