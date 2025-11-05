# Database Setup for Edge Websites

## Vercel KV Database Setup

Your signup system now uses **Vercel KV** (Redis-based database) to store user accounts and passwords persistently.

### Setup Steps:

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Select your project: `edge-landings`

2. **Create KV Database**
   - Go to **Storage** tab
   - Click **Create Database**
   - Select **KV** (Redis)
   - Name it (e.g., `edge-users`)
   - Select a region (choose closest to your users)
   - Click **Create**

3. **Link KV to Your Project**
   - After creating, click **Use KV in your project**
   - Select your `edge-landings` project
   - Vercel will automatically add environment variables

4. **Verify Environment Variables**
   - Go to **Settings** → **Environment Variables**
   - You should see:
     - `KV_REST_API_URL`
     - `KV_REST_API_TOKEN`
   - These are automatically set by Vercel

5. **Redeploy**
   - After linking KV, Vercel will automatically redeploy
   - Or manually trigger a redeploy from the Deployments tab

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

