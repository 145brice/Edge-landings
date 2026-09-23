const test = require('node:test');
const assert = require('node:assert/strict');
const { validateIntake, normalizeBuiltSections, newPortalToken, hashPortalToken, validProjectStatus, validSectionStatus } = require('../lib/project-workflow');

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
    siteStructure: [{ page: 'Home', purpose: 'Introduce the business, explain services, and collect estimate requests.' }],
    ...overrides,
  };
}

test('build brief accepts plain-language page goals without website terminology', () => {
  const result = validateIntake(intake(), plans);
  assert.equal(result.intake.email, 'jamie@example.com');
  assert.equal(result.siteStructure.length, 1);
  assert.deepEqual(result.sections.map(({ key, label, status }) => [key, label, status]), [
    ['home--page-content', 'Page content', 'planned'],
  ]);
});

test('plan limits and required permissions are enforced before project creation', () => {
  assert.throws(() => validateIntake(intake({ contentPermission: false }), plans), /Confirm/);
  assert.throws(() => validateIntake(intake({ siteStructure: [{ page: 'One page', purpose: '' }] }), plans), /Explain what people should find/);
  assert.throws(() => validateIntake(intake({ planSlug: 'growth', siteStructure: Array.from({ length: 6 }, (_, index) => ({ page: `Page ${index}`, purpose: 'Purpose' })) }), plans), /up to 5 pages/);
});

test('owner names the areas actually built after intake', () => {
  const project = {
    plan_slug: 'basic',
    site_structure: [{ page: 'Home', purpose: 'Convert visitors', sections: ['Page content'] }],
    sections: [{ key: 'home--page-content', page: 'Home', label: 'Page content', position: 1, status: 'planned' }],
  };
  const result = normalizeBuiltSections(project, [{ page: 'Home', labels: ['Main introduction', 'Services offered', 'Request an estimate'] }]);
  assert.deepEqual(result.sections.map(({ key, label }) => [key, label]), [
    ['home--main-introduction', 'Main introduction'],
    ['home--services-offered', 'Services offered'],
    ['home--request-an-estimate', 'Request an estimate'],
  ]);
  assert.throws(() => normalizeBuiltSections(project, [{ page: 'Home', labels: ['1','2','3','4','5','6','7'] }]), /between 1 and 6/);
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
