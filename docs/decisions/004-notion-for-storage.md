# ADR-004: Personal Notion Workspace for Storage

**Status:** Accepted
**Date:** 2026-03-15

## Context

Need a place to store classified voice notes (actions and ideas).
User already uses Notion for business wiki. Ideas are currently scattered
across Microsoft OneNote sections.

## Options Considered

| Option | Cost | Has API | Kanban | Synthesis features |
|---|---|---|---|---|
| Notion (personal workspace) | Free | Yes | Yes | Relations, views, filters |
| Obsidian | Free | No native API | Plugins | Backlinks, graph view |
| Todoist | Free tier | Yes | Yes (premium) | Projects, labels |
| Linear | Free tier | Yes | Yes | Cycles, roadmaps |
| Custom DB (Postgres/Supabase) | Free tier | N/A | No — need UI | Full control |

## Decision

Notion, in a dedicated personal workspace (separate from business).

## Rationale

- Already known tool — zero learning curve
- Personal workspace is free and isolated from business Notion
- Database views (Kanban for actions, Table for ideas) provide the UI for free
- Relation property enables cross-linking ideas for future synthesis
- Status property (Raw → Developing → Published) models the idea maturity workflow
- No separate UI, database, or admin panel to build

Two databases (Actions DB + Ideas DB) rather than one:
- Actions need Kanban (To Do / In Progress / Done)
- Ideas need Table grouped by Theme
- Mixing them degrades both views

## Consequences

- Dependent on Notion API stability and rate limits
- Cannot do full-text search across entries via API (Notion search API is limited)
- Moving entries between databases (for corrections) is a delete + recreate operation
- Synthesis (combining related ideas) must be done manually in Notion for MVP
