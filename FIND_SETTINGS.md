# Where to Find Framework Settings in Vercel

## Step 1: Go to Build & Development Settings
1. Go to your project: `edge-landings`
2. Click **Settings** (gear icon)
3. Click **Build & Development Settings** tab

## Step 2: Look for These Fields (in order):

### Framework Preset (might be called):
- "Framework Preset"
- "Framework"
- "Build Framework" 
- "Preset"
- Or it might say "Auto-detected" or "Other"

### Build Command
- Should be **EMPTY** (delete if anything is there like "npm run build")

### Output Directory  
- Should be **EMPTY** (delete if it says "build", "dist", ".next", "out", etc.)

### Install Command
- Can be empty or `npm install`

### Root Directory
- Should be **EMPTY** (unless you have a monorepo)

## Alternative: Check General Tab
1. Settings → **General** tab
2. Look for:
   - "Framework"
   - "Project Type"
   - "Preset"
   - Any dropdown or setting that mentions React, Next.js, etc.

## If You Don't See Framework Settings:
- It might be auto-detected
- It might be under a different section
- Try checking **Deployments** → Click on a deployment → **Settings** tab

## What to Share:
Take a screenshot or tell me:
1. What you see in **Build & Development Settings**
2. Any fields that are filled in (especially Build Command, Output Directory)
3. Any dropdowns or settings that mention frameworks

