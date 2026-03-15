# ADR-003: Gemini 3.1 Flash-Lite for Classification

**Status:** Accepted
**Date:** 2026-03-15

## Context

Need an LLM to classify transcribed voice notes as "action" or "idea"
and enrich them with title, tags, priority/theme. Must be cheap or free,
fast, and reliable at structured JSON output.

## Options Considered

| Option | Cost (per 1M tokens) | Free tier | Structured output | Quality |
|---|---|---|---|---|
| Gemini 3.1 Flash-Lite | $0.25 in / $1.50 out | Yes | Native | Sufficient |
| Gemini 3.0 Flash | $0.50 in / $3.00 out | Yes | Native | Good |
| Gemini 2.5 Flash | $0.30 in / $2.50 out | Yes | Native | Good |
| Groq Llama 3.3 70B | Free | Yes (30 RPM) | Via prompting | Good |
| GPT-4o-mini | $0.15 in / $0.60 out | No free tier | Native | Excellent |

## Decision

Gemini 3.1 Flash-Lite.

## Rationale

- Newest generation (3.1), optimized for "high-volume agentic tasks,
  classification, and data processing" — exactly this use case
- Free tier is generous for personal use
- Cheapest paid option if free tier is exceeded
- Native structured JSON output reduces parsing failures
- Binary classification is a simple task — doesn't need a more capable model

## Consequences

- Model is in Preview — API may change
- Fallback: Gemini 2.5 Flash (stable) uses nearly identical API
- Gemini 2.0 Flash is deprecated (June 2026) — do not use
