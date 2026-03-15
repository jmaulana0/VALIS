---
name: tune-classifier
description: |
  Review misclassified voice notes and improve the classification prompt.
  This is the self-improving skill — the classifier gets better over time
  based on real usage corrections. Use when classification accuracy drops
  or after reviewing a batch of entries in Notion.
---

# Tune Classifier

## The Self-Improvement Loop

```
  CAPTURE          CLASSIFY         STORE            CORRECT           LEARN
  ───────          ────────         ─────            ───────           ─────

  Voice note  ──▶  Gemini    ──▶   Notion DB   ──▶  User moves    ──▶  Update
  via Telegram     classifies       (Actions or      entry to           prompt
                   + enriches       Ideas)           other DB           and test
                                                     (= correction)
                                                          │
                                                          ▼
                                                     Log correction
                                                     in corrections.jsonl
```

## Step 1: Collect Corrections

Check Notion for entries that were manually moved between databases
(actions reclassified as ideas, or vice versa). These are the corrections.

For each correction, record in `prompts/corrections.jsonl`:
```json
{"transcript": "the original whisper text", "predicted": "action", "correct": "idea", "reason": "was brainstorming, not a task", "date": "2026-03-15"}
```

## Step 2: Analyze Patterns

Read `prompts/corrections.jsonl` and look for patterns:

- Are certain phrases consistently misclassified?
- Does the model confuse "we should..." (idea) with "I need to..." (action)?
- Are conditional statements ("if we...", "what if...") being tagged as actions?
- Are soft directives ("might want to look into...") correctly tagged as ideas?

## Step 3: Update the Prompt

Edit `prompts/classifier.md`:

1. Add specific rules for the patterns found in Step 2
2. Add 1-2 few-shot examples from real corrections (anonymize if needed)
3. **Do not remove existing rules** — only add or refine
4. Add a changelog entry at the bottom with the date and what changed

## Step 4: Regression Test

Test the updated prompt against ALL entries in `prompts/corrections.jsonl`:

```
For each correction:
  1. Send the transcript through the new prompt
  2. Check if `type` now matches `correct`
  3. Also test 5 previously-correct entries to ensure no regressions
```

Report:
- Corrections now fixed: X/Y
- Regressions introduced: Z (must be 0 before committing)

## Step 5: Commit

If regressions = 0 and at least 50% of corrections are fixed:
```bash
git add prompts/classifier.md prompts/corrections.jsonl
git commit -m "tune: improve classifier — fixed N/M corrections

Patterns addressed:
- [describe pattern 1]
- [describe pattern 2]

Tested against X corrections, 0 regressions."
```

## Prompt Versioning

Every change to `prompts/classifier.md` should include a version bump
in the changelog section at the bottom of that file:

```markdown
## Changelog
- v1.0 (2026-03-15): Initial prompt
- v1.1 (2026-03-22): Added rule for conditional statements ("what if..." = idea)
- v1.2 (2026-03-29): Added few-shot example for soft directives
```

## When to Run This Skill

- After your first 20 voice notes (initial calibration)
- Weekly, if you're actively using the bot
- Whenever you notice 3+ misclassifications in a row
