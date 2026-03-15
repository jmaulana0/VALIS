# ADR-001: Telegram Bot for Voice Capture

**Status:** Accepted
**Date:** 2026-03-15

## Context

Need a zero-friction way to capture voice notes on-the-go (walking, running,
driving) from an iPhone.

## Options Considered

| Option | Build effort | User friction | Maintenance |
|---|---|---|---|
| iOS Shortcut → API | Zero | Low (1 tap) | None |
| Telegram Bot | Low | Low (open app, hold mic) | Minimal |
| PWA with Record button | Medium | Medium | Some |
| Native iOS app | High | Lowest | Significant |

## Decision

Telegram Bot.

## Rationale

- Voice messages are native to Telegram (long-press mic)
- Bot replies create a natural feedback loop in the same chat
- Conversation history = searchable log of all captures
- Works on phone AND desktop (can type ideas at desk too)
- No app store review, no Swift code, no TestFlight
- iOS Shortcut was close second but lacks the reply/feedback loop

## Consequences

- Dependent on Telegram's platform and API stability
- Users must have Telegram installed
- Voice messages are .ogg (Opus codec) — must ensure Whisper handles this
