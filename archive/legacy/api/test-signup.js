const users = require('./users');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    // Test if we can save to Supabase
    const testEmail = `test_${Date.now()}@test.com`;
    const testData = {
      email: testEmail,
      passwordHash: 'test_hash',
      customerId: null,
      createdAt: new Date().toISOString(),
    };

    console.log('Attempting to save test user:', testEmail);
    await users.set(testEmail, testData);
    
    console.log('Save completed, now trying to retrieve...');
    const retrieved = await users.get(testEmail);
    
    console.log('Retrieved user:', retrieved);

    res.json({
      success: true,
      saved: !!retrieved,
      user: retrieved,
      hasSupabase: !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY),
      supabaseUrl: process.env.SUPABASE_URL ? 'Set' : 'Not set',
    });
  } catch (error) {
    console.error('Test signup error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
};

