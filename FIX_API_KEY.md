# Fix "Invalid API key" Error

## The Problem:
You're getting "Invalid API key" which means either:
1. You're using the **anon key** instead of the **service_role key**
2. The key got corrupted when copying/pasting
3. The key isn't set in Vercel environment variables

## Step-by-Step Fix:

### 1. Get the Correct Key from Supabase:
1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **API**
4. Scroll down to find **"service_role"** (NOT "anon" or "service_role key")
5. Click **"Reveal"** or the eye icon to show the key
6. **Copy the entire key** - it should be a very long string starting with `eyJ...`

### 2. Verify the Key Format:
- ✅ Should start with `eyJ` (JWT format)
- ✅ Should be very long (hundreds of characters)
- ✅ Should NOT have any spaces, line breaks, or special characters
- ❌ If it's short or doesn't start with `eyJ`, you have the wrong key

### 3. Update Vercel Environment Variables:
1. Go to [Vercel Dashboard](https://vercel.com)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Find `SUPABASE_KEY`
5. **Delete the old value** (click the X or edit)
6. **Paste the service_role key** you just copied from Supabase
7. Make sure it's set for:
   - ✅ Production
   - ✅ Preview  
   - ✅ Development
8. **Save**

### 4. Verify SUPABASE_URL:
While you're in Vercel environment variables, also check `SUPABASE_URL`:
- Should be: `https://xxxxx.supabase.co`
- Get it from Supabase Dashboard → Settings → API → Project URL
- Make sure there are no extra spaces or characters

### 5. Redeploy:
1. After saving the environment variables, Vercel will ask to redeploy
2. Click **"Redeploy"** or wait for automatic redeployment
3. Wait 1-2 minutes for deployment to complete

### 6. Test:
1. Visit: `https://your-site.vercel.app/api/check-db`
2. It should show:
   - ✅ `supabaseKey: ✅ Set (✅ JWT format (correct))`
   - ✅ `connectionTest: true`
   - ✅ `status: ✅ Connected - Database is working!`

### 7. Try Signup Again:
After the connection test passes, try signing up again. It should work!

## Common Mistakes:
- ❌ Using the **anon key** (starts with `eyJ` but shorter, has restrictions)
- ❌ Using the **service_role key** label text instead of the actual key
- ❌ Copying with extra spaces or line breaks
- ❌ Not setting it for all environments (Production, Preview, Development)

## Still Not Working?
1. Check Vercel function logs: Vercel Dashboard → Your Project → Functions → View Logs
2. Look for the exact error message
3. Verify the key in Supabase hasn't been rotated/changed
4. Try creating a new service_role key in Supabase (Settings → API → Regenerate)

