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
    
    // Try to test the connection
    let connectionTest = false;
    if (hasSupabase) {
      try {
        // Try a simple query to test connection
        const testResult = await users.get('__test__');
        connectionTest = true; // If no error, connection works
      } catch (error) {
        connectionTest = false;
      }
    }

    res.json({
      supabaseConfigured: hasSupabase,
      supabaseUrl: process.env.SUPABASE_URL ? 'Set' : 'Not set',
      supabaseKey: process.env.SUPABASE_KEY ? 'Set' : 'Not set',
      connectionTest: connectionTest,
      status: hasSupabase ? (connectionTest ? 'Connected' : 'Configured but connection failed') : 'Not configured - using in-memory storage'
    });
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      supabaseConfigured: false
    });
  }
};

