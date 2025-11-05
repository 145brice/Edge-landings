// User storage using Vercel KV (Redis-based database)
// This persists across serverless function invocations
// Fallback to in-memory for local development

let kv;
try {
  // Try to use Vercel KV if available
  kv = require('@vercel/kv');
} catch (e) {
  console.warn('Vercel KV not available, using in-memory storage (data will not persist)');
  kv = null;
}

// In-memory fallback for local development
const memoryUsers = {};
const memoryTokens = {};

// Helper to check if KV is available
function hasKV() {
  return kv && process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;
}

module.exports = {
  // User management
  get: async (email) => {
    if (hasKV()) {
      try {
        const data = await kv.get(`user:${email}`);
        return data || null;
      } catch (error) {
        console.error('KV get error:', error);
        return memoryUsers[email] || null;
      }
    }
    return memoryUsers[email] || null;
  },

  set: async (email, userData) => {
    if (hasKV()) {
      try {
        await kv.set(`user:${email}`, userData);
        // Also store in a list for easy access
        await kv.sadd('users:all', email);
        return userData;
      } catch (error) {
        console.error('KV set error:', error);
        memoryUsers[email] = userData;
        return userData;
      }
    }
    memoryUsers[email] = userData;
    return userData;
  },

  exists: async (email) => {
    if (hasKV()) {
      try {
        const data = await kv.get(`user:${email}`);
        return data !== null;
      } catch (error) {
        console.error('KV exists error:', error);
        return !!memoryUsers[email];
      }
    }
    return !!memoryUsers[email];
  },

  getAll: async () => {
    if (hasKV()) {
      try {
        const emails = await kv.smembers('users:all');
        const users = {};
        for (const email of emails) {
          const data = await kv.get(`user:${email}`);
          if (data) {
            users[email] = data;
          }
        }
        return users;
      } catch (error) {
        console.error('KV getAll error:', error);
        return memoryUsers;
      }
    }
    return memoryUsers;
  },

  // Reset token management
  setResetToken: async (token, email, expiresAt) => {
    const tokenData = { email, expiresAt };
    if (hasKV()) {
      try {
        // Set with 1 hour expiry (3600 seconds)
        await kv.set(`token:${token}`, tokenData, { ex: 3600 });
        return tokenData;
      } catch (error) {
        console.error('KV setResetToken error:', error);
        memoryTokens[token] = tokenData;
        return tokenData;
      }
    }
    memoryTokens[token] = tokenData;
    return tokenData;
  },

  getResetToken: async (token) => {
    if (hasKV()) {
      try {
        const tokenData = await kv.get(`token:${token}`);
        if (!tokenData) return null;
        // Check if expired (KV handles expiry, but double-check)
        if (new Date() > new Date(tokenData.expiresAt)) {
          await kv.del(`token:${token}`);
          return null;
        }
        return tokenData;
      } catch (error) {
        console.error('KV getResetToken error:', error);
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
    if (hasKV()) {
      try {
        await kv.del(`token:${token}`);
      } catch (error) {
        console.error('KV deleteResetToken error:', error);
        delete memoryTokens[token];
      }
    } else {
      delete memoryTokens[token];
    }
  },
};
