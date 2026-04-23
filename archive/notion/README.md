# Archived: Notion integration

This folder holds the Notion code paths that VALIS used before everything was consolidated to Obsidian. Nothing in here is imported or executed — it's kept for easy restoration.

## Why archived

VALIS originally split storage: **ideas → Obsidian, actions → Notion**. As of 2026-04-23 everything routes to Obsidian (single inbox). See `docs/decisions/` if an ADR was added.

## What's here

- `notion.ts` — Notion API writes (create pages, find-and-update, image blocks)
- `upload.ts` — Notion File Upload API (two-step create → send binary)

## How to restore

1. Move the files back:
   ```bash
   git mv archive/notion/notion.ts lib/notion.ts
   git mv archive/notion/upload.ts lib/upload.ts
   ```
2. Re-add the Notion env vars to `.env.example` and Vercel project env:
   - `NOTION_TOKEN`
   - `NOTION_ACTIONS_DB_ID`
   - `NOTION_IDEAS_DB_ID`
3. Re-import in `api/webhook.ts`:
   ```ts
   import { saveToNotion } from '../lib/notion';
   import { uploadImageToNotion } from '../lib/upload';
   ```
4. Reintroduce a routing branch in the webhook handler (e.g. `useNotion = isAction && !!imageBuffer`) and wire the Notion save/upload calls into it.

The Notion databases themselves were not touched — existing pages remain intact in Notion and can be read at any time from the Notion app.
