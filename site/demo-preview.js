// Keep concept-site forms and contact details from reaching real businesses.
document.addEventListener('DOMContentLoaded', () => {
  const banner = document.createElement('aside');
  banner.style.cssText = 'position:relative;z-index:9999;background:#071426;color:#fff;padding:14px 20px;text-align:center;font:14px/1.5 Arial,sans-serif';
  banner.innerHTML = 'Edge Landings concept demo. Businesses, reviews, and results are sample content. Forms do not send. <a href="/templates.html" style="color:#00f18c">Back to examples</a>';
  document.body.prepend(banner);
});
document.addEventListener('submit', (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();
  let note = event.target.querySelector('[data-demo-message]');
  if (!note) { note = document.createElement('p'); note.dataset.demoMessage = ''; note.setAttribute('role', 'status'); event.target.append(note); }
  note.textContent = 'Demo only: nothing was sent. Your live website will deliver inquiries to your business.';
}, true);
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (link && /^(https?:|mailto:|tel:)/i.test(link.getAttribute('href'))) {
    event.preventDefault();
    event.stopImmediatePropagation();
    alert('This is a concept preview. Contact and booking links are examples only.');
  }
}, true);
