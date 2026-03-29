# Deployment Issues Report - EcoRevise Quiz System

**Date**: March 29, 2026  
**Status**: Critical Issues Identified ⚠️

---

## Executive Summary

Your app has **3 critical deployment issues** preventing it from working in production. All can be fixed in ~15 minutes.

| Issue | Severity | Impact | Fix Time |
|-------|----------|--------|----------|
| Missing index.html | Critical | App won't load | 2 min |
| No root route handler | Critical | 404 on "/" | 3 min |
| Hardcoded localhost API | Critical | API calls fail in prod | 5 min |

---

## Issues Identified

### 1. 🔴 Missing index.html Entry Point

**Location**: Root directory  
**Problem**: 
- HTML file is named `deepseek_html_20260327_1d2e5d.html` (temporary name)
- Express server looks for `index.html` as the default document
- When browser visits `/`, Express returns 404 instead of serving the app

**Evidence**:
```
Browser request: GET /
Server response: 404 (Not Found)
Expected: Serve deepseek_html_20260327_1d2e5d.html
```

**Impact**:
- App completely inaccessible via `/`
- Users see blank page or error

---

### 2. 🔴 No Root Route Handler in Express

**Location**: `server.js` (line 11)  
**Problem**:
```javascript
app.use(express.static(__dirname)); // Serves static files but no fallback
```

The server:
- ✅ Correctly serves `/js/...`, `/css/...` static files
- ❌ Does NOT serve the HTML at `/`
- ❌ Does NOT handle SPA routing (all routes should serve the HTML)

**Evidence**:
```
GET /js/app.js    → 404 (app.js not found or path issue)
GET /js/lib.js    → 404 (lib.js not found or path issue)
GET /js/config.local.js → HTML returned instead of JS
```

This explains the errors from your screenshot:
```
Uncaught SyntaxError: Unexpected token '<'  (config.local.js:1)
Uncaught SyntaxError: Unexpected token '<'  (lib.js:1)
Uncaught SyntaxError: Unexpected token '<'  (app.js:1)
```

The `<` means HTML is being returned when JavaScript is expected.

**Impact**:
- JavaScript files can't load
- Browser console shows "Unexpected token '<'" errors
- App won't initialize

---

### 3. 🔴 Hardcoded Localhost API_BASE

**Location**: `js/config.local.js` (line 7)  
**Problem**:
```javascript
window.ECOREVISE_CONFIG = {
  SUPABASE_URL: 'https://hvluboobnrcmhvdjvzpx.supabase.co',
  SUPABASE_ANON_KEY: '...',
  API_BASE: 'http://localhost:3000'  // ⚠️ LOCALHOST HARDCODED
};
```

**Evidence**:
- Works locally: `http://localhost:3000` = backend
- Fails in Vercel: tries to call `http://localhost:3000` from browser
  - Vercel URL is `https://yourapp.vercel.app`
  - Frontend makes requests to wrong URL
  - API returns 503 or "Connection Refused"

**Impact**:
- All API requests fail in production
- Quiz questions won't load
- User authentication fails
- Staff functionality broken

---

### 4. ⚠️ Environment Variables Incomplete

**Location**: `.env.example`  
**Problem**:
- `.env.example` missing `SUPABASE_ANON_KEY`
- Deployment instructions incomplete
- Users may not configure Supabase ANON_KEY on Heroku/Vercel

**Impact**:
- Supabase client won't initialize in browser
- Frontend can't connect to database

---

## Root Cause Analysis

```
┌─────────────────────────────────────────────────────────────┐
│ REQUEST: Browser visits https://yourapp.vercel.app/       │
├─────────────────────────────────────────────────────────────┤
│ 1. Express receives GET /                                   │
│ 2. Checks static file directory (✓ works)                   │
│ 3. Looks for index.html (✗ NOT FOUND)                       │
│ 4. Sends 404 error page                                     │
│ 5. Browser displays blank page                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ SECONDARY: Browser tries to load JS files                  │
├─────────────────────────────────────────────────────────────┤
│ 1. HTML loads: <script src="js/config.local.js"></script>  │
│ 2. Express serves static files from root                     │
│ 3. Finds js/config.local.js? (yes, it exists)               │
│ → But Express may be returning 404 HTML instead             │
│ 4. Browser sees HTML (<) when expecting JS                  │
│ 5. SyntaxError: Unexpected token '<'                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ TERTIARY: API calls from frontend                           │
├─────────────────────────────────────────────────────────────┤
│ 1. App initializes: window.API_BASE = 'http://localhost:3000'
│ 2. Frontend calls: http://localhost:3000/api/courses       │
│ 3. From Vercel: Cross-origin request + wrong URL           │
│ 4. Browser can't reach localhost from cloud                │
│ 5. API requests time out or fail with CORS                 │
└─────────────────────────────────────────────────────────────┘
```

---

## Solutions

### Fix 1: Rename HTML File to index.html
**Time**: 2 minutes

```bash
# Rename the file
mv deepseek_html_20260327_1d2e5d.html index.html
```

**Why**: Express static file serving automatically serves `index.html` as the default document.

---

### Fix 2: Add Root Route Handler to server.js
**Time**: 3 minutes

```javascript
// Add this AFTER app.use(express.static(__dirname))
const path = require('path');

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// For SPA routing, catch all routes not matched by API
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    next();
  }
});
```

**Why**: This serves the HTML file when accessing `/` and any non-API routes.

---

### Fix 3: Dynamic API_BASE Configuration
**Time**: 5 minutes

**Option A: Environment-based (RECOMMENDED)**

Update `js/config.local.js`:
```javascript
window.ECOREVISE_CONFIG = {
  SUPABASE_URL: 'https://hvluboobnrcmhvdjvzpx.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  // Dynamically determine API_BASE
  API_BASE: window.location.protocol + '//' + window.location.host
};
```

**Why**: Uses the same domain/protocol as the frontend:
- Locally: `http://localhost:3000`
- On Vercel: `https://yourapp.vercel.app`
- Works everywhere automatically

---

### Fix 4: Update .env.example
**Time**: 1 minute

Add missing variable:
```bash
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_ANON_KEY=your-supabase-anon-key
PORT=3000
```

---

## Verification Checklist

After fixes, verify:

- [ ] File `index.html` exists in root directory
- [ ] `server.js` has root route handler
- [ ] `js/config.local.js` uses dynamic `API_BASE`
- [ ] `.env.example` includes all 4 variables
- [ ] Local test: `npm start` → visit `http://localhost:3000` → app loads ✅
- [ ] Local test: Inspect JS files in Network tab → no "Unexpected token '<'" errors
- [ ] Local test: Login works, quiz loads ✅
- [ ] Deploy to Vercel/Heroku → verify app loads ✅
- [ ] Production test: API calls succeed (questions load)

---

## Deployment Platform Notes

### Vercel
- ✅ `vercel.json` is correct
- Routes all requests to `server.js`
- `API_BASE` should be `/` (same domain) - **FIX APPLIES**

### Heroku
- ✅ `Procfile` is correct
- `web: node server.js`
- `API_BASE` should be `/` (same domain) - **FIX APPLIES**

---

## Files to Modify

1. **Rename**: `deepseek_html_20260327_1d2e5d.html` → `index.html`
2. **Edit**: `server.js` (add root handler)
3. **Edit**: `js/config.local.js` (dynamic API_BASE)
4. **Edit**: `.env.example` (add SUPABASE_ANON_KEY)

---

## Next Steps

1. Apply all 4 fixes (15 minutes total)
2. Test locally: `npm start`
3. Commit and push to GitHub
4. Redeploy to Vercel/Heroku
5. Test production URL

All issues should be resolved! ✅

