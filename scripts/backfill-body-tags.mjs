#!/usr/bin/env node
// backfill-body-tags.mjs — Insert an inline #tag pill line under the H1 of
// every VALIS-shaped note that has YAML frontmatter tags but no body tags yet.
//
// Usage:
//   node scripts/backfill-body-tags.mjs --dry-run
//   node scripts/backfill-body-tags.mjs
//   node scripts/backfill-body-tags.mjs --dir "/path/to/inbox"
//
// Default dir: ~/Documents/Obsidian/00 - Inbox/inbox
//
// Safety:
//   - Skips files without YAML frontmatter.
//   - Skips files whose YAML has no tags (or empty tags).
//   - Skips files that already have a tag line right after the H1.
//   - --dry-run prints diffs but writes nothing.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const dirArg = args.indexOf('--dir');
const dir = dirArg !== -1
  ? args[dirArg + 1]
  : `${process.env.HOME}/Documents/Obsidian/00 - Inbox/inbox`;

function extractTags(frontmatter) {
  const m = frontmatter.match(/^tags:\s*\[([^\]]*)\]/m);
  if (!m) return [];
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

function alreadyHasBodyTagLine(body) {
  // Look at the first few non-empty lines after the H1
  const lines = body.split('\n');
  let seenH1 = false;
  for (const line of lines) {
    if (!seenH1) {
      if (line.startsWith('# ')) seenH1 = true;
      continue;
    }
    if (line.trim() === '') continue;
    // First non-empty line after H1 — is it a tag line?
    return /^#[\w-]+(\s+#[\w-]+)*\s*$/.test(line.trim());
  }
  return false;
}

function injectTagLine(content, tags) {
  const tagLine = tags.map((t) => `#${t}`).join(' ');
  // Insert a blank line + tag line immediately after the first H1
  return content.replace(/^(# [^\n]+)\n/m, `$1\n\n${tagLine}\n`);
}

const FM_RE = /^---\n([\s\S]*?)\n---\n/;

let changed = 0;
let skippedNoFm = 0;
let skippedNoTags = 0;
let skippedHasTagLine = 0;

const files = readdirSync(dir).filter((f) => f.endsWith('.md'));

for (const file of files) {
  const path = join(dir, file);
  const original = readFileSync(path, 'utf8');

  const fmMatch = original.match(FM_RE);
  if (!fmMatch) {
    skippedNoFm++;
    continue;
  }

  const tags = extractTags(fmMatch[1]);
  if (tags.length === 0) {
    skippedNoTags++;
    continue;
  }

  const body = original.slice(fmMatch[0].length);
  if (alreadyHasBodyTagLine(body)) {
    skippedHasTagLine++;
    continue;
  }

  const updated = original.slice(0, fmMatch[0].length) + injectTagLine(body, tags);

  if (dryRun) {
    console.log(`\n--- ${file} ---`);
    console.log(`  tags: ${tags.join(', ')}`);
    // Print the old→new snippet around the H1
    const oldSnippet = body.split('\n').slice(0, 5).join('\n');
    const newSnippet = injectTagLine(body, tags).split('\n').slice(0, 5).join('\n');
    console.log('  BEFORE:');
    console.log(oldSnippet.split('\n').map((l) => `    ${l}`).join('\n'));
    console.log('  AFTER:');
    console.log(newSnippet.split('\n').map((l) => `    ${l}`).join('\n'));
  } else {
    writeFileSync(path, updated);
  }

  changed++;
}

console.log(`\n${dryRun ? '[DRY RUN] ' : ''}Would modify ${changed} file(s).`);
console.log(`Skipped: ${skippedNoFm} no-frontmatter, ${skippedNoTags} no-tags, ${skippedHasTagLine} already-has-tag-line.`);
if (dryRun) console.log('\nRun without --dry-run to apply.');
