const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

/** Resolve a Telegram file_id to a downloadable URL */
export async function getFileUrl(fileId: string): Promise<string> {
  const fileRes = await fetch(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
  if (!fileRes.ok) throw new Error(`Telegram getFile failed: ${fileRes.status}`);
  const fileData = await fileRes.json() as { result: { file_path: string } };
  return `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileData.result.file_path}`;
}

/** Download any Telegram file by file_id as a Buffer */
export async function downloadFile(fileId: string): Promise<Buffer> {
  const url = await getFileUrl(fileId);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Telegram file download failed: ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function downloadVoiceFile(fileId: string): Promise<Buffer> {
  return downloadFile(fileId);
}

export async function sendMessage(
  chatId: number,
  text: string,
  options: { parse_mode?: 'Markdown' | 'HTML' } = {}
): Promise<void> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    ...options,
  };

  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('sendMessage failed:', err);
  }
}
