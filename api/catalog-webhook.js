const crypto = require('crypto');
const { estimateRequest } = require('../lib/service-estimator');
const { refreshMarketBaselines } = require('../lib/market-baselines');

function authorized(req) {
  const expected = process.env.ESTIMATOR_WEBHOOK_SECRET || process.env.CRON_SECRET;
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!expected || !supplied || supplied.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

module.exports = async (req, res) => {
  if (!authorized(req)) return res.status(401).json({ error: 'Unauthorized.' });
  try {
    const store = require('../lib/catalog-store');
    const action = req.method === 'GET' ? 'refresh_baselines' : req.body?.action;
    if (action === 'estimate') {
      const request = req.body?.request || {};
      const result = estimateRequest(request, await store.listServices());
      await store.logEstimate(request, result);
      return res.json(result);
    }
    if (action === 'job_completed') {
      await store.logCompletedJob(req.body?.job || {});
      return res.status(202).json({ recorded: true });
    }
    if (action === 'refresh_baselines') {
      const rows = await refreshMarketBaselines();
      await store.saveBaselines(rows);
      return res.json({ refreshed: rows.length });
    }
    return res.status(400).json({ error: 'Unknown catalog action.' });
  } catch (error) {
    console.error('Catalog webhook error:', error.message);
    return res.status(500).json({ error: 'The pricing service is temporarily unavailable.' });
  }
};
