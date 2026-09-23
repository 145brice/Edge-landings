let cachedClient;

function client() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Client portal storage is not configured.');
  }
  if (cachedClient) return cachedClient;
  const { createClient } = require('@supabase/supabase-js');
  cachedClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

async function createProject(project) {
  const { data, error } = await client().from('client_projects').insert(project).select('*').single();
  if (error) throw error;
  return data;
}

async function getProjectByTokenHash(portalTokenHash) {
  const { data, error } = await client().from('client_projects').select('*').eq('portal_token_hash', portalTokenHash).maybeSingle();
  if (error) throw error;
  return data;
}

async function getProjectById(id) {
  const { data, error } = await client().from('client_projects').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

async function listRequests(projectId) {
  const { data, error } = await client().from('client_change_requests').select('id,section_key,section_label,request_type,details,status,created_at').eq('project_id', projectId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function listMessages(projectId) {
  const { data, error } = await client().from('client_project_messages').select('id,sender,category,body,section_key,created_at').eq('project_id', projectId).order('created_at');
  if (error) throw error;
  return data || [];
}

async function addMessage(message) {
  const { data, error } = await client().from('client_project_messages').insert(message).select('id,sender,category,body,section_key,created_at').single();
  if (error) throw error;
  return data;
}

async function addRequest(request) {
  const { data, error } = await client().from('client_change_requests').insert(request).select('id,section_key,section_label,request_type,details,status,created_at').single();
  if (error) throw error;
  return data;
}

async function updateRequest(id, projectId, updates) {
  const { data, error } = await client().from('client_change_requests').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).eq('project_id', projectId).select('id,section_key,section_label,request_type,details,status,created_at').single();
  if (error) throw error;
  return data;
}

async function updateProject(id, updates) {
  const { data, error } = await client().from('client_projects').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

async function listProjects() {
  const { data, error } = await client().from('client_projects').select('id,business_name,client_name,email,plan_slug,status,preview_url,sections,created_at,updated_at,approved_at,paid_at').order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return data || [];
}

async function listAllRequests() {
  const { data, error } = await client().from('client_change_requests').select('id,project_id,section_key,section_label,request_type,details,status,created_at').order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  return data || [];
}

async function getProjectsByEmail(email) {
  const { data, error } = await client().from('client_projects').select('id,business_name,email').eq('email', email).order('created_at', { ascending: false }).limit(10);
  if (error) throw error;
  return data || [];
}

module.exports = { createProject, getProjectByTokenHash, getProjectById, getProjectsByEmail, listRequests, listAllRequests, addRequest, updateRequest, listMessages, addMessage, updateProject, listProjects };
