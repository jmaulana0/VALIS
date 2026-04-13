# Contributing to VALIS

Thanks for your interest in contributing! VALIS is a small, focused project and contributions are welcome.

## Getting Started

1. Fork the repo and clone your fork
2. `npm install`
3. Copy `.env.example` to `.env` and fill in your API keys (see [README](README.md#setup))
4. `npm run dev` to start the local dev server

## Making Changes

- **One PR per change.** Keep PRs focused on a single fix or feature.
- **Match the existing style.** No linter is enforced yet — just follow what's already there.
- **Test your changes.** Send a voice message to the bot and confirm the full pipeline works (transcribe, classify, route, reply).

## What to Work On

Check [Issues](https://github.com/jmaulana0/VALIS/issues) for open tasks. Good first contributions:

- Bug reports with reproduction steps
- Improvements to the classification prompt (`prompts/classifier.md`)
- Support for additional input types (links, documents)
- Better error messages

## Architecture

VALIS is intentionally simple: one Vercel serverless function, three API calls, no database. Before proposing structural changes, read [docs/architecture.md](docs/architecture.md) to understand what's intentionally not here and why.

## Classification Prompt Changes

The classifier prompt is the most sensitive file in the repo. Changes to `prompts/classifier.md` or `lib/classify.ts` must:

1. Document what changed and why
2. Test against a mix of action and idea transcripts
3. Show no regressions on previously-correct classifications

## Reporting Bugs

Open an issue with:
- What you sent to the bot (voice, text, photo)
- What the bot replied
- What you expected instead
- Vercel function logs if available
