const project = new URLSearchParams(location.search).get('project');
const projectNames = {tax:'Edge Tax Research',leads:'Edge Leads',websites:'Edge Websites',processor:'Processor Assistant'};
if (projectNames[project]) document.querySelector('[name="message"]').value = 'I am interested in '+projectNames[project]+'.\n\n';
const form = document.getElementById('contact-form');
const status = document.getElementById('contact-status');
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button');
  button.disabled = true;
  status.className = '';
  status.textContent = 'Sending your message...';
  try {
    const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'Your message could not be sent. Please try again.');
    form.reset();
    status.textContent = 'Your message was sent. We will reply to the email address you provided.';
  } catch (error) { status.className = 'error'; status.textContent = error.message; }
  finally { button.disabled = false; }
});
