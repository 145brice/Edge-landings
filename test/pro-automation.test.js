const test = require('node:test');
const assert = require('node:assert/strict');
const { reviewInstructions, twilioSignature, validTwilioRequest, draftReviewReply, validPhone } = require('../lib/pro-automation');

test('review instructions use the client identity and preserve approval-safe rules', () => {
  const prompt = reviewInstructions({ business_name: 'Harbor Home Services', business_type: 'contractor', city: 'Nashville', review_voice_notes: 'Friendly and direct.' });
  assert.match(prompt, /Harbor Home Services/);
  assert.match(prompt, /contractor in Nashville/);
  assert.match(prompt, /never defensive/);
  assert.match(prompt, /Never promise refunds or discounts/);
  assert.match(prompt, /Friendly and direct/);
});

test('Twilio webhook signatures are deterministic and timing-safe validated', () => {
  const prior = process.env.TWILIO_AUTH_TOKEN;
  process.env.TWILIO_AUTH_TOKEN = 'test_auth_token';
  const url = 'https://www.edgelandings.com/api/missed-call';
  const body = { CallSid: 'CA123', CallStatus: 'no-answer', From: '+16155550100', To: '+16155550200' };
  const signature = twilioSignature(url, body, process.env.TWILIO_AUTH_TOKEN);
  assert.equal(validTwilioRequest({ headers: { 'x-twilio-signature': signature }, body }, url), true);
  assert.equal(validTwilioRequest({ headers: { 'x-twilio-signature': 'wrong' }, body }, url), false);
  if (prior === undefined) delete process.env.TWILIO_AUTH_TOKEN; else process.env.TWILIO_AUTH_TOKEN = prior;
});

test('review drafting uses the Responses API and returns only generated text', async () => {
  const prior = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ id: 'resp_123', model: 'gpt-6-astra', output_text: 'Thanks, Jordan. We appreciate you mentioning the clean same-day repair.' }) };
  };
  const result = await draftReviewReply({ reviewerName: 'Jordan', starRating: 5, reviewText: 'Clean repair completed the same day.' }, { business_name: 'Harbor', business_type: 'contractor', city: 'Nashville' }, fetchImpl);
  assert.equal(request.url, 'https://api.openai.com/v1/responses');
  assert.equal(request.body.model, 'gpt-6-astra');
  assert.match(request.body.input, /Rating: 5\/5/);
  assert.equal(result.responseId, 'resp_123');
  assert.match(result.text, /Thanks, Jordan/);
  if (prior === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = prior;
});

test('outbound text numbers require E.164 format', () => {
  assert.equal(validPhone('+16155551212'), true);
  assert.equal(validPhone('(615) 555-1212'), false);
});
