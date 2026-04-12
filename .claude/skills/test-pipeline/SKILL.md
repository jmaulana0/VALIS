---
name: test-pipeline
description: |
  End-to-end test of the VALIS pipeline. Sends a test audio file through the
  full flow (transcribe → classify → enrich → write to Notion) and verifies
  each stage works correctly.
---

# Test Pipeline

## Quick Smoke Test

Verify the bot is alive and responding:

```bash
# Check webhook is set
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo" | jq '.result | {url, pending_update_count, last_error_message}'
```

Then send a voice message to the bot. Expect a reply within 10 seconds.

## Stage-by-Stage Test

### 1. Transcription (Groq Whisper)

Test that audio → text works:
```bash
# Use a test audio file
curl -s https://api.groq.com/openai/v1/audio/transcriptions \
  -H "Authorization: Bearer ${GROQ_API_KEY}" \
  -F "model=whisper-large-v3-turbo" \
  -F "file=@test/fixtures/sample-action.ogg" \
  | jq .text
```

Expected: a clean transcript of the audio content.

### 2. Classification (Llama 3.3 70B via Groq)

Test that transcript → structured JSON works:
```bash
# Use the classifier prompt from prompts/classifier.md
# Send a known transcript and verify the output schema
```

Verify output contains:
- `type` is "action" or "idea"
- `title` is 5-7 words
- `body` is cleaned up (no filler words)
- `tags` is an array of 1-5 strings
- `priority` exists for actions
- `theme` exists for ideas

### 3. Notion Write

Test that structured JSON → Notion entry works:
```bash
# Verify entry exists in the correct database
# Check all properties are populated
```

## Test Fixtures

Keep sample audio files and expected outputs in `test/fixtures/`:

```
test/fixtures/
├── sample-action.ogg          # "Email Sarah about the deck before Thursday"
├── sample-action.expected.json # Expected classification output
├── sample-idea.ogg            # "What if onboarding was 3 questions instead of 20"
└── sample-idea.expected.json  # Expected classification output
```

## Regression Test

After changing the classification prompt:
1. Run all fixtures through the new prompt
2. Compare outputs against `.expected.json` files
3. Any change in `type` (action vs idea) is a regression — investigate before committing
