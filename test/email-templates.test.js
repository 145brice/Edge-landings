const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeEmail, normalizeSender, cleanSubject, ownerOnboardingEmail, customerOnboardingEmail } = require('../lib/email-templates');

const safe = { businessName: 'Acme &amp; Co.', ownerName: 'Jamie', email: 'jamie@example.com', phone: '555-0100', existingUrl: '', businessType: 'Contractor', goals: 'More leads', requiredPages: 'Home, Services, Contact', notes: '' };
const selectedPlan = { name: 'Edge Landings Growth' };

test('normalizes configured email addresses and named senders', () => {
  assert.equal(normalizeEmail('  JAMIE@Example.COM\r\n'), 'jamie@example.com');
  assert.equal(normalizeSender(' Edge Landings <ONBOARDING@Example.com>\r\n'), 'Edge Landings <onboarding@example.com>');
  assert.throws(() => normalizeSender('Edge Landings onboarding@example.com'), /valid email/);
});

test('removes line breaks from email subjects', () => {
  assert.equal(cleanSubject('New onboarding\r\nBcc: bad@example.com'), 'New onboarding Bcc: bad@example.com');
});

test('builds formatted owner and customer emails with text fallbacks', () => {
  const owner = ownerOnboardingEmail({ safe, selectedPlan, submittedAt: '2026-08-25T12:00:00Z' });
  const customer = customerOnboardingEmail({ safe, selectedPlan });
  for (const email of [owner, customer]) {
    assert.match(email.html, /<!doctype html>/);
    assert.match(email.html, /Edge Landings/);
    assert.ok(email.text.length > 80);
  }
  assert.match(owner.text, /Plan: Edge Landings Growth/);
  assert.match(customer.text, /3 business days/);
});
