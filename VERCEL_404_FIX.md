# Fix Vercel 404 Issue - Step by Step

## The Problem
Your `index.html` is in the repo, but Vercel returns 404. This is usually a **Framework Preset** or **Output Directory** setting issue.

## Solution - Check These Settings:

### Step 1: Go to Vercel Dashboard
1. Go to https://vercel.com/dashboard
2. Click on your project: **edge-landings**

### Step 2: Check Framework Preset
1. Click **Settings** (gear icon)
2. Click **General** tab
3. Look for **Framework Preset**
4. **CHANGE IT TO: "Other"** (not "React", "Next.js", or "Create React App")
5. Click **Save**

### Step 3: Check Build Settings
1. Still in **Settings**, click **Build & Development Settings**
2. Check these fields:
   - **Framework Preset**: Should be **"Other"**
   - **Build Command**: Should be **EMPTY** (delete anything there)
   - **Output Directory**: Should be **EMPTY** (delete anything there like "build" or "dist")
   - **Install Command**: Can be empty or `npm install`
3. Click **Save**

### Step 4: Redeploy
1. Go to **Deployments** tab
2. Click the **three dots** (⋯) on the latest deployment
3. Click **Redeploy**
4. OR just push a new commit to trigger auto-deploy

## Why This Happens
If Framework Preset is set to "React" or "Next.js", Vercel looks for:
- A `build/` or `dist/` folder
- A build process
- React/Next.js specific files

But your site is a **static HTML file**, so Vercel should serve it directly.

## After Fixing
Once you change Framework Preset to "Other" and clear the Output Directory:
- Your site should work at: `https://edge-landings.vercel.app`
- Your API endpoints will still work: `/api/test`, `/api/login`, etc.

## Quick Test
After redeploying, visit:
```
https://edge-landings.vercel.app
```

You should see your Edge Websites landing page, not a 404.

