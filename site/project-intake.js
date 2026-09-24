const form = document.getElementById('project-intake');
const plan = document.getElementById('plan');
const builder = document.getElementById('page-builder');
const addPage = document.getElementById('add-page');
const status = document.getElementById('intake-status');
const result = document.getElementById('portal-result');

function pageCard(name = '') {
  const card = document.createElement('article');
  card.className = 'page-card';
  card.innerHTML = `<div class="page-card-head"><strong>Page <span class="page-number"></span></strong><button class="remove-page" type="button">Remove</button></div><div class="fields"><label>Page name<input class="page-name" value="${name}" required placeholder="Home, About, Services..."></label><label>What should people find on this page?<textarea class="page-purpose" required placeholder="Describe it normally. For example: introduce the business, explain our three services, show a few reviews, and make it easy to request an estimate."></textarea></label></div>`;
  card.querySelector('.remove-page').addEventListener('click', () => { card.remove(); renumber(); });
  builder.append(card); renumber();
}

function renumber() {
  [...builder.children].forEach((card, index) => card.querySelector('.page-number').textContent = index + 1);
  const basic = plan.value === 'basic';
  addPage.hidden = basic || builder.children.length >= 5;
  [...builder.children].forEach((card, index) => {
    card.querySelector('.remove-page').hidden = basic || builder.children.length === 1;
    if (basic && index === 0 && !card.querySelector('.page-name').value) card.querySelector('.page-name').value = 'One-page website';
  });
}

function resetStructure() {
  builder.innerHTML = '';
  pageCard(plan.value === 'basic' ? 'One-page website' : 'Home');
}

plan.addEventListener('change', resetStructure);
addPage.addEventListener('click', () => { if (builder.children.length < 5) pageCard(); });
const requestedPlan = new URLSearchParams(location.search).get('plan');
if (['basic','growth'].includes(requestedPlan)) plan.value = requestedPlan;
resetStructure();
const auditedWebsite = new URLSearchParams(location.search).get('website');
if (auditedWebsite && /^https?:\/\//i.test(auditedWebsite)) form.elements.existingUrl.value = auditedWebsite;

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = form.querySelector('[type="submit"]');
  const siteStructure = [...builder.children].map((card) => ({
    page: card.querySelector('.page-name').value.trim(),
    purpose: card.querySelector('.page-purpose').value.trim(),
  }));
  const data = Object.fromEntries(new FormData(form));
  data.contentPermission = form.elements.contentPermission.checked;
  data.siteStructure = siteStructure;
  submit.disabled = true; status.className = 'status'; status.textContent = 'Creating your private project portal...'; result.hidden = true;
  try {
    const response = await fetch('/api/project-intake', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
    const payload = await response.json();
    if (!response.ok || !payload.portalUrl) throw new Error(payload.error || 'Your project could not be created.');
    status.className = 'status success'; status.textContent = payload.emailDelivered ? 'Your project is ready. We also emailed your private link.' : 'Your project is ready. Save this link now; the confirmation email could not be delivered.';
    result.hidden = false; result.innerHTML = `<div class="notice-box"><strong>Your private portal</strong><p><a class="portal-link" href="${payload.portalUrl}">${payload.portalUrl}</a></p><a class="button" href="${payload.portalUrl}">Open my project portal</a></div>`;
    form.querySelectorAll('input,textarea,select,button').forEach((field) => field.disabled = true);
    result.querySelector('a.button').focus();
  } catch (error) { status.className = 'status error'; status.textContent = error.message; submit.disabled = false; }
});
