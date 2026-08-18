function client() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Catalog storage is not configured.');
  }
  const { createClient } = require('@supabase/supabase-js');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function listServices() {
  const { data, error } = await client().from('service_catalog').select('*').eq('active', true).order('name');
  if (error) throw error;
  return data;
}

async function logEstimate(request, result) {
  const { error } = await client().from('estimate_events').insert({
    request_text: request.description,
    requested_service: request.serviceName || null,
    classification: result.classification,
    service_id: result.serviceId,
    suggested_min_cents: result.suggestedRangeCents.min,
    suggested_max_cents: result.suggestedRangeCents.max,
    quoted_price_cents: result.fixedPriceCents,
    confidence: result.confidence,
    manual_review: result.manualReview,
  });
  if (error) throw error;
}

async function logCompletedJob(job) {
  const db = client();
  const { error } = await db.from('completed_jobs').insert({
    service_id: job.serviceId || null,
    request_text: job.description,
    classification: job.classification,
    quoted_price_cents: job.quotedPriceCents,
    final_price_cents: job.finalPriceCents,
    estimated_delivery_days: job.estimatedDeliveryDays,
    actual_delivery_days: job.actualDeliveryDays,
    outcome: job.outcome,
    completed_at: job.completedAt || new Date().toISOString(),
  });
  if (error) throw error;
  if (job.serviceId) await updateRangeFromActualJobs(db, job.serviceId);
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * fraction)];
}

function blendedRange(actualPrices, marketLow, marketHigh) {
  const actualLow = percentile(actualPrices, 0.25);
  const actualHigh = percentile(actualPrices, 0.75);
  if (actualLow === null) return null;
  // Internal outcomes deliberately carry 80% of the estimate; external data
  // is only a guardrail while Edge Landings builds its own history.
  return {
    min: Math.round((actualLow * 0.8) + ((marketLow ?? actualLow) * 0.2)),
    max: Math.round((actualHigh * 0.8) + ((marketHigh ?? actualHigh) * 0.2)),
  };
}

async function updateRangeFromActualJobs(db, serviceId) {
  const [{ data: jobs, error: jobsError }, { data: baselines, error: baselineError }] = await Promise.all([
    db.from('completed_jobs').select('final_price_cents').eq('service_id', serviceId).order('completed_at', { ascending: false }).limit(100),
    db.from('market_baselines').select('low_cents,high_cents'),
  ]);
  if (jobsError) throw jobsError;
  if (baselineError) throw baselineError;
  const lows = (baselines || []).map((row) => row.low_cents);
  const highs = (baselines || []).map((row) => row.high_cents);
  const range = blendedRange((jobs || []).map((row) => row.final_price_cents), percentile(lows, 0.5), percentile(highs, 0.5));
  if (!range) return;
  const { error } = await db.from('service_catalog').update({ suggested_min_cents: range.min, suggested_max_cents: Math.max(range.min, range.max), updated_at: new Date().toISOString() }).eq('id', serviceId);
  if (error) throw error;
}

async function saveBaselines(rows) {
  const db = client();
  const { error } = await db.from('market_baselines').upsert(rows, { onConflict: 'source_url,metric' });
  if (error) throw error;
  const priceMap = JSON.parse(process.env.STRIPE_PRICE_MAP || '{}');
  for (const [slug, priceId] of Object.entries(priceMap)) {
    const { error: updateError } = await db.from('service_catalog').update({ price_id: priceId, updated_at: new Date().toISOString() }).eq('slug', slug);
    if (updateError) throw updateError;
  }
}

module.exports = { listServices, logEstimate, logCompletedJob, saveBaselines, blendedRange };
