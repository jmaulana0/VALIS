# ADR-002: Groq Whisper for Transcription

**Status:** Accepted
**Date:** 2026-03-15

## Context

Need a server-side transcription API that is fast, accurate, and free/cheap
for personal use volume (~5-20 voice notes/day).

## Options Considered

| Option | Model | Cost | Speed | Free tier |
|---|---|---|---|---|
| Groq | whisper-large-v3-turbo | $0.04/hr | ~10x realtime | 7,200 req/day |
| OpenAI | whisper-1 | $0.006/min | ~1x realtime | None |
| Google Speech | chirp | Free tier | Fast | 60 min/month |
| MacWhisper | Local whisper | Free | N/A | N/A — desktop only |

## Decision

Groq Whisper (`whisper-large-v3-turbo`).

## Rationale

- Free tier of 7,200 req/day is massive headroom (need ~20/day)
- Fastest Whisper API available (~10x realtime on LPU hardware)
- Same whisper-large-v3 model as OpenAI — equivalent accuracy
- MacWhisper is desktop-only, can't be called from serverless function
- Google Speech free tier (60 min/month) is too restrictive

## Consequences

- Dependent on Groq's free tier continuing
- Fallback: OpenAI Whisper at $0.006/min (~$0.07/day for 10 one-minute notes)
