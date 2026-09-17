const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../server');

async function withServer(run) {
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('only intended website assets are public', async () => {
  await withServer(async base => {
    for (const route of ['/', '/pricing.html', '/templates.html', '/contact.html', '/success.html', '/audit.js', '/site.css', '/contact.js', '/demo-preview.js', '/auto-basic.html', '/lawyer-template/index.html', '/lawyer-template/assets/css/style.css']) {
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
