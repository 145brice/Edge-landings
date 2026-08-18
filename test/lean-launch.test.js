const test = require('node:test');
const assert = require('node:assert/strict');

process.env.STRIPE_PRICE_ID = 'price_server_only';
process.env.APP_URL = 'https://example.test';
const { ONE_PLAN_NAME, checkoutSessionParams, verifiedCheckout } = require('../server');

const paidSession = {
  mode: 'subscription', status: 'complete', payment_status: 'paid', subscription: 'sub_test', customer: 'cus_test',
  customer_details: { email: 'buyer@example.test' }, metadata: { service: ONE_PLAN_NAME },
};

test('checkout parameters use only server configuration', () => {
  const params = checkoutSessionParams({ priceId: 'price_attacker', successUrl: 'https://attacker.test' });
  assert.equal(params.line_items[0].price, 'price_server_only');
  assert.equal(params.success_url, 'https://example.test/success.html?session_id={CHECKOUT_SESSION_ID}');
  assert.equal(params.cancel_url, 'https://example.test/pricing.html');
});

test('payment verification rejects missing, unpaid, and mismatched checkout sessions', () => {
  assert.equal(verifiedCheckout({}, 'buyer@example.test'), false);
  assert.equal(verifiedCheckout({ ...paidSession, payment_status: 'unpaid' }, 'buyer@example.test'), false);
  assert.equal(verifiedCheckout({ ...paidSession, customer_details: { email: 'other@example.test' } }, 'buyer@example.test'), false);
  assert.equal(verifiedCheckout(paidSession, 'BUYER@example.test'), true);
});
