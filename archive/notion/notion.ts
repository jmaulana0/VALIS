import type { ClassifiedNote } from './classify';

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2026-03-11';

function notionHeaders() {
  return {
    'Authorization': `Bearer ${process.env.NOTION_TOKEN}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

// Cache database schemas per invocation
const schemaCache = new Map<string, Set<string>>();

async function getDatabaseSchema(databaseId: string): Promise<Set<string>> {
  if (schemaCache.has(databaseId)) {
    return schemaCache.get(databaseId)!;
  }
  try {
    const res = await fetch(`${NOTION_API}/databases/${databaseId}`, {
      headers: notionHeaders(),
    });
    if (!res.ok) {
      console.error('Schema fetch failed:', await res.text());
      return new Set<string>();
    }
    const db = await res.json() as { properties: Record<string, unknown> };
    const props = new Set(Object.keys(db.properties));
    schemaCache.set(databaseId, props);
    return props;
  } catch (err) {
    console.error('Failed to retrieve database schema:', err);
    return new Set<string>();
  }
}

function trySetProperty(
  schema: Set<string>,
  properties: Record<string, unknown>,
  name: string,
  value: unknown,
): void {
  if (schema.size === 0) return;
  if (schema.has(name)) {
    properties[name] = value;
  }
}

interface NoteToSave extends ClassifiedNote {
  raw_transcript: string;
  telegram_timestamp: string;
  image_file_upload_id?: string;
}

export async function saveToNotion(note: NoteToSave): Promise<string> {
  // If intent is update, search for existing page and append
  if (note.intent === 'update' && note.search_query) {
    const result = await findAndUpdate(note);
    if (result) return result;
    // If no match found, fall through to create
  }

  if (note.type === 'action') {
    return saveAction(note);
  } else {
    return saveIdea(note);
  }
}

/** Search both databases for a page matching the query, append content if found */
async function findAndUpdate(note: NoteToSave): Promise<string | null> {
  const dbIds = [
    process.env.NOTION_ACTIONS_DB_ID!,
    process.env.NOTION_IDEAS_DB_ID!,
  ];

  for (const dbId of dbIds) {
    const pageId = await searchDatabase(dbId, note.search_query!);
    if (pageId) {
      await appendToPage(pageId, note);
      // Return the page URL
      return `https://notion.so/${pageId.replace(/-/g, '')}`;
    }
  }

  return null; // No match found
}

/** Search a single database for pages matching the query */
async function searchDatabase(databaseId: string, query: string): Promise<string | null> {
  // Search using Notion's database query with title filter
  // We split the query into words and search for the most specific term
  const res = await fetch(`${NOTION_API}/databases/${databaseId}/query`, {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify({
      filter: {
        property: 'Name',
        title: {
          contains: query.split(' ')[0], // Use first keyword
        },
      },
      page_size: 10,
    }),
  });

  if (!res.ok) {
    console.error('Database search failed:', await res.text());
    return null;
  }

  interface NotionPage {
    id: string;
    properties: {
      Name: {
        title: Array<{ plain_text: string }>;
      };
    };
  }

  const data = await res.json() as { results: NotionPage[] };

  if (data.results.length === 0) return null;

  // Score results by how many query words appear in the title
  const queryWords = query.toLowerCase().split(/\s+/);
  let bestMatch: NotionPage | null = null;
  let bestScore = 0;

  for (const page of data.results) {
    const title = page.properties.Name?.title
      ?.map((t) => t.plain_text)
      .join('')
      .toLowerCase() || '';

    const score = queryWords.filter((w) => title.includes(w)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = page;
    }
  }

  // Require at least 1 word match
  return bestScore >= 1 ? bestMatch!.id : null;
}

/** Append content blocks to an existing page */
async function appendToPage(pageId: string, note: NoteToSave): Promise<void> {
  const blocks: unknown[] = [
    {
      object: 'block',
      type: 'divider',
      divider: {},
    },
    {
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [{ type: 'text', text: { content: `Update — ${note.title}` } }],
      },
    },
    ...textBlocks(note.body),
  ];

  if (note.image_file_upload_id) {
    blocks.push(imageBlock(note.image_file_upload_id));
  }

  blocks.push({
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{
        type: 'text',
        text: { content: `Added: ${note.telegram_timestamp}` },
        annotations: { italic: true, color: 'gray' },
      }],
    },
  });

  const res = await fetch(`${NOTION_API}/blocks/${pageId}/children`, {
    method: 'PATCH',
    headers: notionHeaders(),
    body: JSON.stringify({ children: blocks }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Notion append failed ${res.status}: ${errBody}`);
  }
}

async function createPage(
  databaseId: string,
  properties: Record<string, unknown>,
  children: unknown[],
): Promise<string> {
  const res = await fetch(`${NOTION_API}/pages`, {
    method: 'POST',
    headers: notionHeaders(),
    body: JSON.stringify({
      parent: { database_id: databaseId },
      properties,
      children,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Notion API ${res.status}: ${errBody}`);
  }

  const data = await res.json() as { url: string };
  return data.url;
}

/** Split text into Notion-safe chunks (max 2000 chars each) */
function textBlocks(content: string): unknown[] {
  const chunks: unknown[] = [];
  for (let i = 0; i < content.length; i += 2000) {
    chunks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: content.slice(i, i + 2000) } }],
      },
    });
  }
  return chunks;
}

function imageBlock(fileUploadId: string): unknown {
  return {
    object: 'block',
    type: 'image',
    image: {
      type: 'file_upload',
      file_upload: { id: fileUploadId },
    },
  };
}

function makeBodyBlocks(note: NoteToSave, metaLines: string[]) {
  const blocks: unknown[] = [
    ...textBlocks(metaLines.join('\n')),
  ];

  // Add screenshot if present
  if (note.image_file_upload_id) {
    blocks.push(
      {
        object: 'block',
        type: 'heading_3',
        heading_3: {
          rich_text: [{ type: 'text', text: { content: 'Screenshot' } }],
        },
      },
      imageBlock(note.image_file_upload_id),
    );
  }

  blocks.push(
    {
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [{ type: 'text', text: { content: 'Body' } }],
      },
    },
    ...textBlocks(note.body),
    {
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [{ type: 'text', text: { content: 'Raw Transcript' } }],
      },
    },
    ...textBlocks(note.raw_transcript),
  );

  return blocks;
}

async function saveAction(note: NoteToSave): Promise<string> {
  const properties: Record<string, unknown> = {
    Name: { title: [{ text: { content: note.title } }] },
  };

  const dbId = process.env.NOTION_ACTIONS_DB_ID!;
  const schema = await getDatabaseSchema(dbId);

  trySetProperty(schema, properties, 'Status', { select: { name: 'To Do' } });
  trySetProperty(schema, properties, 'Tags', {
    multi_select: note.tags.map((tag) => ({ name: tag })),
  });
  trySetProperty(schema, properties, 'Telegram Timestamp', {
    date: { start: note.telegram_timestamp },
  });
  if (note.priority) {
    trySetProperty(schema, properties, 'Priority', {
      select: { name: capitalize(note.priority) },
    });
  }
  if (note.due_hint) {
    trySetProperty(schema, properties, 'Due Hint', {
      rich_text: [{ text: { content: note.due_hint } }],
    });
  }

  const metaLines: string[] = [];
  if (note.priority) metaLines.push(`Priority: ${capitalize(note.priority)}`);
  if (note.due_hint) metaLines.push(`Due: ${note.due_hint}`);
  if (note.tags.length) metaLines.push(`Tags: ${note.tags.map(t => `#${t}`).join(' ')}`);
  metaLines.push(`Captured: ${note.telegram_timestamp}`);

  return createPage(dbId, properties, makeBodyBlocks(note, metaLines));
}

async function saveIdea(note: NoteToSave): Promise<string> {
  const properties: Record<string, unknown> = {
    Name: { title: [{ text: { content: note.title } }] },
  };

  const dbId = process.env.NOTION_IDEAS_DB_ID!;
  const schema = await getDatabaseSchema(dbId);

  trySetProperty(schema, properties, 'Status', { select: { name: 'Raw' } });
  trySetProperty(schema, properties, 'Tags', {
    multi_select: note.tags.map((tag) => ({ name: tag })),
  });
  trySetProperty(schema, properties, 'Telegram Timestamp', {
    date: { start: note.telegram_timestamp },
  });
  if (note.theme) {
    trySetProperty(schema, properties, 'Theme', { select: { name: note.theme } });
  }

  const metaLines: string[] = [];
  if (note.theme) metaLines.push(`Theme: ${note.theme}`);
  if (note.tags.length) metaLines.push(`Tags: ${note.tags.map(t => `#${t}`).join(' ')}`);
  metaLines.push(`Captured: ${note.telegram_timestamp}`);

  return createPage(dbId, properties, makeBodyBlocks(note, metaLines));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
