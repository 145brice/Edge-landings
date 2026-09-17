# Vercel Project Settings Checklist
## Project ID: prj_QimFp3Ib0bJWnr2LMixMNKiIsrXU

## Critical Settings to Check:

### 1. Go to Your Project Settings
Direct URL: `https://vercel.com/brices-projects-e42e9f0a/edge-landings/settings`

### 2. General Tab
- **Framework Preset**: MUST be **"Other"** or **empty**
  - ❌ If it says "React", "Next.js", "Create React App" → Change to "Other"
  - ✅ Should be "Other" or blank

### 3. Build & Development Settings Tab
Check these fields:

- **Framework Preset**: Should be **"Other"** or empty
- **Build Command**: Should be **EMPTY** (delete if anything is there)
- **Output Directory**: Should be **EMPTY** (delete "build" or "dist" if present)
- **Install Command**: Can be empty or `npm install`
- **Root Directory**: Should be **EMPTY** (unless you have a specific setup)

### 4. Environment Variables Tab
Make sure these are set for **ALL environments** (Production, Preview, Development):
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET` (if using)
- `SUPABASE_URL` (if using)
- `SUPABASE_KEY` (if using)

### 5. After Making Changes
1. Click **Save** on each settings page
2. Go to **Deployments** tab
3. Click **⋯** on latest deployment
4. Click **Redeploy**

## Current Status:
- ✅ Code is correct
- ✅ Files are committed to git
- ✅ vercel.json has rewrite rule
- ❌ Still getting NOT_FOUND error
- ⚠️ **Likely cause: Framework Preset is set incorrectly**

## Quick Fix:
1. Settings → General → Framework Preset → Change to **"Other"**
2. Settings → Build & Development → Clear Output Directory
3. Save
4. Redeploy

