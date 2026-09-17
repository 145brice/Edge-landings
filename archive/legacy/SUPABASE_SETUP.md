# Supabase Database Setup for Edge Websites

✅ Database tables created successfully!

## Quick Setup

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Select your project: `edge-landings`

2. **Add Supabase via Marketplace**
   - Go to **Storage** or **Integrations** tab
   - Click **Browse Marketplace**
   - Find **"Supabase - Postgres backend"**
   - Click **Add** or **Install**
   - Follow the setup wizard
   - Vercel will automatically add environment variables:
     - `SUPABASE_URL`
     - `SUPABASE_KEY`

3. **Create Database Tables in Supabase**
   
   After Supabase is added, you need to create the tables:
   
   - Go to your Supabase dashboard: https://supabase.com/dashboard
   - Select your project
   - Go to **SQL Editor**
   - Run this SQL to create the tables:

```sql
-- Create users table
CREATE TABLE IF NOT EXISTS users (
  email TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create reset_tokens table
CREATE TABLE IF NOT EXISTS reset_tokens (
  token TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires ON reset_tokens(expires_at);
```

4. **Set Row Level Security (RLS)**
   
   In Supabase dashboard, go to **Authentication** → **Policies**:
   
   - For `users` table: Allow server-side access only (your API key will handle this)
   - You can disable RLS for these tables since they're accessed via server-side API only
   
   Or run this SQL:
```sql
-- Disable RLS for service role access (your API uses service role key)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE reset_tokens DISABLE ROW LEVEL SECURITY;
```

5. **Get Your Supabase Credentials**
   
   In Supabase dashboard:
   - Go to **Settings** → **API**
   - Copy:
     - **Project URL** → This is your `SUPABASE_URL`
     - **service_role key** (secret) → This is your `SUPABASE_KEY`
   
   **Important**: Use the `service_role` key (not the `anon` key) for server-side operations!

6. **Add to Vercel Environment Variables**
   
   If Vercel didn't auto-add them:
   - Go to Vercel → Your project → **Settings** → **Environment Variables**
   - Add:
     - `SUPABASE_URL` = Your project URL
     - `SUPABASE_KEY` = Your service_role key (secret)

7. **Redeploy**
   - Vercel will auto-redeploy, or trigger manually
   - Wait for deployment to complete

## What Gets Stored:

- **User Accounts**: Email, hashed password, Stripe customer ID, creation date
- **Password Reset Tokens**: Temporary tokens for password recovery
- **All signups**: Every user who creates an account

## Viewing Signups:

You can view all signups in Supabase:
- Go to Supabase Dashboard → Your project
- Click **Table Editor**
- View the `users` table
- See all signups with email, creation date, customer ID

## Benefits of Supabase:

✅ **Full PostgreSQL database** - More powerful than Redis  
✅ **Easy to view data** - Table editor in Supabase dashboard  
✅ **Free tier** - 500 MB database, 2 GB bandwidth  
✅ **Automatic backups** - Data is safe  
✅ **Easy to query** - Can run SQL queries  

## Troubleshooting:

If signups aren't working:
1. Check that tables are created in Supabase
2. Verify environment variables are set in Vercel
3. Check deployment logs for errors
4. Ensure `@supabase/supabase-js` package is installed (it's in package.json)
5. Make sure you're using the `service_role` key (not `anon` key)

## Cost:

Supabase has a generous free tier:
- 500 MB database storage
- 2 GB bandwidth
- Perfect for getting started!

If you need more, upgrade to a paid plan.

