const params = new URLSearchParams(location.search);
const token = params.get('token') || '';
const loadStatus = document.getElementById('load-status');
const content = document.getElementById('portal-content');
let project;
const statusOrder = ['intake_received','building','draft_ready','approved','active'];
const statusLabels = { intake_received:'Brief received', building:'Draft in progress', draft_ready:'Ready to review', changes_requested:'Changes requested', approved:'Approved', active:'Active plan', paused:'Paused' };
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));

function renderSteps() {
  const effective = project.status === 'changes_requested' ? 'draft_ready' : project.status;
  const current = Math.max(0, statusOrder.indexOf(effective));
  document.getElementById('project-steps').innerHTML = ['Brief received','Building','Review free draft','Approve and purchase','Ongoing updates'].map((label,index) => `<div class="step ${index < current ? 'done' : index === current ? 'current' : ''}">${index + 1}. ${label}</div>`).join('');
}

function renderDiagram() {
  const byPage = new Map();
  project.sections.forEach((section) => { if (!byPage.has(section.page)) byPage.set(section.page, []); byPage.get(section.page).push(section); });
  const diagram = document.getElementById('site-diagram');
  diagram.innerHTML = [...byPage].map(([page, sections]) => `<article class="diagram-page"><div class="diagram-page-title"><strong>${esc(page)}</strong></div><div class="section-flow">${sections.map((section) => `<button class="section-node ${esc(section.status)}" type="button" data-section="${esc(section.key)}"><strong>${esc(section.label)}</strong><small>${esc(section.status.replaceAll('_',' '))}</small></button>`).join('')}</div></article>`).join('');
  document.getElementById('section-select').innerHTML = project.sections.map((section) => `<option value="${esc(section.key)}">${esc(section.page)} — ${esc(section.label)}</option>`).join('');
  diagram.querySelectorAll('[data-section]').forEach((button) => button.addEventListener('click', () => { document.getElementById('section-select').value = button.dataset.section; document.getElementById('change-panel').scrollIntoView({behavior:'smooth'}); }));
}

function renderDraft() {
  const target = document.getElementById('draft-content');
  if (!project.previewUrl) { target.innerHTML = '<div class="notice-box"><strong>Your brief is in the build queue.</strong><p class="muted">The preview link appears here as soon as the first draft is ready. No payment is due.</p></div>'; return; }
  let action = '<p class="muted">Review every page and use the section diagram to request revisions.</p>';
  if (project.status === 'draft_ready') action += '<button class="button yellow" id="approve-draft" type="button">I approve this draft</button>';
  if (project.status === 'approved') action += '<button class="button yellow" id="purchase-project" type="button">Purchase and launch my site</button>';
  if (project.status === 'active') action += '<p class="status success"><strong>Payment confirmed.</strong> Hosting and monthly updates are active.</p>';
  target.innerHTML = `<div class="actions"><a class="button" href="${esc(project.previewUrl)}" target="_blank" rel="noopener">Open website draft</a></div>${action}<p class="status" id="draft-status"></p>`;
  document.getElementById('approve-draft')?.addEventListener('click', approveDraft);
  document.getElementById('purchase-project')?.addEventListener('click', purchase);
}

function renderRequests() {
  document.getElementById('request-list').innerHTML = project.requests.length ? `<h3>Request history</h3>${project.requests.map((request) => `<article class="request"><div class="request-head"><strong>${esc(request.section_label)}</strong><span>${esc(request.status)}</span></div><small>${esc(request.request_type)} · ${new Date(request.created_at).toLocaleDateString()}</small><p>${esc(request.details)}</p></article>`).join('')}` : '<p class="muted">No changes requested yet.</p>';
}

function renderMessages() {
  document.getElementById('message-thread').innerHTML = project.messages.length ? project.messages.map((message) => `<article class="message ${esc(message.sender)}"><div class="message-head"><strong>${message.sender === 'owner' ? 'Edge Landings' : message.sender === 'client' ? esc(project.clientName) : 'Project activity'}</strong><span>${new Date(message.created_at).toLocaleString()}</span></div><p>${esc(message.body)}</p></article>`).join('') : '<p class="muted">Project messages appear here.</p>';
}

function render() {
  document.getElementById('project-title').textContent = project.businessName;
  document.getElementById('project-intro').textContent = `${project.planSlug === 'growth' ? 'Growth' : 'Basic'} project · submitted by ${project.clientName}`;
  const pill = document.getElementById('project-status'); pill.textContent = statusLabels[project.status] || project.status; pill.className = `status-pill ${project.status}`;
  renderSteps(); renderDiagram(); renderDraft(); renderRequests(); renderMessages(); content.hidden = false;
}

async function load() {
  if (!token) { loadStatus.className = 'status error'; loadStatus.textContent = 'This portal link is missing its private access token.'; return; }
  try {
    const response = await fetch(`/api/client-project?token=${encodeURIComponent(token)}`);
    const payload = await response.json(); if (!response.ok) throw new Error(payload.error);
    project = payload; render(); loadStatus.textContent = '';
    const sessionId = params.get('session_id');
    if (params.get('payment') === 'success' && sessionId) await confirmPayment(sessionId);
  } catch (error) { loadStatus.className = 'status error'; loadStatus.textContent = error.message || 'This project could not be loaded.'; }
}

async function post(url, body) {
  const response = await fetch(url, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,token})});
  const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'The request failed.'); return payload;
}

async function approveDraft() {
  const target = document.getElementById('draft-status'); target.textContent = 'Recording approval...';
  try { await post('/api/project-approval',{}); await load(); }
  catch(error){ target.className='status error'; target.textContent=error.message; }
}

async function purchase() {
  const target = document.getElementById('draft-status'); target.textContent = 'Opening secure checkout...';
  try { const requestId = crypto.randomUUID(); const payload = await post('/api/create-project-checkout-session',{requestId}); location.assign(payload.url); }
  catch(error){ target.className='status error'; target.textContent=error.message; }
}

async function confirmPayment(sessionId) {
  loadStatus.textContent = 'Confirming payment...';
  try { await post('/api/confirm-project-payment',{sessionId}); history.replaceState({},'',`/portal.html?token=${encodeURIComponent(token)}`); const response=await fetch(`/api/client-project?token=${encodeURIComponent(token)}`); project=await response.json(); render(); loadStatus.className='status success'; loadStatus.textContent='Payment confirmed. Your plan is active.'; }
  catch(error){ loadStatus.className='status error'; loadStatus.textContent=error.message; }
}

document.getElementById('change-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const form=event.currentTarget, button=form.querySelector('button'), target=document.getElementById('change-status'); button.disabled=true; target.textContent='Saving request...';
  try { await post('/api/change-request',Object.fromEntries(new FormData(form))); form.reset(); await load(); target.className='status success'; target.textContent='Your section request was saved.'; }
  catch(error){ target.className='status error'; target.textContent=error.message; } finally{button.disabled=false;}
});

document.getElementById('message-form').addEventListener('submit', async (event) => {
  event.preventDefault(); const form=event.currentTarget, button=form.querySelector('button'), target=document.getElementById('message-status'); button.disabled=true; target.textContent='Sending...';
  try { await post('/api/project-message',Object.fromEntries(new FormData(form))); form.reset(); await load(); target.className='status success'; target.textContent='Message saved and Edge Landings was notified.'; }
  catch(error){ target.className='status error'; target.textContent=error.message; } finally{button.disabled=false;}
});

load();
