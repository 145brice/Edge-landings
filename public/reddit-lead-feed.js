(() => {
  const root = document.querySelector('[data-reddit-lead-feed]');
  if (!root) return;

  const ticker = root.querySelector('[data-lead-ticker]');
  const list = root.querySelector('[data-lead-list]');
  const status = root.querySelector('[data-lead-status]');
  const industry = root.dataset.leadIndustry || '';
  const industryLabel = root.dataset.leadIndustryLabel || '';
  let leads = [];
  let tickerIndex = 0;
  let tickerTimer;
  let pollTimer;
  let signature = '';

  const relativeTime = (iso) => {
    const time = Date.parse(iso);
    if (!time) return 'Recently found';
    const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
    if (seconds < 60) return 'Found just now';
    if (seconds < 3600) return `Found ${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `Found ${Math.floor(seconds / 3600)}h ago`;
    return `Found ${Math.floor(seconds / 86400)}d ago`;
  };

  const addText = (parent, className, value) => {
    const element = document.createElement('span');
    element.className = className;
    element.textContent = value;
    parent.appendChild(element);
  };

  const routedWebsite = (category) => {
    const routes = {
      Roofing: ['roofing', 'Roofing'],
      Flooring: ['flooring', 'Flooring'],
      Foundation: ['general-contractor', 'General Contractor'],
      Remodeling: ['general-contractor', 'General Contractor'],
      'General Contracting': ['general-contractor', 'General Contractor'],
      Concrete: ['general-contractor', 'General Contractor'],
    };
    return routes[category];
  };

  const renderTicker = () => {
    ticker.replaceChildren();
    if (!leads.length) {
      addText(ticker, 'lead-empty', 'No new contractor opportunities yet.');
      return;
    }
    const lead = leads[tickerIndex % leads.length];
    const meta = document.createElement('div');
    meta.className = 'lead-ticker-meta';
    addText(meta, 'lead-new', 'NEW LEAD');
    [lead.subreddit && `r/${lead.subreddit}`, lead.location, lead.category].filter(Boolean)
      .forEach((value) => addText(meta, 'lead-meta-item', value));
    ticker.appendChild(meta);
    const excerpt = document.createElement('p');
    excerpt.textContent = lead.excerpt || lead.title;
    ticker.appendChild(excerpt);
    const time = document.createElement('small');
    time.textContent = relativeTime(lead.discoveredAt);
    ticker.appendChild(time);
  };

  const renderList = () => {
    list.replaceChildren();
    for (const lead of leads) {
      const item = document.createElement('article');
      item.className = 'lead-row';
      const content = document.createElement('div');
      const meta = document.createElement('div');
      meta.className = 'lead-row-meta';
      addText(meta, '', lead.category || 'Contractor opportunity');
      if (lead.location) addText(meta, '', lead.location);
      if (lead.subreddit) addText(meta, '', `r/${lead.subreddit}`);
      content.appendChild(meta);
      const excerpt = document.createElement('p');
      excerpt.textContent = lead.excerpt || lead.title;
      content.appendChild(excerpt);
      const time = document.createElement('small');
      time.textContent = relativeTime(lead.discoveredAt);
      content.appendChild(time);
      item.appendChild(content);
      const actions = document.createElement('div');
      actions.className = 'lead-actions';
      if (root.hasAttribute('data-show-routing-links')) {
        const route = routedWebsite(lead.category);
        if (route) {
          const routedLink = document.createElement('a');
          routedLink.className = 'lead-view lead-route';
          routedLink.href = `/contractor-demo.html?industry=${encodeURIComponent(route[0])}`;
          routedLink.textContent = `See ${route[1]} site`;
          actions.appendChild(routedLink);
        }
      }
      if (lead.redditUrl) {
        const link = document.createElement('a');
        link.className = 'lead-view';
        link.href = lead.redditUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'View';
        actions.appendChild(link);
      }
      if (actions.childElementCount) item.appendChild(actions);
      list.appendChild(item);
    }
  };

  const schedulePoll = () => {
    clearTimeout(pollTimer);
    pollTimer = setTimeout(load, document.hidden ? 90_000 : 20_000);
  };

  const load = async () => {
    try {
      const params = new URLSearchParams({ limit: '10' });
      if (industry) params.set('industry', industry);
      const response = await fetch(`/api/reddit-leads?${params}`, { headers: { Accept: 'application/json' } });
      if (response.status === 404) return;
      const payload = await response.json();
      root.hidden = false;
      if (!response.ok) throw new Error(payload.error || 'Feed unavailable');
      status.textContent = industryLabel ? `Routed to ${industryLabel}` : 'Monitoring contractor opportunities';
      status.classList.remove('feed-error');
      const nextSignature = payload.leads.map((lead) => lead.id).join('|');
      if (nextSignature !== signature) {
        leads = payload.leads;
        signature = nextSignature;
        tickerIndex = 0;
        renderTicker();
        renderList();
      }
      clearInterval(tickerTimer);
      if (leads.length > 1) tickerTimer = setInterval(() => {
        tickerIndex = (tickerIndex + 1) % leads.length;
        renderTicker();
      }, 6000);
    } catch (error) {
      root.hidden = false;
      status.textContent = 'Lead feed temporarily unavailable';
      status.classList.add('feed-error');
      if (!leads.length) ticker.textContent = 'We’ll resume showing opportunities when the feed reconnects.';
    } finally {
      if (!root.hidden) schedulePoll();
    }
  };

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !root.hidden) load();
  });
  load();
})();
