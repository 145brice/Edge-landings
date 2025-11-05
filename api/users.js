// Shared user storage module
// In production, replace this with a database (MongoDB, PostgreSQL, Vercel KV, etc.)
// For now, this uses a simple in-memory store that will reset on serverless function cold starts
// Consider using Vercel KV or a database for persistent storage

const users = {};

module.exports = {
  get: (email) => users[email],
  set: (email, userData) => {
    users[email] = userData;
    return users[email];
  },
  exists: (email) => !!users[email],
  all: () => users,
};

