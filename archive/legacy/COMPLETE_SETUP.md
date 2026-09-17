# Complete Setup - Copy & Paste All Code

## 1. vercel.json
Create/edit this file in your project root:

```json
{
  "functions": {
    "api/**/*.js": {
      "runtime": "nodejs20.x"
    }
  },
  "build": {
    "exclude": [
      "*.sql",
      "create-tables.sql",
      "node_modules/**",
      ".env",
      ".env.local",
      "*.log",
      ".DS_Store"
    ]
  }
}
```

**Note:** Vercel uses the `build.exclude` array in `vercel.json` to exclude files. The `.vercelignore` file is not needed (and may not work as expected).

---

## 3. api/test.js
Create/edit this file:

```javascript
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    res.json({ 
      message: 'API endpoint is working!',
      timestamp: new Date().toISOString(),
      method: req.method
    });
  } catch (error) {
    console.error('Error in test endpoint:', error);
    res.status(500).json({ error: error.message });
  }
};
```

---

## 4. package.json
Your package.json should look like this:

```json
{
  "name": "edge-landings",
  "version": "1.0.0",
  "description": "Edge Landings - Website subscription service",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "stripe": "^14.0.0",
    "@supabase/supabase-js": "^2.39.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "keywords": ["website", "subscription", "stripe", "payments"],
  "author": "Brice Leasure",
  "license": "MIT"
}
```

---

## 5. Vercel Dashboard Settings

### In Vercel Dashboard → Settings → Build & Development Settings:
- **Framework Preset**: Set to **"Other"** (or leave empty)
- **Build Command**: Leave **empty**
- **Output Directory**: Leave **empty**
- **Install Command**: Can be `npm install` or empty

### Environment Variables (Settings → Environment Variables):
Make sure these are set for **ALL environments** (Production, Preview, Development):
- `STRIPE_SECRET_KEY` (your Stripe secret key)
- `STRIPE_WEBHOOK_SECRET` (if using webhooks)
- `SUPABASE_URL` (if using Supabase)
- `SUPABASE_KEY` (if using Supabase)

---

## 6. After Setup:

1. **Commit all files:**
   ```bash
   git add vercel.json .vercelignore api/test.js package.json
   git commit -m "Clean setup for Vercel"
   git push origin main
   ```

2. **Wait for deployment** (1-2 minutes)

3. **Test your site:**
   - Main site: `https://edge-landings.vercel.app`
   - Test API: `https://edge-landings.vercel.app/api/test`

---

## Files to Ensure Exist:
- ✅ `index.html` (your main landing page) - should be in root directory
- ✅ `api/test.js` (test endpoint)
- ✅ `api/login.js` (your other API endpoints)
- ✅ `api/signup.js`
- ✅ `api/dashboard.js`
- ✅ `api/forgot-password.js`
- ✅ `api/reset-password.js`

---

## Important Notes:
- Make sure `index.html` is in your **root directory** (not in `public/` or `build/`)
- The `vercel.json` uses `functions` (not `builds`) to allow static file auto-detection
- `.vercelignore` excludes SQL files and other unnecessary files
- All API files in `api/` folder will be automatically available at `/api/filename`

---

## If Still Getting 404:

1. Check Vercel Dashboard → Deployments → Click on latest deployment → View Build Logs
2. Make sure Framework Preset is set to "Other" in Build Settings
3. Verify `index.html` is committed to git: `git ls-files index.html`
4. Try redeploying: Deployments → ⋯ → Redeploy

