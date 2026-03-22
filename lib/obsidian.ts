import type { ClassifiedNote } from './classify';

interface NoteForObsidian extends ClassifiedNote {
  raw_transcript: string;
  telegram_timestamp: string;
}

/**
 * Save an idea as a markdown file to the GitHub sync repo.
 * The sync script on the Mac pulls these into the Obsidian vault's 00 - Inbox/.
 */
export async function saveToObsidian(note: NoteForObsidian): Promise<string> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_OBSIDIAN_REPO; // e.g. "jmaulana0/valis-obsidian-sync"

  if (!token || !repo) {
    throw new Error('Missing GITHUB_TOKEN or GITHUB_OBSIDIAN_REPO env vars');
  }

  const date = note.telegram_timestamp.split('T')[0]; // YYYY-MM-DD
  const slug = note.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const filename = `${date}-${slug}.md`;

  const frontmatter = [
    '---',
    `title: "${note.title}"`,
    `tags: [${note.tags.map(t => `"${t}"`).join(', ')}]`,
    `created: ${date}`,
    'type: idea',
    `theme: "${note.theme || 'Personal'}"`,
    'source: valis',
    'status: unprocessed',
    '---',
  ].join('\n');

  const body = [
    `# ${note.title}`,
    '',
    note.body,
    '',
    '---',
    '',
    '## Raw Transcript',
    '',
    note.raw_transcript,
  ].join('\n');

  const content = `${frontmatter}\n\n${body}\n`;
  const encoded = Buffer.from(content).toString('base64');

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/inbox/${filename}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json',
    },
    body: JSON.stringify({
      message: `Add idea: ${note.title}`,
      content: encoded,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`GitHub API ${res.status}: ${errBody}`);
  }

  const data = await res.json() as { content: { html_url: string } };
  return data.content.html_url;
}
