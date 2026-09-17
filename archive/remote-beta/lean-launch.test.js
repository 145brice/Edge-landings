const test = require('node:test');
const assert = require('node:assert/strict');

process.env.APP_URL = 'https://example.test';
const { PLANS, checkoutSessionParams, verifiedCheckout } = require('../server');

const paidSession = {
  mode: 'subscription', status: 'complete', payment_status: 'paid', subscription: 'sub_test', customer: 'cus_test',
  customer_details: { email: 'buyer@example.test' }, metadata: { service: PLANS.growth.name, plan_slug: 'growth' },
};

test('checkout parameters use only server configuration', () => {
  const params = checkoutSessionParams(PLANS.growth, 'price_server_only');
  assert.equal(params.line_items[0].price, 'price_server_only');
  assert.equal(params.metadata.plan_slug, 'growth');
  assert.equal(params.success_url, 'https://example.test/success.html?session_id={CHECKOUT_SESSION_ID}');
  assert.equal(params.cancel_url, 'https://example.test/pricing.html');
});

test('each plan carries its own server-controlled checkout metadata', () => {
  const basic = checkoutSessionParams(PLANS.basic, 'price_basic');
  const growth = checkoutSessionParams(PLANS.growth, 'price_growth');
  const leads = checkoutSessionParams(PLANS.leads, 'price_leads');
  assert.deepEqual(basic.line_items, [{ price: 'price_basic', quantity: 1 }]);
  assert.equal(basic.metadata.service, 'Edge Landings Basic');
  assert.equal(growth.metadata.service, 'Edge Landings Growth');
  assert.equal(leads.metadata.service, 'Edge Leads Dashboard');
  assert.deepEqual(
    [PLANS.basic.betaPriceCents, PLANS.growth.betaPriceCents, PLANS.leads.betaPriceCents],
    [4900, 9900, 9900],
  );
  assert.deepEqual(
    [PLANS.basic.regularPriceCents, PLANS.growth.regularPriceCents, PLANS.leads.regularPriceCents],
    [7900, 17900, 19900],
  );
});

test('payment verification rejects missing, unpaid, and mismatched checkout sessions', () => {
  assert.equal(verifiedCheckout({}, 'buyer@example.test'), false);
  assert.equal(verifiedCheckout({ ...paidSession, payment_status: 'unpaid' }, 'buyer@example.test'), false);
  assert.equal(verifiedCheckout({ ...paidSession, customer_details: { email: 'other@example.test' } }, 'buyer@example.test'), false);
  assert.equal(verifiedCheckout(paidSession, 'BUYER@example.test'), true);
  assert.equal(verifiedCheckout({ ...paidSession, metadata: { service: 'Old plan', plan_slug: 'website-care' } }, 'buyer@example.test'), false);
});
