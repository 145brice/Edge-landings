const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');

test('contact confirms provider acceptance and reports provider failure', async () => {
  const request = global.fetch;
  const keys = ['OWNER_EMAIL', 'EMAIL_API_KEY', 'EMAIL_FROM'];
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { OWNER_EMAIL: 'owner@example.test', EMAIL_API_KEY: 'test-key', EMAIL_FROM: 'Edge Landings <hello@example.test>' });
  let providerStatus = 503;
  let delivered;
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    delivered = JSON.parse(options.body);
    return new Response('{}', { status: providerStatus });
  };
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const send = () => request(`http://127.0.0.1:${server.address().port}/api/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Customer', email: 'customer@example.test', message: 'I need a website.' }) });
    const failed = await send();
    assert.equal(failed.status, 502);
    assert.ok((await failed.json()).error);
    providerStatus = 200;
    const accepted = await send();
    assert.equal(accepted.status, 200);
    assert.equal((await accepted.json()).success, true);
    assert.equal(delivered.to, 'owner@example.test');
    assert.equal(delivered.reply_to, 'customer@example.test');
    assert.match(delivered.text, /I need a website/);
  } finally {
    global.fetch = request;
    for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
    await new Promise(resolve => server.close(resolve));
  }
});
