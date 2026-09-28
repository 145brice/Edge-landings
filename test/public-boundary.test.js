const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');

async function withServer(run) {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { server.closeAllConnections?.(); await new Promise(resolve => server.close(resolve)); }
}

test('only intended website assets are public', async () => {
  await withServer(async base => {
    for (const route of ['/', '/pricing.html', '/templates.html', '/contact.html', '/success.html', '/start-project.html', '/portal.html', '/portal-example.html', '/admin.html', '/project-intake.js', '/portal.js', '/admin.js', '/client-workflow.css', '/audit.js', '/site.css', '/contact.js', '/demo-preview.js', '/auto-basic.html', '/lawyer-template/index.html', '/lawyer-template/assets/css/style.css']) {
      const response = await fetch(base + route);
      assert.equal(response.status, 200, route);
      assert.ok(response.headers.get('content-security-policy'), route);
      await response.text();
    }
    for (const route of ['/server.js', '/api/login.js', '/package.json', '/README.md', '/.env', '/.git/config', '/lib/catalog-store.js', '/service-catalog.sql', '/dashboard.py', '/archive/legacy/index.html', '/signup.html', '/public/index.html', '/site/../server.js', '/%2e%2e%2fserver.js']) {
      const response = await fetch(base + route);
      assert.equal(response.status, 404, route);
      await response.text();
    }
  });
});

test('contact rejects invalid messages, traps bots, and fails honestly without configuration', async () => {
  const prior = process.env.EMAIL_API_KEY;
  delete process.env.EMAIL_API_KEY;
  try {
    await withServer(async base => {
      const post = body => fetch(base + '/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.equal((await post({})).status, 400);
      assert.equal((await post({ name: 'Sam', email: 'bad', message: 'Hello' })).status, 400);
      assert.equal((await post({ companyWebsite: 'spam' })).status, 200);
      assert.equal((await post({ name: 'Sam', email: 'sam@example.com', message: 'Can we discuss a website?' })).status, 503);
    });
  } finally { if (prior === undefined) delete process.env.EMAIL_API_KEY; else process.env.EMAIL_API_KEY = prior; }
});

test('direct checkout is disabled until a client approves a project draft', async () => {
  await withServer(async base => {
    const response = await fetch(base + '/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planSlug: 'basic' }),
    });
    assert.equal(response.status, 410);
    assert.match((await response.json()).error, /build brief/i);
  });
});

test('Pro automation ingestion and delivery routes reject unauthenticated requests', async () => {
  const priorWebhook = process.env.PRO_AUTOMATION_WEBHOOK_SECRET;
  const priorCron = process.env.CRON_SECRET;
  const priorAppUrl = process.env.APP_URL;
  process.env.PRO_AUTOMATION_WEBHOOK_SECRET = 'server-only-test-secret';
  process.env.CRON_SECRET = 'server-only-cron-secret';
  process.env.APP_URL = 'http://localhost';
  try {
    await withServer(async base => {
      const jsonPost = route => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', Connection: 'close' }, body: '{}' });
      assert.equal((await jsonPost('/api/review-reply')).status, 401);
      assert.equal((await jsonPost('/api/lead-followup')).status, 401);
      assert.equal((await jsonPost('/api/lead-booked')).status, 401);
      assert.equal((await fetch(base + '/api/missed-call', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Connection: 'close' }, body: 'CallStatus=no-answer' })).status, 403);
      assert.equal((await fetch(base + '/api/pro-followups', { headers: { Connection: 'close' } })).status, 401);
    });
  } finally {
    if (priorWebhook === undefined) delete process.env.PRO_AUTOMATION_WEBHOOK_SECRET; else process.env.PRO_AUTOMATION_WEBHOOK_SECRET = priorWebhook;
    if (priorCron === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = priorCron;
    if (priorAppUrl === undefined) delete process.env.APP_URL; else process.env.APP_URL = priorAppUrl;
  }
});
