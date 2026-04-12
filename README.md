# VALIS — Voice-Activated Logging & Intelligent Sorting

> Capture voice notes on-the-go. Automatically transcribed, classified, and routed to the right place.

## How it works

1. Send a voice message to the Telegram bot
2. Audio is transcribed (Groq Whisper)
3. Transcript is classified as **Action** or **Idea** (Llama 3.3 70B via Groq)
4. Entry is written to the correct Notion database
5. Bot replies with confirmation

**Total cost: $0/month** on free tiers.

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Vercel CLI](https://vercel.com/docs/cli) (`npm i -g vercel`)
- Telegram account
- Notion account (personal workspace)

### 1. Clone & install

```bash
git clone https://github.com/jmaulana0/VALIS.git
cd VALIS
npm install
```

### 2. Create API keys

| Service | Where | What you need |
|---|---|---|
| Telegram | [t.me/BotFather](https://t.me/BotFather) | Bot token |
| Groq | [console.groq.com](https://console.groq.com) | API key (transcription + classification) |
| Notion | [notion.so/my-integrations](https://www.notion.so/my-integrations) | Integration token + 2 database IDs |

### 3. Set environment variables

```bash
cp .env.example .env
# Fill in your keys
```

### 4. Deploy

```bash
vercel --prod
```

### 5. Set Telegram webhook

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://<YOUR_VERCEL_URL>/api/webhook&secret_token=<YOUR_WEBHOOK_SECRET>"
```

### 6. Send a voice message to your bot

That's it.

## Project Structure

```
VALIS/
├── api/
│   └── webhook.ts          # Vercel serverless function (webhook handler)
├── lib/
│   ├── telegram.ts          # Telegram API helpers
│   ├── transcribe.ts        # Groq Whisper transcription
│   ├── classify.ts          # Llama 3.3 70B classification (via Groq)
│   └── notion.ts            # Notion API writes
├── .env.example
├── package.json
├── tsconfig.json
├── vercel.json
├── PRD.md                   # Full product requirements
└── README.md                # This file
```

## Documentation

See [PRD.md](PRD.md) for the full product requirements document, architecture diagrams, Notion schema, error handling, and implementation plan.

## License

MIT
