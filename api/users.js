// Shared user storage module
// In production, replace this with a database (MongoDB, PostgreSQL, Vercel KV, etc.)
// For now, this uses a simple in-memory store that will reset on serverless function cold starts
// Consider using Vercel KV or a database for persistent storage

const users = {};
const resetTokens = {}; // Store reset tokens: { token: { email, expiresAt } }

module.exports = {
  get: (email) => users[email],
  set: (email, userData) => {
    users[email] = userData;
    return users[email];
  },
  exists: (email) => !!users[email],
  all: () => users,
  // Reset token management
  setResetToken: (token, email, expiresAt) => {
    resetTokens[token] = { email, expiresAt };
    return resetTokens[token];
  },
  getResetToken: (token) => {
    const tokenData = resetTokens[token];
    if (!tokenData) return null;
    // Check if token expired
    if (new Date() > new Date(tokenData.expiresAt)) {
      delete resetTokens[token];
      return null;
    }
    return tokenData;
  },
  deleteResetToken: (token) => {
    delete resetTokens[token];
  },
};

