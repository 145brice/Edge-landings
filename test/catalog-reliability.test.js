const test = require('node:test');
const assert = require('node:assert/strict');
const { authorized, validateJob } = require('../api/catalog-webhook');
const { refreshMarketBaselines } = require('../lib/market-baselines');

test('cron and estimator credentials are scoped correctly', () => {
  process.env.CRON_SECRET = 'cron-secret-value';
  process.env.ESTIMATOR_WEBHOOK_SECRET = 'estimator-secret-value';
  assert.equal(authorized({ method: 'GET', headers: { authorization: 'Bearer cron-secret-value' } }), true);
  assert.equal(authorized({ method: 'GET', headers: { authorization: 'Bearer estimator-secret-value' } }), false);
  assert.equal(authorized({ method: 'POST', headers: { authorization: 'Bearer estimator-secret-value' } }), true);
  assert.equal(authorized({ method: 'POST', headers: { authorization: 'Bearer wrong' } }), false);
});

test('completed jobs require a stable event ID and integer prices', () => {
  assert.throws(() => validateJob({}), /eventId/);
  assert.throws(() => validateJob({ eventId: 'job_12345678', description: 'Site', classification: 'template', outcome: 'complete', finalPriceCents: 19.99 }), /integer/);
  const job = validateJob({ eventId: 'job_12345678', description: 'Site', classification: 'template', outcome: 'complete', finalPriceCents: 19900 });
  assert.equal(job.finalPriceCents, 19900);
});

test('market refresh keeps a valid source when another source fails', async () => {
  const fakeFetch = async (url) => url.includes('clutch')
    ? { ok: true, text: async () => '<p>between $25-$49 per hour</p>' }
    : { ok: false, status: 503, text: async () => '' };
  const result = await refreshMarketBaselines(fakeFetch);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].low_cents, 2500);
  assert.equal(result.errors.length, 1);
});
