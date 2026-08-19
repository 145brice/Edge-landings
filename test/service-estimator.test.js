const test = require('node:test');
const assert = require('node:assert/strict');
const { estimateRequest } = require('../lib/service-estimator');
const { blendedRange, configuredPriceMap } = require('../lib/catalog-store');

const service = { id: 'one', slug: 'website-care', name: 'Website Care', keywords: ['landing page', 'small business'], suggested_min_cents: 50000, suggested_max_cents: 500000, actual_price_cents: 19900, price_id: 'price_123', estimated_delivery_days: 3 };

test('returns the fixed catalog price and price ID for a confident template match', () => {
  const result = estimateRequest({ description: 'Template landing page and website care for my small business' }, [service]);
  assert.equal(result.classification, 'template');
  assert.equal(result.fixedPriceCents, 19900);
  assert.equal(result.priceId, 'price_123');
  assert.equal(result.manualReview, false);
  assert.doesNotMatch(JSON.stringify(result), /token|model/i);
});

test('flags custom and low-confidence work for manual review', () => {
  const custom = estimateRequest({ description: 'Custom ecommerce portal with an API integration' }, [service]);
  assert.equal(custom.classification, 'custom');
  assert.equal(custom.priceId, null);
  assert.equal(custom.manualReview, true);
});

test('actual job prices outweigh market baselines', () => {
  assert.deepEqual(blendedRange([100000, 120000, 140000], 500000, 900000), { min: 180000, max: 276000 });
});

test('server-side Stripe mapping rejects malformed price IDs', () => {
  process.env.STRIPE_PRICE_MAP = '{"basic":"not-a-price"}';
  assert.throws(() => configuredPriceMap(), /invalid/);
  process.env.STRIPE_PRICE_MAP = '{"basic":"price_basic123","growth":"price_growth123"}';
  assert.equal(configuredPriceMap().growth, 'price_growth123');
});
