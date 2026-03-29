# Security Best Practices

## 🔐 Sensitive Data Protection

### ✅ What's Been Fixed

1. **Console Logging Removed**
   - ❌ BEFORE: `console.log('[EcoRevise] Config loaded from server:', window.ECOREVISE_CONFIG);`
   - ✅ AFTER: `console.log('[EcoRevise] Config loaded from server');`
   - Prevents Supabase credentials from appearing in browser console

2. **.gitignore is Configured**
   - `.env` file is ignored (not committed to GitHub)
   - `.env.example` is provided as template instead
   - Other sensitive patterns: `.env.*`, `node_modules/`

3. **Environment Variables Protected**
   - `SUPABASE_SERVICE_ROLE_KEY` - **NEVER sent to frontend** ✅
   - `SUPABASE_ANON_KEY` - Sent to frontend (safe - designed for client-side use)
   - Both stored in `.env` file (not in code)

### 🔑 Key Security Principles

| Component | Credential | Location | Exposed? |
|-----------|-----------|----------|----------|
| Backend Server | `SUPABASE_SERVICE_ROLE_KEY` | `.env` file only | ❌ No |
| Backend Server | `SUPABASE_URL` | `.env` file only | ❌ No |
| Frontend | `SUPABASE_ANON_KEY` | Window object (safe) | ⚠️ Frontend only |
| Frontend | `SUPABASE_URL` | Window object (safe) | ⚠️ Frontend only |
| Browser Console | Full config object | Previously logged! | ✅ Now hidden |

### 📋 File Security Checklist

- ✅ `.env` - NEVER check in to git (covered by .gitignore)
- ✅ `.env.example` - Safe template, checked into git
- ✅ `server.js` - Uses `!!` to log only boolean presence, not values
- ✅ `index.html` - Updated to hide credentials from console
- ✅ `js/app.js` - No sensitive logging detected
- ✅ `js/config.local.js` - Contains ANON_KEY (safe for frontend, .gitignored)

### 🌐 Production Deployment

**For Vercel/Heroku:**
1. Set environment variables in dashboard (never commit `.env`)
2. Platform injects vars at runtime
3. `SUPABASE_SERVICE_ROLE_KEY` stays on server only
4. Frontend receives only `SUPABASE_ANON_KEY` + `SUPABASE_URL`

**Current Setup:**
- Server: `/api/config` endpoint serves safe config to frontend
- Frontend: Fetches from `/api/config` on every load
- Fallback: Uses `.env` file for dev (not production-safe)

### 🛑 What NOT to Do

❌ Don't commit `.env` file  
❌ Don't log full config objects to console  
❌ Don't expose `SUPABASE_SERVICE_ROLE_KEY` to frontend  
❌ Don't hardcode credentials in source code  
❌ Don't log credential values (use !! to check presence only)  

### ✅ What TO Do

✅ Store secrets in `.env` file (locally) or platform dashboard (production)  
✅ Use `!!` to log boolean status of credentials  
✅ Keep `.env` in `.gitignore`  
✅ Provide `.env.example` template  
✅ Validate credentials are loaded at startup  

### 🔍 Verification Steps

1. **Check if .env is committed:**
   ```bash
   git log --follow --full-history -- .env
   # Should return nothing (file never committed)
   ```

2. **Verify no credentials in git history:**
   ```bash
   # Search recent commits for SUPABASE keys
   git log -p --all | grep -i "eyJhbGc"
   # Should return nothing
   ```

3. **Inspect browser console:**
   - Open DevTools (F12)
   - Look for any full config objects
   - Should only see: `[EcoRevise] Config loaded from server`

4. **Verify server only logs booleans:**
   ```
   Expected: "[CONFIG] Serving dynamic config with SUPABASE_URL: true SUPABASE_ANON_KEY: true"
   NOT: "[CONFIG] Serving dynamic config with SUPABASE_URL: https://... SUPABASE_ANON_KEY: eyJhbGc..."
   ```

---

## 🚨 If Credentials Were Ever Exposed

1. **Rotate immediately in Supabase:**
   - Go to Supabase Dashboard
   - Project Settings → API Keys
   - Re-generate both keys

2. **Update locally:**
   - Update `.env` file with new keys
   - Verify server can still activate

3. **Update all deployed environments:**
   - Vercel: Update environment variables
   - Heroku: Update config vars
   - Any other platform

4. **Check Supabase audit logs:**
   - Supabase Dashboard → Logs
   - Look for suspicious activity

---

## 📝 Deployment Checklist

Before deploying to production:

- [ ] `.env` file exists locally with all required keys
- [ ] `.env` is in `.gitignore` 
- [ ] `.env.example` exists with template values
- [ ] Platform (Vercel/Heroku) has all env vars set
- [ ] Browser console doesn't log full credentials
- [ ] Server logs only !! boolean status
- [ ] `SUPABASE_SERVICE_ROLE_KEY` never sent to frontend
- [ ] Recent git history contains no credential values

---

Last Updated: March 29, 2026  
Fixed: Browser console security leak in index.html
