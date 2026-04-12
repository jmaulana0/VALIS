---
name: deploy
description: |
  Deploy VALIS to Vercel, set the Telegram webhook, and verify the bot is healthy.
  Use when you've made changes and want to ship them.
---

# Deploy VALIS

## Steps

1. **Check for uncommitted changes**
```bash
git status
```
If there are uncommitted changes, commit them first.

2. **Deploy to Vercel**
```bash
vercel --prod
```
Note the production URL from the output.

3. **Set the Telegram webhook**
```bash
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook?url=https://${VERCEL_URL}/api/webhook&secret_token=${TELEGRAM_WEBHOOK_SECRET}" | jq .
```
Verify the response contains `"ok": true`.

4. **Health check — send a test voice message**
Send a voice message to the bot in Telegram. Verify:
- Bot replies within 10 seconds
- Classification is correct (action or idea)
- Entry appears in the correct Notion database

5. **Check Vercel logs for errors**
```bash
vercel logs --follow
```

## Rollback

If the deploy breaks:
```bash
vercel rollback
```
Then re-set the webhook to the previous URL.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Bot doesn't reply | Webhook URL wrong | Re-run step 3 with correct URL |
| "Unauthorized" in logs | Bad TELEGRAM_BOT_TOKEN | Check env vars in Vercel dashboard |
| Transcription fails | Groq API key issue | Verify GROQ_API_KEY in Vercel env |
| Classification fails | Groq API key issue | Verify GROQ_API_KEY in Vercel env |
| Notion write fails | Bad database ID or token | Check NOTION_TOKEN and DB IDs |
