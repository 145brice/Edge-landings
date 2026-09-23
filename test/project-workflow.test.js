const test = require('node:test');
const assert = require('node:assert/strict');
const { validateIntake, newPortalToken, hashPortalToken, validProjectStatus, validSectionStatus } = require('../lib/project-workflow');

const plans = {
  basic: { slug: 'basic', name: 'Basic' },
  growth: { slug: 'growth', name: 'Growth' },
};

function intake(overrides = {}) {
  return {
    planSlug: 'basic', clientName: 'Jamie', businessName: 'Harbor Home', email: 'JAMIE@example.com', phone: '555-0100',
    businessType: 'Home services', primaryGoal: 'Generate estimates', audience: 'Local homeowners', services: 'Repairs',
    primaryAction: 'Request an estimate', differentiators: 'Fast and local', brandDirection: 'Clear and trustworthy',
    contactDetails: '555-0100', assetLink: 'https://drive.example.test/assets', contentPermission: true,
    siteStructure: [{ page: 'Home', purpose: 'Convert visitors', sections: ['Hero', 'Services', 'Contact'] }],
    ...overrides,
  };
}

test('build brief becomes a stable page and section diagram', () => {
  const result = validateIntake(intake(), plans);
  assert.equal(result.intake.email, 'jamie@example.com');
  assert.equal(result.siteStructure.length, 1);
  assert.deepEqual(result.sections.map(({ key, status }) => [key, status]), [
    ['home--hero', 'planned'], ['home--services', 'planned'], ['home--contact', 'planned'],
  ]);
});

test('plan limits and required permissions are enforced before project creation', () => {
  assert.throws(() => validateIntake(intake({ contentPermission: false }), plans), /Confirm/);
  assert.throws(() => validateIntake(intake({ siteStructure: [
    { page: 'One page', purpose: 'All content', sections: ['Hero','Services','About','Process','Testimonials','Gallery','FAQ'] },
  ] }), plans), /six sections/);
  assert.throws(() => validateIntake(intake({ planSlug: 'growth', siteStructure: Array.from({ length: 6 }, (_, index) => ({ page: `Page ${index}`, purpose: 'Purpose', sections: ['Hero'] })) }), plans), /up to 5 pages/);
});

test('portal tokens are random, stored as hashes, and statuses are constrained', () => {
  const first = newPortalToken();
  const second = newPortalToken();
  assert.notEqual(first, second);
  assert.match(first, /^[A-Za-z0-9_-]{40,60}$/);
  assert.match(hashPortalToken(first), /^[a-f0-9]{64}$/);
  assert.equal(validProjectStatus('draft_ready'), true);
  assert.equal(validProjectStatus('deleted'), false);
  assert.equal(validSectionStatus('revision_requested'), true);
  assert.equal(validSectionStatus('unknown'), false);
});
