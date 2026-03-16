const MODEL = 'llama-3.3-70b-versatile';

const SYSTEM_PROMPT = `You are a voice note classifier. Given a transcript of a voice note or text message, determine:
1. Whether this is a NEW entry or an UPDATE to an existing entry
2. Whether it is an ACTION (something to do) or an IDEA (something to think about)

Respond with JSON only. No markdown. No explanation.

Schema:
{
  "intent": "create" | "update",
  "search_query": "string (only if intent=update — keywords to find the existing entry)",
  "type": "action" | "idea",
  "title": "5-7 word summary",
  "body": "cleaned up version of the transcript, fixing filler words and false starts but preserving meaning and voice",
  "tags": ["lowercase-tag"],
  "priority": "high" | "medium" | "low",
  "due_hint": "string or null",
  "theme": "string"
}

Rules:
- intent: Required. "create" for new entries. "update" when the speaker explicitly references an existing note/ticket/entry and wants to add to it, modify it, or append context. Look for phrases like "add to", "update the", "find the ticket about", "on that note about", "append to".
- search_query: Required when intent=update. Extract 2-5 keywords that would match the existing entry's title. Omit for create.
- type: Required. "action" or "idea".
- title: Required. Crisp, scannable, not a sentence. 5-7 words max. For updates, this is the title of the NEW content being added.
- body: Required. Remove "um", "uh", "like", false starts. Preserve meaning and voice. For updates, this is the content to append — do NOT include the instruction to find/update, just the actual content.
- tags: Required. 1-5 lowercase tags. Prefer recurring tags over one-off.
- priority: Actions only. "high" = has a deadline or blocks something. "medium" = should do this week. "low" = whenever. Omit for ideas.
- due_hint: Actions only. Extract from speech if mentioned ("before Thursday", "by end of month"). Null if no deadline mentioned. Omit for ideas.
- theme: Ideas only. One of: Product | Content | Strategy | Operations | Personal. Omit for actions.

Classification rules:
ACTION if the speaker says to DO something specific, mentions contacting someone, describes something to send/build/fix/buy/ship, or uses imperative framing ("need to", "have to", "should do").
IDEA if the speaker is thinking out loud, exploring a concept, brainstorming, reflecting on a pattern, or describing something to consider or develop further.
When ambiguous, classify as IDEA. Ideas are cheaper to ignore than missed actions.`;

export interface ClassifiedNote {
  intent: 'create' | 'update';
  search_query?: string;
  type: 'action' | 'idea';
  title: string;
  body: string;
  tags: string[];
  priority?: 'high' | 'medium' | 'low';
  due_hint?: string | null;
  theme?: string;
}

export async function classify(transcript: string): Promise<ClassifiedNote> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: transcript },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Groq API ${res.status}: ${errBody}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const text = data.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error('Empty response from Groq classification');
  }

  const json = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  let parsed: ClassifiedNote;
  try {
    parsed = JSON.parse(json) as ClassifiedNote;
  } catch {
    throw new Error(`Classifier returned non-JSON: ${text}`);
  }

  if (!parsed.type || !parsed.title || !parsed.body || !parsed.tags) {
    throw new Error(`Classifier response missing required fields: ${json}`);
  }

  // Default intent to create if not specified
  if (!parsed.intent) {
    parsed.intent = 'create';
  }

  return parsed;
}
