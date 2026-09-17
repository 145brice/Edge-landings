# Vercel Configuration Guide

## Environment Variables Needed

Your Vercel project needs these environment variables set in **Project Settings** (not just Production):

### Required Variables:
1. `STRIPE_SECRET_KEY` - Your Stripe secret key (starts with `sk_test_` or `sk_live_`)
2. `STRIPE_WEBHOOK_SECRET` - Your Stripe webhook secret (starts with `whsec_`)
3. `SUPABASE_URL` - Your Supabase project URL (if using Supabase)
4. `SUPABASE_KEY` - Your Supabase anon/service key (if using Supabase)

## How to Fix "Production Overrides" Warning

1. **Go to Vercel Dashboard:**
   - Navigate to your project: `edge-landings`
   - Click **Settings** → **Environment Variables**

2. **Set Variables for ALL Environments:**
   - Don't just set them for "Production"
   - Set them for: **Production, Preview, and Development**
   - This ensures local, preview, and production all work the same

3. **Remove Production Overrides:**
   - If you see variables only set for "Production", edit them
   - Click the environment dropdown and select **All Environments**
   - Save the changes

4. **Redeploy:**
   - After fixing environment variables, trigger a new deployment
   - The warning should disappear

## Current vercel.json

Your `vercel.json` is correctly configured to:
- Build all files in `api/**/*.js` as serverless functions
- Use `@vercel/node` runtime

## API Endpoints

All endpoints in `/api/` folder are automatically available:
- `/api/test` - Test endpoint
- `/api/login` - Login endpoint  
- `/api/signup` - Signup endpoint
- `/api/dashboard` - Dashboard endpoint
- `/api/forgot-password` - Password reset
- `/api/reset-password` - Password reset confirmation

## Next Steps

1. ✅ Check Vercel Dashboard → Settings → Environment Variables
2. ✅ Ensure all variables are set for ALL environments (not just Production)
3. ✅ Redeploy your project
4. ✅ Test `/api/test` endpoint

