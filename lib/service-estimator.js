const TEMPLATE_SIGNALS = ['landing page', 'brochure', 'template', 'website care', 'maintenance'];
const CUSTOM_SIGNALS = ['custom', 'ecommerce', 'e-commerce', 'portal', 'dashboard', 'membership', 'integration', 'api', 'booking'];

function normalizeRequest(input = {}) {
  const description = String(input.description || '').trim();
  const serviceName = String(input.serviceName || '').trim();
  return { description, serviceName, text: `${serviceName} ${description}`.toLowerCase() };
}

function money(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
}

function scoreService(service, text) {
  const terms = [service.name, service.slug, ...(service.keywords || [])]
    .flatMap((value) => String(value || '').toLowerCase().split(/[^a-z0-9]+/))
    .filter((term) => term.length > 2);
  return [...new Set(terms)].reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
}

function estimateRequest(input, services) {
  const request = normalizeRequest(input);
  if (!request.description) throw new Error('A plain-language request description is required.');
  const ranked = services.map((service) => ({ service, score: scoreService(service, request.text) }))
    .sort((a, b) => b.score - a.score);
  const match = ranked[0];
  const customSignals = CUSTOM_SIGNALS.filter((signal) => request.text.includes(signal));
  const templateSignals = TEMPLATE_SIGNALS.filter((signal) => request.text.includes(signal));
  const classification = customSignals.length ? 'custom' : 'template';
  let confidence = Math.max(0.25, Math.min(0.98,
    0.42 + ((match?.score || 0) * 0.12) + (classification === 'template' ? templateSignals.length * 0.07 : customSignals.length * 0.06)
  ));
  // Feature words can identify custom work without proving that it matches a
  // catalog service. Never auto-quote an unmatched request.
  if (!match?.score) confidence = Math.min(confidence, 0.65);
  const service = match?.service;
  const manualReview = !service || confidence < 0.7 || (classification === 'template' && !service.price_id);
  const low = service?.suggested_min_cents || 0;
  const high = service?.suggested_max_cents || 0;

  return {
    classification,
    serviceId: service?.id || null,
    serviceName: service?.name || 'Custom website work',
    priceId: classification === 'template' && !manualReview ? service.price_id : null,
    fixedPriceCents: classification === 'template' && !manualReview ? service.actual_price_cents : null,
    suggestedRangeCents: { min: low, max: high },
    estimatedDeliveryDays: service?.estimated_delivery_days || null,
    confidence: Number(confidence.toFixed(2)),
    manualReview,
    customerMessage: manualReview
      ? `This request needs a quick manual review. The expected range is ${money(low)}–${money(high)}.`
      : classification === 'template'
        ? `${service.name} is ${money(service.actual_price_cents)} and is usually delivered in ${service.estimated_delivery_days} business days.`
        : `This is custom work. The expected range is ${money(low)}–${money(high)}; we will confirm the final price after review.`,
  };
}

module.exports = { estimateRequest, normalizeRequest, scoreService };
