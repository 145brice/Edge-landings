// User storage using Supabase (PostgreSQL database)
// This persists across serverless function invocations
// Fallback to in-memory for local development

let supabase;
try {
  // Try to use Supabase if available
  const { createClient } = require('@supabase/supabase-js');
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  } else {
    supabase = null;
  }
} catch (e) {
  console.warn('Supabase not available, using in-memory storage (data will not persist)');
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
        // Try to insert, or update if exists
        const { error } = await supabase
          .from('users')
          .upsert({
            email: email,
            password_hash: userData.passwordHash,
            customer_id: userData.customerId,
            created_at: userData.createdAt || new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'email'
          });
        
        if (error) {
          console.error('Supabase set error:', error);
          memoryUsers[email] = userData;
          return userData;
        }
        return userData;
      } catch (error) {
        console.error('Supabase set error:', error);
        memoryUsers[email] = userData;
        return userData;
      }
    }
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
