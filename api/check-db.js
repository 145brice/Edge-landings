const users = require('./users');

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const hasSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY;
    let connectionTest = false;
    let testError = null;
    let keyFormat = 'unknown';
    let urlFormat = 'unknown';
    
    // Check key format
    if (process.env.SUPABASE_KEY) {
      const key = String(process.env.SUPABASE_KEY).trim();
      if (key.startsWith('eyJ')) {
        keyFormat = '✅ JWT format (correct)';
      } else if (key.length > 50) {
        keyFormat = '⚠️ Long string (might be correct)';
      } else {
        keyFormat = '❌ Short string (likely wrong - should be long JWT)';
      }
    }
    
    // Check URL format
    if (process.env.SUPABASE_URL) {
      const url = String(process.env.SUPABASE_URL).trim();
      if (url.startsWith('https://') && url.includes('.supabase.co')) {
        urlFormat = '✅ Valid format';
      } else {
        urlFormat = '❌ Invalid format (should be https://xxxxx.supabase.co)';
      }
    }
    
    if (hasSupabase) {
      try {
        // Try to test the connection with a simple query
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(
          process.env.SUPABASE_URL.trim(),
          process.env.SUPABASE_KEY.trim(),
          { auth: { persistSession: false } }
        );
        
        // Try to query the users table
        const { data, error } = await supabase
          .from('users')
          .select('email')
          .limit(1);
        
        if (error) {
          testError = error.message;
          if (error.message.includes('API key') || error.code === 'PGRST301') {
            testError = 'Invalid API key - Make sure you\'re using the service_role key (not anon key)';
          } else if (error.message.includes('relation') || error.code === '42P01') {
            testError = 'Table "users" does not exist - Run create-tables.sql in Supabase SQL Editor';
          } else if (error.message.includes('permission') || error.code === '42501') {
            testError = 'Permission denied - Disable RLS: ALTER TABLE users DISABLE ROW LEVEL SECURITY;';
          }
        } else {
          connectionTest = true;
        }
      } catch (error) {
        testError = error.message;
      }
    }

    res.json({
      supabaseConfigured: hasSupabase,
      supabaseUrl: process.env.SUPABASE_URL ? `✅ Set (${urlFormat})` : '❌ Not set',
      supabaseKey: process.env.SUPABASE_KEY ? `✅ Set (${keyFormat})` : '❌ Not set',
      connectionTest: connectionTest,
      testError: testError,
      status: hasSupabase ? (connectionTest ? '✅ Connected - Database is working!' : `⚠️ Connection failed: ${testError || 'Unknown error'}`) : '❌ Not configured - using in-memory storage (data will not persist)',
      message: hasSupabase && connectionTest ? 'Your signups are being saved to the database!' : (hasSupabase ? `Issue: ${testError || 'Check your Supabase credentials'}` : 'Add SUPABASE_URL and SUPABASE_KEY to Vercel'),
      instructions: !hasSupabase ? 'Go to Vercel → Settings → Environment Variables and add SUPABASE_URL and SUPABASE_KEY' : (!connectionTest ? '1. Get service_role key from Supabase Settings → API\n2. Make sure table exists (run create-tables.sql)\n3. Disable RLS: ALTER TABLE users DISABLE ROW LEVEL SECURITY;' : 'Everything looks good!')
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      supabaseConfigured: false
    });
  }
};
