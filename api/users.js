// User storage using Supabase (PostgreSQL database)
// This persists across serverless function invocations
// Fallback to in-memory for local development

let supabase;
try {
  // Try to use Supabase if available
  const { createClient } = require('@supabase/supabase-js');
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    // Ensure URLs and keys are properly encoded
    const url = String(process.env.SUPABASE_URL).trim();
    const key = String(process.env.SUPABASE_KEY).trim();
    supabase = createClient(url, key, {
      auth: {
        persistSession: false
      }
    });
  } else {
    supabase = null;
  }
} catch (e) {
  console.warn('Supabase not available, using in-memory storage (data will not persist)');
  console.error('Supabase init error:', e.message);
  supabase = null;
}

// In-memory fallback for local development
const memoryUsers = {};
const memoryTokens = {};

// Helper to check if Supabase is available
function hasSupabase() {
  return supabase !== null && process.env.SUPABASE_URL && process.env.SUPABASE_KEY;
}

module.exports = {
  // User management
  get: async (email) => {
    if (hasSupabase()) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('email', email)
          .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 = not found
          console.error('Supabase get error:', error);
          return memoryUsers[email] || null;
        }
        return data || null;
      } catch (error) {
        console.error('Supabase get error:', error);
        return memoryUsers[email] || null;
      }
    }
    return memoryUsers[email] || null;
  },

  set: async (email, userData) => {
    if (hasSupabase()) {
      try {
        // Sanitize data to ensure valid UTF-8 encoding
        const sanitizedData = {
          email: String(email).trim(),
          password_hash: String(userData.passwordHash || ''),
          customer_id: userData.customerId ? String(userData.customerId).trim() : null,
          created_at: userData.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Try to insert, or update if exists
        const { data, error } = await supabase
          .from('users')
          .upsert(sanitizedData, {
            onConflict: 'email'
          });
        
        if (error) {
          console.error('❌ Supabase set error:', JSON.stringify(error, null, 2));
          console.error('Error details:', error.message, error.code, error.details);
          // Don't fall back to memory - throw the error so signup knows it failed
          throw new Error(`Database save failed: ${error.message}`);
        }
        
        console.log('✅ User saved to Supabase:', email);
        return userData;
      } catch (error) {
        console.error('❌ Supabase set exception:', error.message);
        console.error('Stack:', error.stack);
        // Re-throw so signup API can handle it
        throw error;
      }
    }
    console.warn('⚠️ Supabase not available, saving to memory (will not persist)');
    memoryUsers[email] = userData;
    return userData;
  },

  exists: async (email) => {
    if (hasSupabase()) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('email')
          .eq('email', email)
          .single();
        
        if (error && error.code !== 'PGRST116') {
          console.error('Supabase exists error:', error);
          return !!memoryUsers[email];
        }
        return data !== null;
      } catch (error) {
        console.error('Supabase exists error:', error);
        return !!memoryUsers[email];
      }
    }
    return !!memoryUsers[email];
  },

  getAll: async () => {
    if (hasSupabase()) {
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Supabase getAll error:', error);
          return memoryUsers;
        }
        
        // Convert to expected format
        const users = {};
        if (data) {
          data.forEach(user => {
            users[user.email] = {
              email: user.email,
              passwordHash: user.password_hash,
              customerId: user.customer_id,
              createdAt: user.created_at
            };
          });
        }
        return users;
      } catch (error) {
        console.error('Supabase getAll error:', error);
        return memoryUsers;
      }
    }
    return memoryUsers;
  },

  // Reset token management
  setResetToken: async (token, email, expiresAt) => {
    const tokenData = { email, expiresAt };
    if (hasSupabase()) {
      try {
        const { error } = await supabase
          .from('reset_tokens')
          .upsert({
            token: token,
            email: email,
            expires_at: expiresAt
          }, {
            onConflict: 'token'
          });
        
        if (error) {
          console.error('Supabase setResetToken error:', error);
          memoryTokens[token] = tokenData;
          return tokenData;
        }
        return tokenData;
      } catch (error) {
        console.error('Supabase setResetToken error:', error);
        memoryTokens[token] = tokenData;
        return tokenData;
      }
    }
    memoryTokens[token] = tokenData;
    return tokenData;
  },

  getResetToken: async (token) => {
    if (hasSupabase()) {
      try {
        const { data, error } = await supabase
          .from('reset_tokens')
          .select('*')
          .eq('token', token)
          .single();
        
        if (error || !data) {
          return null;
        }
        
        // Check if expired
        if (new Date() > new Date(data.expires_at)) {
          await supabase.from('reset_tokens').delete().eq('token', token);
          return null;
        }
        
        return {
          email: data.email,
          expiresAt: data.expires_at
        };
      } catch (error) {
        console.error('Supabase getResetToken error:', error);
        const tokenData = memoryTokens[token];
        if (!tokenData) return null;
        if (new Date() > new Date(tokenData.expiresAt)) {
          delete memoryTokens[token];
          return null;
        }
        return tokenData;
      }
    }
    const tokenData = memoryTokens[token];
    if (!tokenData) return null;
    if (new Date() > new Date(tokenData.expiresAt)) {
      delete memoryTokens[token];
      return null;
    }
    return tokenData;
  },

  deleteResetToken: async (token) => {
    if (hasSupabase()) {
      try {
        await supabase.from('reset_tokens').delete().eq('token', token);
      } catch (error) {
        console.error('Supabase deleteResetToken error:', error);
        delete memoryTokens[token];
      }
    } else {
      delete memoryTokens[token];
    }
  },
};
