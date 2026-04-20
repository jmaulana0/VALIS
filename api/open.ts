import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Redirect bridge for custom URL schemes that Telegram's Markdown parser
 * strips from inline links (e.g. `obsidian://`). The Telegram bot sends an
 * `https://.../api/open?to=obsidian%3A%2F%2F...` link; tapping it opens the
 * browser which then redirects into the native app handler.
 *
 * Query params:
 *   to     — full target URI (must start with `obsidian://`)
 *   — or —
 *   vault  — Obsidian vault name (falls back to OBSIDIAN_VAULT_NAME env var)
 *   file   — vault-relative path to the note
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  const target = buildTarget(req);
  if (!target) {
    return res.status(400).send('Missing or invalid `to` / `vault`+`file` params.');
  }

  // Some mobile browsers block a bare 302 to a non-http(s) scheme. An HTML
  // page with a meta refresh + JS fallback + visible link works everywhere.
  const safe = escapeHtml(target);
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Opening Obsidian…</title>
  <meta http-equiv="refresh" content="0;url=${safe}">
  <script>window.location.replace(${JSON.stringify(target)});</script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
           display: grid; place-items: center; min-height: 100vh; margin: 0;
           color: #333; }
    a { color: #7c3aed; font-weight: 600; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <p>Opening <a href="${safe}">this note in Obsidian</a>…</p>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(html);
}

function buildTarget(req: VercelRequest): string | null {
  const to = typeof req.query.to === 'string' ? req.query.to : '';
  if (to) {
    return to.startsWith('obsidian://') ? to : null;
  }

  const file = typeof req.query.file === 'string' ? req.query.file : '';
  if (!file) return null;

  const vault = typeof req.query.vault === 'string' && req.query.vault
    ? req.query.vault
    : (process.env.OBSIDIAN_VAULT_NAME || 'Obsidian Vault');

  return `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(file)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
