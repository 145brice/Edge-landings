(() => {
  const form = document.getElementById('audit-form');
  if (!form) return;
  const input = document.getElementById('audit-url');
  const button = document.getElementById('audit-submit');
  const status = document.getElementById('audit-status');
  const report = document.getElementById('audit-report');
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
  const icon = (passed) => passed ? '✓' : '!';

  function render(data) {
    const issueCards = data.issues.map((issue) => `<article class="audit-issue"><span>${icon(issue.passed)}</span><div><h4>${escape(issue.label)}</h4><p>${escape(issue.detail)}</p><strong>Fix: ${escape(issue.fix)}</strong></div></article>`).join('');
    const wins = data.quickWins.map((win) => `<li>${escape(win)}</li>`).join('');
    const metrics = [
      ['Performance', data.performance?.score == null ? 'Estimated' : `${data.performance.score}/100`],
      ['LCP', data.performance?.lcp || 'No field data'], ['CLS', data.performance?.cls || 'No field data'],
      ['INP', data.performance?.inp || 'No field data'], ['CMS', data.cms], ['Scope', data.scope],
    ].map(([label, value]) => `<div><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`).join('');
    const mockupUrl = `/start-project.html?website=${encodeURIComponent(data.finalUrl)}`;
    report.innerHTML = `<div class="report-heading"><div class="score-ring" style="--score:${data.score}"><strong>${data.score}</strong><span>/100</span></div><div><div class="eyebrow">Website health report</div><h3>${escape(data.grade)}</h3><p>${escape(data.finalUrl)}</p><small>Audited ${new Date(data.auditedAt).toLocaleString()} · Preset scoring, no AI</small></div></div><section class="audit-metrics">${metrics}</section><section><h3>Top issues</h3><div class="audit-issues">${issueCards || '<p>No major preset issues were detected.</p>'}</div></section><section class="quick-wins"><h3>Quick wins</h3><ol>${wins || '<li>Keep monitoring performance and content quality.</li>'}</ol></section><aside class="report-ad"><span>Beta pricing · Half price</span><strong>Want these fixes handled for you?</strong><p>Edge Landings builds and maintains conversion-focused local business websites from $49/month during beta.</p></aside><div class="report-actions"><button class="button primary" id="download-report" type="button">Download my report</button><a class="button secondary" href="${mockupUrl}">Start a free draft with these fixes</a></div><p class="report-note">The audit samples the homepage and a limited number of internal links. It is a practical screening report, not a compliance certification.</p>`;
    report.hidden = false;
    document.getElementById('download-report').addEventListener('click', () => window.print());
    report.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    button.disabled = true;
    status.className = 'audit-status';
    status.textContent = 'Analyzing the site. PageSpeed can take up to 30 seconds…';
    report.hidden = true;
    try {
      const response = await fetch('/api/site-audit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ website: input.value }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'The audit could not be completed.');
      status.textContent = 'Audit complete.';
      render(payload);
    } catch (error) {
      status.className = 'audit-status error';
      status.textContent = error.message || 'The audit could not be completed. Please try again.';
    } finally { button.disabled = false; }
  });
})();
