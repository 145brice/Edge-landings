const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeTarget, isPrivateAddress, analyzeHtml, buildReport } = require('../lib/site-audit');

test('normalizes public website input and rejects unsafe URL shapes', () => {
  assert.equal(normalizeTarget('example.com/path').href, 'https://example.com/path');
  assert.throws(() => normalizeTarget('ftp://example.com'), /Only public HTTP/);
  assert.throws(() => normalizeTarget('http://user:pass@example.com'), /Only public HTTP/);
  assert.throws(() => normalizeTarget('http://example.com:8080'), /public website URL/);
});

test('recognizes private and loopback network addresses', () => {
  for (const address of ['127.0.0.1', '10.2.3.4', '172.16.0.2', '192.168.1.5', '169.254.1.1', '::1', 'fd00::1']) {
    assert.equal(isPrivateAddress(address), true, address);
  }
  assert.equal(isPrivateAddress('8.8.8.8'), false);
  assert.equal(isPrivateAddress('2606:4700:4700::1111'), false);
});

test('extracts deterministic website facts without AI', () => {
  const html = '<html lang="en"><head><title>Example Local Business</title><meta name="description" content="A clear local business description that gives customers useful information and a reason to get in touch with the team today."><meta name="viewport" content="width=device-width"><link rel="canonical" href="https://example.com/"></head><body><h1>Trusted local service</h1><script src="/wp-content/app.js"></script></body></html>';
  const facts = analyzeHtml(html, new URL('https://example.com/'), new Headers(), 400);
  assert.equal(facts.cms, 'WordPress');
  assert.equal(facts.https, true);
  assert.equal(facts.lang, 'en');
  assert.equal(facts.h1, 'Trusted local service');
});

test('preset scoring returns a bounded score and ranked issues', () => {
  const facts = {
    finalUrl: 'http://example.com/', https: false, viewport: '', title: '', description: '', h1: '',
    canonical: '', lang: '', robots: '', cms: 'Not detected', responseMs: 3000,
  };
  const report = buildReport(facts, { checked: 5, broken: 3, samples: [] }, null, new URL('http://example.com/'));
  assert.ok(report.score >= 0 && report.score <= 100);
  assert.equal(report.issues.length, 5);
  assert.equal(report.performance.source, 'Local response estimate');
  assert.match(report.grade, /priority|attention|foundation|Strong/i);
});

test('a site that passes every preset check can score 100', () => {
  const facts = {
    finalUrl: 'https://example.com/', https: true, viewport: 'width=device-width',
    title: 'Example Local Business', description: 'A useful description of the local business, its primary service, service area, and the next step customers should take today.',
    h1: 'Trusted local service', canonical: 'https://example.com/', lang: 'en', robots: '',
    cms: 'Not detected', responseMs: 300,
  };
  const report = buildReport(facts, { checked: 5, broken: 0, samples: [] }, { score: 100 }, new URL('https://example.com/'));
  assert.equal(report.score, 100);
  assert.equal(report.grade, 'Strong');
});
