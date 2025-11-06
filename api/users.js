// User storage using Supabase (PostgreSQL database)
// This persists across serverless function invocations
// Fallback to in-memory for local development

let supabase;
try {
  // Try to use Supabase if available
  const { createClient } = require('@supabase/supabase-js');
  if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
    // Clean and validate URL - ensure it's pure ASCII
    let url = String(process.env.SUPABASE_URL).trim();
    // Remove any non-ASCII characters from URL (shouldn't be any, but be safe)
    url = url.replace(/[^\x00-\x7F]/g, '');
    
    // Clean and validate key - ensure it's pure ASCII
    let key = String(process.env.SUPABASE_KEY).trim();
    // Remove any non-ASCII characters from key (shouldn't be any, but be safe)
    key = key.replace(/[^\x00-\x7F]/g, '');
    
    // Validate URL format
    if (!url.startsWith('https://') || !url.includes('.supabase.co')) {
      throw new Error('Invalid Supabase URL format. Should be: https://xxxxx.supabase.co');
    }
    
    // Validate key format (new format: sb_secret_... or old format: eyJ...)
    if (!key.startsWith('eyJ') && !key.startsWith('sb_secret_')) {
      console.warn('⚠️ Supabase key should start with "eyJ" (old JWT format) or "sb_secret_" (new format). Make sure you\'re using the secret key, not the publishable key.');
      console.warn('⚠️ Key length:', key.length, 'characters');
      console.warn('⚠️ Key preview:', key.substring(0, 20) + '...');
    }
    
    // Log URL and key length for debugging (don't log actual values)
    console.log('🔧 Supabase config:', {
      urlLength: url.length,
      urlFormat: url.startsWith('https://') && url.includes('.supabase.co') ? 'valid' : 'invalid',
      keyLength: key.length,
      keyFormat: key.startsWith('eyJ') ? 'JWT (old)' : (key.startsWith('sb_secret_') ? 'Secret (new)' : 'unknown')
    });
    
    try {
      supabase = createClient(url, key, {
        auth: {
          persistSession: false
        }
      });
      console.log('✅ Supabase client initialized');
    } catch (initError) {
      console.error('❌ Failed to create Supabase client:', initError.message);
      throw initError;
    }
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
        // Aggressive sanitization to ensure only ASCII characters
        // This prevents encoding issues with Supabase/PostgreSQL
        const sanitizeString = (str) => {
          if (!str) return null;
          // Convert to string and trim
          let sanitized = String(str).trim();
          
          // Replace all problematic Unicode characters
          sanitized = sanitized
            .replace(/[\u2013\u2014\u2015]/g, '-') // Em/en dashes → dash
            .replace(/[\u2018\u2019]/g, "'") // Smart single quotes → apostrophe
            .replace(/[\u201C\u201D]/g, '"') // Smart double quotes → regular quotes
            .replace(/[\u2026]/g, '...') // Ellipsis → three dots
            .replace(/[\u00A0]/g, ' ') // Non-breaking space → regular space
            .normalize('NFD') // Decompose characters
            .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
            .replace(/[^\x00-\x7F]/g, ''); // Remove any remaining non-ASCII
          
          return sanitized;
        };
        
        // Sanitize email (should already be ASCII, but be safe)
        const sanitizedEmail = sanitizeString(email);
        
        // Password hash should be base64, but ensure it's clean
        const passwordHash = String(userData.passwordHash || '').trim();
        // Base64 should only contain A-Z, a-z, 0-9, +, /, = - verify and clean
        if (!/^[A-Za-z0-9+/=]+$/.test(passwordHash)) {
          console.warn('⚠️ Password hash contains unexpected characters, cleaning...');
          // If it's not valid base64, something is wrong - but try to save what we can
          const cleanedHash = passwordHash.replace(/[^A-Za-z0-9+/=]/g, '');
          if (cleanedHash.length < passwordHash.length * 0.9) {
            throw new Error('Password hash appears corrupted');
          }
        }
        
        const sanitizedData = {
          email: sanitizedEmail,
          password_hash: passwordHash, // Keep as-is if it's valid base64
          customer_id: userData.customerId ? sanitizeString(userData.customerId) : null,
          created_at: userData.createdAt || new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Validate required fields
        if (!sanitizedData.email || !sanitizedData.password_hash) {
          throw new Error('Email and password_hash are required');
        }
        
        // Log what we're about to save (without sensitive data)
        console.log('💾 Attempting to save user:', {
          email: sanitizedData.email,
          hasPassword: !!sanitizedData.password_hash,
          passwordLength: sanitizedData.password_hash.length,
          hasCustomerId: !!sanitizedData.customer_id
        });
        
        // Try to insert, or update if exists
        const { data, error } = await supabase
          .from('users')
          .upsert(sanitizedData, {
            onConflict: 'email'
          });
        
        if (error) {
          console.error('❌ Supabase set error:', JSON.stringify(error, null, 2));
          console.error('Error details:', error.message, error.code, error.details);
          console.error('Error hint:', error.hint);
          console.error('Attempted data (sanitized):', {
            email: sanitizedData.email,
            passwordHashLength: sanitizedData.password_hash.length,
            customerId: sanitizedData.customer_id
          });
          
          // Provide helpful error messages
          if (error.message.includes('API key') || error.code === 'PGRST301') {
            throw new Error('Invalid API key. Make sure you\'re using the SECRET key (sb_secret_...) from Supabase Settings → API → Secret keys, NOT the publishable key. Steps: 1) Go to Supabase Dashboard → Settings → API → API Keys, 2) Find "Secret keys" section, 3) Copy the secret key (starts with sb_secret_), 4) Paste it into Vercel → Settings → Environment Variables → SUPABASE_KEY, 5) Make sure it\'s set for Production, Preview, and Development, 6) Save and redeploy.');
          }
          if (error.message.includes('relation') || error.code === '42P01') {
            throw new Error('Table "users" does not exist. Run the SQL in create-tables.sql in your Supabase SQL Editor.');
          }
          if (error.message.includes('permission') || error.code === '42501') {
            throw new Error('Permission denied. Make sure RLS is disabled: ALTER TABLE users DISABLE ROW LEVEL SECURITY;');
          }
          if (error.message.includes('ByteString') || error.message.includes('character at index')) {
            throw new Error('Character encoding error. This usually means there are special characters in the data. Check your email or customer_id for em dashes, smart quotes, or other special characters.');
          }
          
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
