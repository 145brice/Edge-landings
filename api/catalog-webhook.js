const crypto = require('crypto');
const { estimateRequest } = require('../lib/service-estimator');
const { refreshMarketBaselines } = require('../lib/market-baselines');

function authorized(req) {
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const allowed = req.method === 'GET' ? [process.env.CRON_SECRET] : [process.env.ESTIMATOR_WEBHOOK_SECRET, process.env.CRON_SECRET];
  return allowed.filter(Boolean).some((expected) => {
    if (!supplied || supplied.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
  });
}

function positiveInteger(value, field, { required = true } = {}) {
  if (!required && (value === undefined || value === null)) return null;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${field} must be a non-negative integer.`);
  return value;
}

function validateJob(input = {}) {
  const eventId = String(input.eventId || '').trim();
  const description = String(input.description || '').trim();
  const classification = String(input.classification || '').trim();
  const outcome = String(input.outcome || '').trim();
  if (!/^[a-zA-Z0-9_.:-]{8,128}$/.test(eventId)) throw new Error('job.eventId is required and must be 8-128 safe characters.');
  if (!description || description.length > 5000) throw new Error('job.description is required and must be at most 5,000 characters.');
  if (!['template', 'custom'].includes(classification)) throw new Error('job.classification must be template or custom.');
  if (!outcome || outcome.length > 100) throw new Error('job.outcome is required and must be at most 100 characters.');
  return {
    ...input, eventId, description, classification, outcome,
    finalPriceCents: positiveInteger(input.finalPriceCents, 'job.finalPriceCents'),
    quotedPriceCents: positiveInteger(input.quotedPriceCents, 'job.quotedPriceCents', { required: false }),
    estimatedDeliveryDays: positiveInteger(input.estimatedDeliveryDays, 'job.estimatedDeliveryDays', { required: false }),
    actualDeliveryDays: positiveInteger(input.actualDeliveryDays, 'job.actualDeliveryDays', { required: false }),
  };
}

module.exports = async (req, res) => {
  if (!['GET', 'POST'].includes(req.method)) return res.status(405).set('Allow', 'GET, POST').json({ error: 'Method not allowed.' });
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized.' });
  try {
    const store = require('../lib/catalog-store');
    const action = req.method === 'GET' ? 'refresh_baselines' : req.body?.action;
    if (action === 'estimate') {
      const request = req.body?.request || {};
      if (typeof request.description !== 'string' || !request.description.trim() || request.description.trim().length > 5000) return res.status(400).json({ error: 'A request description of at most 5,000 characters is required.' });
      const result = estimateRequest(request, await store.listServices());
      await store.logEstimate(request, result);
      return res.json(result);
    }
    if (action === 'job_completed') {
      const recorded = await store.logCompletedJob(validateJob(req.body?.job));
      return res.status(recorded ? 201 : 200).json({ recorded, duplicate: !recorded });
    }
    if (action === 'refresh_baselines') {
      const { rows, errors } = await refreshMarketBaselines();
      await store.saveBaselines(rows);
      return res.status(rows.length ? 200 : 502).json({ refreshed: rows.length, sourceFailures: errors });
    }
    return res.status(400).json({ error: 'Unknown catalog action.' });
  } catch (error) {
    console.error('Catalog webhook error:', error.message);
    if (/required|must be|at most|non-negative/i.test(error.message)) return res.status(400).json({ error: error.message });
    return res.status(500).json({ error: 'The pricing service is temporarily unavailable.' });
  }
};

module.exports.authorized = authorized;
module.exports.validateJob = validateJob;
