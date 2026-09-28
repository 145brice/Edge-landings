let cachedClient;

function client() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Pro automation storage is not configured.');
  if (cachedClient) return cachedClient;
  const { createClient } = require('@supabase/supabase-js');
  cachedClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return cachedClient;
}

async function growthProject(projectId) {
  const { data, error } = await client().from('client_projects').select('id,plan_slug,business_name,email,phone,intake,status').eq('id', projectId).maybeSingle();
  if (error) throw error;
  return data?.plan_slug === 'growth' ? data : null;
}

async function getSettings(projectId) {
  const { data, error } = await client().from('pro_automation_settings').select('*').eq('project_id', projectId).maybeSingle();
  if (error) throw error;
  return data;
}

async function findSettingsByTwilioPhone(phone) {
  const { data, error } = await client().from('pro_automation_settings').select('*').eq('twilio_phone', phone).eq('active', true).maybeSingle();
  if (error) throw error;
  return data;
}

async function saveSettings(projectId, settings) {
  const payload = { project_id: projectId, ...settings, updated_at: new Date().toISOString() };
  const { data, error } = await client().from('pro_automation_settings').upsert(payload, { onConflict: 'project_id' }).select('*').single();
  if (error) throw error;
  return data;
}

async function createReviewDraft(row) {
  const { data, error } = await client().from('pro_review_drafts').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

async function createMissedCall(row) {
  const { data, error } = await client().from('pro_missed_calls').upsert(row, { onConflict: 'twilio_call_sid', ignoreDuplicates: true }).select('*').maybeSingle();
  if (error) throw error;
  return data;
}

async function createLead(row) {
  const { data, error } = await client().from('pro_leads').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

async function createOutboundDraft(row) {
  const { data, error } = await client().from('pro_outbound_drafts').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

async function automationOverview() {
  const [settings, reviews, calls, leads, drafts] = await Promise.all([
    client().from('pro_automation_settings').select('*').order('updated_at', { ascending: false }),
    client().from('pro_review_drafts').select('*').order('created_at', { ascending: false }).limit(100),
    client().from('pro_missed_calls').select('*').order('received_at', { ascending: false }).limit(100),
    client().from('pro_leads').select('*').order('created_at', { ascending: false }).limit(200),
    client().from('pro_outbound_drafts').select('*').order('created_at', { ascending: false }).limit(200),
  ]);
  const failed = [settings, reviews, calls, leads, drafts].find((result) => result.error);
  if (failed) throw failed.error;
  return { settings: settings.data || [], reviews: reviews.data || [], calls: calls.data || [], leads: leads.data || [], drafts: drafts.data || [] };
}

async function getOutboundDraft(id) {
  const { data, error } = await client().from('pro_outbound_drafts').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function updateOutboundDraft(id, updates) {
  const { data, error } = await client().from('pro_outbound_drafts').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

async function updateReviewDraft(id, updates) {
  const { data, error } = await client().from('pro_review_drafts').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

async function updateLead(id, updates) {
  const { data, error } = await client().from('pro_leads').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

async function cancelLeadDrafts(leadId) {
  const { error } = await client().from('pro_outbound_drafts').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('lead_id', leadId).in('status', ['pending', 'approved', 'failed']);
  if (error) throw error;
}

async function approvedDueDrafts() {
  const { data, error } = await client().from('pro_outbound_drafts').select('*').eq('status', 'approved').lte('scheduled_for', new Date().toISOString()).order('scheduled_for').limit(50);
  if (error) throw error;
  return data || [];
}

async function checkHealth() {
  const { error } = await client().from('pro_automation_settings').select('project_id').limit(1);
  if (error) throw error;
  return true;
}

module.exports = { growthProject, getSettings, findSettingsByTwilioPhone, saveSettings, createReviewDraft, createMissedCall, createLead, createOutboundDraft, automationOverview, getOutboundDraft, updateOutboundDraft, updateReviewDraft, updateLead, cancelLeadDrafts, approvedDueDrafts, checkHealth };
