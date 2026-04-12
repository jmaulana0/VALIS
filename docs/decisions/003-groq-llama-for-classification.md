# ADR-003: Groq Llama 3.3 70B for Classification

**Status:** Accepted
**Date:** 2026-03-15

## Context

Need an LLM to classify transcribed voice notes as "action" or "idea"
and enrich them with title, tags, priority/theme. Must be cheap or free,
fast, and reliable at structured JSON output.

## Options Considered

| Option | Cost (per 1M tokens) | Free tier | Structured output | Quality |
|---|---|---|---|---|
| Groq Llama 3.3 70B | Free | Yes (30 RPM) | Via prompting + JSON mode | Good |
| Gemini 3.1 Flash-Lite | $0.25 in / $1.50 out | Yes | Native | Sufficient |
| Gemini 3.0 Flash | $0.50 in / $3.00 out | Yes | Native | Good |
| GPT-4o-mini | $0.15 in / $0.60 out | No free tier | Native | Excellent |

## Decision

Llama 3.3 70B hosted on Groq.

## Rationale

- Same provider as transcription (Groq) — one API key for the whole pipeline
- Free tier (30 RPM) is more than enough for personal use
- Fast inference on Groq's LPU hardware (~1-2s per request)
- Supports `response_format: { type: "json_object" }` for reliable JSON output
- High quality at 70B parameters — more than sufficient for binary classification
- Avoids adding a second API provider (Google AI Studio) and a second API key

## Consequences

- Groq may deprecate or rename the model — swap the model ID in `lib/classify.ts`
- Any OpenAI-compatible chat API can be substituted with minimal code change
- Rate limit of 30 RPM is sufficient for personal use but would need a paid
  plan for higher volume
