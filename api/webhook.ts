import type { VercelRequest, VercelResponse } from '@vercel/node';
import { downloadVoiceFile, downloadFile, sendMessage } from '../lib/telegram';

import { transcribe } from '../lib/transcribe';
import { classify } from '../lib/classify';
import { saveToNotion } from '../lib/notion';
import { uploadImageToNotion } from '../lib/upload';

// Telegram update types
interface TelegramVoice {
  file_id: string;
  duration: number;
}

interface TelegramAudio {
  file_id: string;
  duration: number;
  mime_type?: string;
  file_name?: string;
}

interface TelegramDocument {
  file_id: string;
  mime_type?: string;
  file_name?: string;
}

interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
}

interface TelegramMessage {
  chat: { id: number };
  date: number;
  text?: string;
  caption?: string;
  voice?: TelegramVoice;
  audio?: TelegramAudio;
  document?: TelegramDocument;
  photo?: TelegramPhotoSize[];
}

interface TelegramUpdate {
  message?: TelegramMessage;
}

/**
 * Extract the audio file_id from a message, handling voice messages,
 * audio files (.m4a, .mp3, etc.), and audio documents.
 */
function getAudioFileId(message: TelegramMessage): string | null {
  // Voice messages (recorded in Telegram)
  if (message.voice) {
    if (message.voice.duration < 1) return null;
    return message.voice.file_id;
  }

  // Audio files sent as attachments (.m4a, .mp3, .wav, etc.)
  if (message.audio) {
    return message.audio.file_id;
  }

  // Documents that are audio files
  if (message.document?.mime_type?.startsWith('audio/')) {
    return message.document.file_id;
  }

  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify webhook secret
  const secret = req.headers['x-telegram-bot-api-secret-token'];
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const update = req.body as TelegramUpdate;
  const message = update?.message;
  if (!message) {
    return res.status(200).json({ ok: true });
  }

  const chatId = message.chat.id;
  const audioFileId = getAudioFileId(message);
  const hasPhoto = message.photo && message.photo.length > 0;
  const textInput = message.text || message.caption;

  // No audio, no photo, and no text — nothing to process
  if (!audioFileId && !hasPhoto && !textInput) {
    await sendMessage(chatId, 'Send me a voice message, audio file, photo, or text and I\'ll sort it for you.');
    return res.status(200).json({ ok: true });
  }

  // Skip commands like /start, /setdescription
  if (textInput?.startsWith('/')) {
    return res.status(200).json({ ok: true });
  }

  try {
    let transcript: string;
    let notionFileUploadId: string | undefined;

    // ── Upload photo to Notion if present ──────────────────────────────────
    if (hasPhoto) {
      const largestPhoto = message.photo![message.photo!.length - 1];
      try {
        const imageBuffer = await downloadFile(largestPhoto.file_id);
        notionFileUploadId = await uploadImageToNotion(imageBuffer, 'screenshot.jpg');
      } catch (err) {
        const uploadErr = err instanceof Error ? err.message : String(err);
        console.error('Image upload failed:', uploadErr);
        await sendMessage(chatId, `⚠️ Image upload issue: ${uploadErr}\nContinuing without screenshot...`);
      }
    }

    if (audioFileId) {
      // ── Audio path: Download + Transcribe ─────────────────────────────────
      const audioBuffer = await downloadVoiceFile(audioFileId);

      try {
        transcript = await transcribe(audioBuffer);
      } catch {
        try {
          transcript = await transcribe(audioBuffer);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error('Transcription failed twice:', errMsg);
          await sendMessage(chatId, `⚠️ Couldn't transcribe: ${errMsg}`);
          return res.status(200).json({ ok: true });
        }
      }
    } else if (textInput) {
      // ── Text/caption path ─────────────────────────────────────────────────
      transcript = textInput;
    } else {
      // ── Photo-only (no caption): save as unclassified screenshot ──────────
      transcript = '(screenshot with no caption)';
    }

    // ── Step 3: Classify + enrich (with one retry) ─────────────────────────
    let classified;
    try {
      classified = await classify(transcript);
    } catch {
      try {
        classified = await classify(transcript);
      } catch (err) {
        const classErr = err instanceof Error ? err.message : String(err);
        console.error('Classification failed twice:', classErr);
        // Fallback: save raw transcript as an unclassified idea
        try {
          await saveToNotion({
            intent: 'create',
            type: 'idea',
            title: hasPhoto ? 'Unclassified screenshot' : 'Unclassified voice note',
            body: transcript,
            tags: ['unclassified'],
            theme: 'Personal',
            raw_transcript: transcript,
            telegram_timestamp: new Date(message.date * 1000).toISOString(),
            image_file_upload_id: notionFileUploadId,
          });
        } catch { /* best-effort */ }
        await sendMessage(chatId, `⚠️ Saved but couldn't classify: ${classErr}\nCheck your Ideas board.`);
        return res.status(200).json({ ok: true });
      }
    }

    // ── Step 4: Save to Notion (with one retry) ────────────────────────────
    const noteToSave = {
      ...classified,
      raw_transcript: transcript,
      telegram_timestamp: new Date(message.date * 1000).toISOString(),
      image_file_upload_id: notionFileUploadId,
    };

    let notionUrl: string;
    try {
      notionUrl = await saveToNotion(noteToSave);
    } catch {
      try {
        notionUrl = await saveToNotion(noteToSave);
      } catch (err) {
        const notionErr = err instanceof Error ? err.message : String(err);
        console.error('Notion save failed twice:', notionErr);
        await sendMessage(
          chatId,
          `⚠️ Notion error: ${notionErr}\n\`\`\`\n${JSON.stringify(classified, null, 2)}\n\`\`\``
        );
        return res.status(200).json({ ok: true });
      }
    }

    // ── Step 5: Reply with confirmation ────────────────────────────────────
    const isAction = classified.type === 'action';
    const isUpdate = classified.intent === 'update';
    const emoji = isUpdate ? '📝' : (isAction ? '✅' : '💡');
    const label = isUpdate
      ? (isAction ? 'Action updated' : 'Idea updated')
      : (isAction ? 'Action saved' : 'Idea saved');

    let reply = `${emoji} *${label}*\n*${classified.title}*\n`;

    if (isAction) {
      if (classified.priority) {
        reply += `Priority: ${capitalize(classified.priority)}\n`;
      }
      if (classified.due_hint) {
        reply += `Due: ${classified.due_hint}\n`;
      }
    } else {
      if (classified.theme) {
        reply += `Theme: ${classified.theme}\n`;
      }
    }

    if (classified.tags?.length) {
      reply += classified.tags.map((t) => `#${t}`).join(' ') + '\n';
    }

    if (notionFileUploadId) {
      reply += '📎 Screenshot attached\n';
    }

    reply += `\n[Open in Notion](${notionUrl})`;

    await sendMessage(chatId, reply, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Unexpected error in webhook handler:', err);
    await sendMessage(chatId, '⚠️ Something went wrong. Try again.');
  }

  return res.status(200).json({ ok: true });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
