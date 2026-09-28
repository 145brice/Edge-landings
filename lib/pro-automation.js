const crypto = require('crypto');

function clean(value, max = 5000) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function validPhone(value) { return /^\+[1-9]\d{7,14}$/.test(String(value || '')); }
function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function webhookAllowed(req) {
  const supplied = clean(req.headers.authorization, 500).replace(/^Bearer\s+/i, '') || clean(req.headers['x-edge-webhook'], 500);
  return Boolean(process.env.PRO_AUTOMATION_WEBHOOK_SECRET && safeEqual(supplied, process.env.PRO_AUTOMATION_WEBHOOK_SECRET));
}
function twilioSignature(url, params, authToken) {
  const payload = Object.keys(params || {}).sort().reduce((value, key) => `${value}${key}${params[key]}`, url);
  return crypto.createHmac('sha1', authToken).update(payload).digest('base64');
}
function validTwilioRequest(req, url) {
  if (!process.env.TWILIO_AUTH_TOKEN) return false;
  return safeEqual(req.headers['x-twilio-signature'], twilioSignature(url, req.body || {}, process.env.TWILIO_AUTH_TOKEN));
}
function reviewInstructions(settings) {
  const voice = clean(settings.review_voice_notes, 800);
  return `You are the review-reply assistant for ${settings.business_name}, a ${settings.business_type} in ${settings.city}. Write a reply in the owner's voice: warm, professional, never defensive, never mentioning competitors. Positive reviews: thank them by name and mention one specific detail. Negative reviews: apologize sincerely, offer to make it right, invite them to call directly. Use no more than three sentences. Never promise refunds or discounts. Output only the reply text.${voice ? ` Additional owner voice notes: ${voice}` : ''}`;
}
async function draftReviewReply(input, settings, fetchImpl = fetch) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured.');
  const response = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST', signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_REVIEW_MODEL || 'gpt-6-astra',
      instructions: reviewInstructions(settings),
      input: `Reviewer: ${input.reviewerName}\nRating: ${input.starRating}/5\nReview: ${input.reviewText}`,
      max_output_tokens: 180,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI review draft failed (${response.status}).`);
  const result = await response.json();
  const text = clean(result.output_text || result.output?.flatMap((item) => item.content || []).find((item) => item.type === 'output_text')?.text, 1500);
  if (!text) throw new Error('OpenAI returned an empty review draft.');
  return { text, responseId: clean(result.id, 200), model: clean(result.model, 100) };
}
async function sendText({ to, from: requestedFrom, body }, fetchImpl = fetch) {
  const sid = clean(process.env.TWILIO_ACCOUNT_SID, 100);
  const token = clean(process.env.TWILIO_AUTH_TOKEN, 200);
  const from = clean(requestedFrom || process.env.TWILIO_FROM_NUMBER, 30);
  if (!sid || !token || !validPhone(from)) throw new Error('Twilio sending is not configured.');
  if (!validPhone(to)) throw new Error('The recipient phone must use E.164 format.');
  const form = new URLSearchParams({ To: to, From: from, Body: clean(body, 1500) });
  const response = await fetchImpl(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  if (!response.ok) throw new Error(`Twilio message failed (${response.status}).`);
  const result = await response.json();
  return clean(result.sid, 100);
}

module.exports = { clean, validPhone, safeEqual, webhookAllowed, twilioSignature, validTwilioRequest, reviewInstructions, draftReviewReply, sendText };
