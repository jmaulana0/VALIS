import type { ClassifiedNote } from './classify';

interface NoteForObsidian extends ClassifiedNote {
  raw_transcript: string;
  telegram_timestamp: string;
}

export interface ObsidianSaveResult {
  /** Deep link that opens the note directly in the Obsidian app. */
  obsidianUri: string;
  /** HTTPS URL to the file on GitHub — reliable clickable fallback. */
  githubUrl: string;
}

/**
 * Save a classified note (action or idea) as a markdown file to the GitHub
 * sync repo. The sync script on the Mac moves it into the Obsidian vault's
 * `00 - Inbox/` on its next run.
 */
export async function saveToObsidian(note: NoteForObsidian): Promise<ObsidianSaveResult> {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_OBSIDIAN_REPO; // e.g. "jmaulana0/valis-obsidian-sync"

  if (!token || !repo) {
    throw new Error('Missing GITHUB_TOKEN or GITHUB_OBSIDIAN_REPO env vars');
  }

  const vaultName = process.env.OBSIDIAN_VAULT_NAME || 'Obsidian Vault';
  const vaultInboxPath = process.env.OBSIDIAN_VAULT_INBOX_PATH || '00 - Inbox';

  const date = note.telegram_timestamp.split('T')[0]; // YYYY-MM-DD
  const slug = note.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const filename = `${date}-${slug}.md`;

  const frontmatter = buildFrontmatter(note, date);

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
      message: `Add ${note.type}: ${note.title}`,
      content: encoded,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`GitHub API ${res.status}: ${errBody}`);
  }

  const data = await res.json() as { content: { html_url: string } };
  const githubUrl = data.content.html_url;

  // Path inside the vault, after sync-to-obsidian.sh moves the file from the
  // sync repo's `inbox/` into the vault's `00 - Inbox/`.
  const vaultPath = `${vaultInboxPath}/${filename}`;
  const obsidianUri = `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(vaultPath)}`;

  return { obsidianUri, githubUrl };
}

function buildFrontmatter(note: NoteForObsidian, date: string): string {
  const lines: string[] = ['---'];
  lines.push(`title: "${escapeYaml(note.title)}"`);
  lines.push(`tags: [${note.tags.map(t => `"${escapeYaml(t)}"`).join(', ')}]`);
  lines.push(`created: ${date}`);
  lines.push(`type: ${note.type}`);

  if (note.type === 'idea' && note.theme) {
    lines.push(`theme: "${escapeYaml(note.theme)}"`);
  }
  if (note.type === 'action' && note.priority) {
    lines.push(`priority: ${note.priority}`);
  }
  if (note.type === 'action' && note.due_hint) {
    lines.push(`due_hint: "${escapeYaml(note.due_hint)}"`);
  }

  lines.push('source: valis');
  lines.push('status: unprocessed');
  lines.push('---');
  return lines.join('\n');
}

function escapeYaml(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
