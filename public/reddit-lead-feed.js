(() => {
  const root = document.querySelector('[data-reddit-lead-feed]');
  if (!root) return;
  const ticker = root.querySelector('[data-lead-ticker]');
  const list = root.querySelector('[data-lead-list]');
  const status = root.querySelector('[data-lead-status]');
  const statsRoot = document.querySelector('[data-lead-stats]');
  const industry = root.dataset.leadIndustry || '';
  const industryLabel = root.dataset.leadIndustryLabel || '';
  let leads = [], tickerIndex = 0, tickerTimer, pollTimer, clockTimer, signature = null, initialLeadIds;

  const locationDisplay = (lead) => {
    const value = typeof lead.location === 'object' ? lead.location?.display : lead.location;
    return value || 'Unknown';
  };
  const relativeTime = (iso) => {
    const time = Date.parse(iso);
    if (!time) return 'Time unknown';
    const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };
  const exactTime = (iso) => {
    const time = Date.parse(iso);
    if (!time) return 'Time unknown';
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(new Date(time));
  };
  const addText = (parent, className, value) => {
    const element = document.createElement('span');
    element.className = className;
    element.textContent = value;
    parent.appendChild(element);
    return element;
  };
  const categorySlug = (category) => String(category || 'other-contractor').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const addIndustryBadge = (parent, category) => {
    const badge = addText(parent, `industry-badge industry-${categorySlug(category)}`, category || 'Other Opportunity');
    badge.setAttribute('aria-label', `Industry: ${category || 'Other Opportunity'}`);
  };
  const addConfidenceBadge = (parent, confidence) => {
    if (typeof confidence !== 'number' || confidence < 0 || confidence > 1) return;
    const percent = Math.round(confidence * 100);
    const level = percent >= 80 ? 'High' : percent >= 55 ? 'Medium' : 'Low';
    addText(parent, `confidence-badge confidence-${level.toLowerCase()}`, `${level} confidence · ${percent}%`);
  };
  const routedWebsite = (category) => ({
    Roofing: ['roofing', 'Roofing Contractor'], Flooring: ['flooring', 'Flooring Contractor'],
    Foundation: ['general-contractor', 'General Contractor'], Remodeling: ['general-contractor', 'General Contractor'],
    'General Contracting': ['general-contractor', 'General Contractor'], Concrete: ['general-contractor', 'General Contractor'],
    HVAC: ['hvac', 'HVAC Company'], Plumbing: ['plumbing', 'Plumbing Company'], Electrical: ['electrical', 'Electrical Contractor'],
    Painting: ['painting', 'Painting Contractor'], Landscaping: ['landscaping', 'Landscaping Company'], Restoration: ['restoration', 'Restoration Company'],
    'Real Estate': ['real-estate', 'Real Estate Pro'], Mortgage: ['real-estate', 'Real Estate Pro'], 'Home Buyer': ['real-estate', 'Real Estate Pro'], 'Home Seller': ['real-estate', 'Real Estate Pro'],
    Legal: ['law-firm', 'Law Firm Pro'], 'Personal Injury': ['law-firm', 'Law Firm Pro'], 'Family Law': ['law-firm', 'Law Firm Pro'], 'Criminal Defense': ['law-firm', 'Law Firm Pro'], 'Estate Planning': ['law-firm', 'Law Firm Pro'],
  }[category] || ['', `${category || 'Other'} Pro`]);
  const addTimestamps = (parent, lead) => {
    const times = document.createElement('div');
    times.className = 'lead-times';
    [['Found', lead.discoveredAt], ['Posted', lead.postedAt]].forEach(([label, iso]) => {
      const row = document.createElement('span');
      row.append(`${label} `);
      const relative = addText(row, 'lead-relative', relativeTime(iso));
      relative.dataset.relativeTime = iso || '';
      row.append(` · ${exactTime(iso)}`);
      times.appendChild(row);
    });
    parent.appendChild(times);
  };
  const addRoutingCue = (parent, lead) => {
    const destination = industryLabel || routedWebsite(lead.category)[1];
    const routing = document.createElement('div');
    routing.className = 'routing-cue';
    addText(routing, 'routing-detected', `Detected ${lead.category || 'Other Opportunity'}`);
    addText(routing, 'routing-arrow', '→');
    addText(routing, 'routing-destination', `Routed to ${destination}${industryLabel ? '' : ' Example Website'}`);
    addText(routing, 'routing-location', `Location: ${locationDisplay(lead)}`);
    parent.appendChild(routing);
  };
  const updateTimes = () => document.querySelectorAll('[data-relative-time]').forEach((element) => { element.textContent = relativeTime(element.dataset.relativeTime); });

  const renderTicker = () => {
    ticker.replaceChildren();
    if (!leads.length) return void addText(ticker, 'lead-empty', `No new ${industryLabel ? `${industryLabel} ` : ''}opportunities yet.`);
    const lead = leads[tickerIndex % leads.length];
    const meta = document.createElement('div');
    meta.className = 'lead-ticker-meta';
    addText(meta, 'lead-new', 'NEW LEAD');
    addIndustryBadge(meta, lead.category);
    addText(meta, 'lead-meta-item', lead.subreddit ? `r/${lead.subreddit}` : 'Reddit');
    addText(meta, 'lead-meta-item location-label', `Location: ${locationDisplay(lead)}`);
    addConfidenceBadge(meta, lead.classificationConfidence);
    ticker.appendChild(meta);
    const excerpt = document.createElement('p');
    excerpt.textContent = lead.excerpt || lead.title;
    ticker.appendChild(excerpt);
    addRoutingCue(ticker, lead);
    addTimestamps(ticker, lead);
  };
  const renderList = () => {
    list.replaceChildren();
    for (const lead of leads) {
      const item = document.createElement('article');
      item.className = 'lead-row';
      const content = document.createElement('div');
      const meta = document.createElement('div');
      meta.className = 'lead-row-meta';
      addIndustryBadge(meta, lead.category);
      addText(meta, '', `Location: ${locationDisplay(lead)}`);
      if (lead.subreddit) addText(meta, '', `r/${lead.subreddit}`);
      addConfidenceBadge(meta, lead.classificationConfidence);
      content.appendChild(meta);
      const title = document.createElement('h3');
      title.className = 'lead-title';
      title.textContent = lead.title || `${lead.category || 'Reddit'} opportunity`;
      content.appendChild(title);
      const excerpt = document.createElement('p');
      excerpt.textContent = lead.excerpt || lead.title;
      content.appendChild(excerpt);
      addRoutingCue(content, lead);
      addTimestamps(content, lead);
      item.appendChild(content);
      const actions = document.createElement('div');
      actions.className = 'lead-actions';
      if (root.hasAttribute('data-show-routing-links')) {
        const route = routedWebsite(lead.category);
        if (route[0]) {
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
        link.textContent = 'View original Reddit post';
        actions.appendChild(link);
      }
      if (actions.childElementCount) item.appendChild(actions);
      list.appendChild(item);
    }
  };
  const renderStats = (stats) => {
    if (!statsRoot) return;
    statsRoot.replaceChildren();
    const sessionNew = initialLeadIds ? leads.filter((lead) => !initialLeadIds.has(lead.id)).length : 0;
    const values = stats?.available === false
      ? [['Today', 'Unavailable'], ['This month', 'Unavailable'], ['New this session', sessionNew]]
      : [['Today', stats?.today ?? 0], ['This month', stats?.thisMonth ?? 0], ['New this session', sessionNew], ['Industries', stats?.industries ?? 0], ['Locations', stats?.locations ?? 0], ['Unknown locations', stats?.unknownLocations ?? 0]];
    values.forEach(([label, value]) => {
      const item = document.createElement('div');
      item.className = 'lead-stat';
      addText(item, 'lead-stat-value', value);
      addText(item, 'lead-stat-label', label);
      statsRoot.appendChild(item);
    });
    if (stats?.timezone) statsRoot.setAttribute('aria-label', `Opportunity statistics using ${stats.timezone}`);
  };
  const schedulePoll = () => { clearTimeout(pollTimer); pollTimer = setTimeout(load, document.hidden ? 90_000 : 20_000); };
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
      if (!initialLeadIds) initialLeadIds = new Set(payload.leads.map((lead) => lead.id));
      const nextSignature = payload.leads.map((lead) => lead.id).join('|');
      if (nextSignature !== signature) { leads = payload.leads; signature = nextSignature; tickerIndex = 0; renderTicker(); renderList(); }
      renderStats(payload.stats);
      clearInterval(tickerTimer);
      if (leads.length > 1) tickerTimer = setInterval(() => { tickerIndex = (tickerIndex + 1) % leads.length; renderTicker(); }, 6000);
      clearInterval(clockTimer);
      clockTimer = setInterval(updateTimes, 30_000);
    } catch (error) {
      root.hidden = false;
      status.textContent = 'Lead feed temporarily unavailable';
      status.classList.add('feed-error');
      if (!leads.length) ticker.textContent = 'We’ll resume showing opportunities when the feed reconnects.';
    } finally { if (!root.hidden) schedulePoll(); }
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !root.hidden) load(); });
  load();
})();
