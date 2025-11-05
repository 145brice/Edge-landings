# Database Setup for Edge Websites

## Vercel KV Database Setup

Your signup system now uses **Vercel KV** (Redis-based database) to store user accounts and passwords persistently.

### Setup Steps:

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Select your project: `edge-landings`

2. **Add Upstash (Redis) via Marketplace**
   - Click on your project: `edge-landings`
   - Go to the **Storage** tab (or **Integrations** tab)
   - Click **Browse Marketplace** or **Add Integration**
   - Find **"Upstash - Serverless DB (Redis, Vector, Queue, Search)"**
   - Click **Add** or **Install**
   - Select **Redis** (not Vector or Queue)
   - Name it (e.g., `edge-users`)
   - Select a region (choose closest to your users)
   - Click **Create** or **Add**
   
   **OR** use **"Redis - Serverless Redis"** - either will work!

3. **KV will Auto-Link to Your Project**
   - Vercel automatically links it to your project
   - Environment variables are automatically added:
     - `KV_REST_API_URL`
     - `KV_REST_API_TOKEN`

4. **Verify Environment Variables**
   - Go to **Settings** → **Environment Variables**
   - You should see:
     - `KV_REST_API_URL`
     - `KV_REST_API_TOKEN`
   - These are automatically set by Vercel

5. **Redeploy**
   - After adding KV, Vercel will automatically redeploy
   - Or manually trigger a redeploy from the Deployments tab
   - Wait for deployment to complete (1-2 minutes)

### What Gets Stored:

- **User Accounts**: Email, hashed password, Stripe customer ID, creation date
- **Password Reset Tokens**: Temporary tokens for password recovery
- **All signups**: Every user who creates an account

### Viewing Data:

You can view all signups in the Vercel dashboard:
- Go to **Storage** → Your KV database
- Browse the keys (they'll be prefixed with `user:` and `token:`)

### Important Notes:

- **Data persists** across deployments and serverless function invocations
- **Automatic cleanup**: Reset tokens expire after 1 hour
- **Security**: Passwords are hashed (SHA-256) before storage
- **Fallback**: If KV isn't configured, the system falls back to in-memory storage (data won't persist)

### Troubleshooting:

If signups aren't working:
1. Check that KV database is created and linked
2. Verify environment variables are set
3. Check deployment logs for errors
4. Ensure `@vercel/kv` package is installed (it's in package.json)

### Cost:

Vercel KV has a free tier:
- 256 MB storage
- 10,000 requests/day
- Perfect for getting started!

If you need more, upgrade to a paid plan.

