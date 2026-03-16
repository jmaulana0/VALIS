export async function transcribe(audioBuffer: Buffer): Promise<string> {
  // Use fetch + FormData directly for maximum compatibility in serverless
  const formData = new FormData();
  formData.append('file', new Blob([audioBuffer], { type: 'audio/ogg' }), 'voice.ogg');
  formData.append('model', 'whisper-large-v3-turbo');
  formData.append('response_format', 'text');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: formData,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Groq API ${res.status}: ${errBody}`);
  }

  const text = await res.text();
  if (!text || text.trim().length === 0) {
    throw new Error('Empty transcript returned from Whisper');
  }

  return text.trim();
}
