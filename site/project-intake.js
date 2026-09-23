const form = document.getElementById('project-intake');
const plan = document.getElementById('plan');
const builder = document.getElementById('page-builder');
const addPage = document.getElementById('add-page');
const status = document.getElementById('intake-status');
const result = document.getElementById('portal-result');
const standardSections = ['Hero','Services','About','Process','Testimonials','Gallery','FAQ','Contact','Call to action','Team','Service area'];

function pageCard(name = '') {
  const card = document.createElement('article');
  card.className = 'page-card';
  card.innerHTML = `<div class="page-card-head"><strong>Page <span class="page-number"></span></strong><button class="remove-page" type="button">Remove</button></div><div class="fields"><label>Page name<input class="page-name" value="${name}" required placeholder="Home, About, Services..."></label><label>Purpose of this page<textarea class="page-purpose" required placeholder="What must a visitor understand or do here?"></textarea></label></div><fieldset><legend>Sections to build</legend><p class="help">Basic allows up to six sections. Choose only what this page needs.</p><div class="choice-row">${standardSections.map((section) => `<label class="choice"><input type="checkbox" value="${section}"><span>${section}</span></label>`).join('')}</div></fieldset><label>Custom section names <input class="custom-sections" placeholder="Pricing table, menu, case studies"></label>`;
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

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = form.querySelector('[type="submit"]');
  const siteStructure = [...builder.children].map((card) => {
    const sections = [...card.querySelectorAll('input[type="checkbox"]:checked')].map((item) => item.value);
    const custom = card.querySelector('.custom-sections').value.split(',').map((item) => item.trim()).filter(Boolean);
    return { page: card.querySelector('.page-name').value.trim(), purpose: card.querySelector('.page-purpose').value.trim(), sections: [...sections, ...custom] };
  });
  if (plan.value === 'basic' && siteStructure[0].sections.length > 6) {
    status.className = 'status error'; status.textContent = 'Basic allows up to six sections. Remove a section or choose Growth.'; return;
  }
  if (siteStructure.some((page) => !page.sections.length)) {
    status.className = 'status error'; status.textContent = 'Choose at least one section for every page.'; return;
  }
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
