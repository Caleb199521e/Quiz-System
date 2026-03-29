# Heroku Deployment Guide

## Pre-Deployment Checklist

✅ **Code Ready**
- All changes committed to git
- Procfile created for Heroku
- package.json has Node.js engine specification
- .env.example contains all required variables
- .env files are in .gitignore

✅ **Services Configured**
- Supabase project created and database schema deployed
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY obtained

## Deployment Steps

### 1. Install Heroku CLI
```bash
# Windows (via Chocolatey or download from heroku.com/download)
choco install heroku-cli

# Or download directly from: https://devcenter.heroku.com/articles/heroku-cli
```

### 2. Login to Heroku
```bash
heroku login
```

### 3. Create Heroku App
```bash
cd "c:\Users\Quo Bena\Documents\Quiz System"
heroku create your-app-name
```
Replace `your-app-name` with your desired app name (must be globally unique).

### 4. Set Environment Variables
```bash
heroku config:set SUPABASE_URL=<your-supabase-url>
heroku config:set SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
heroku config:set SUPABASE_ANON_KEY=<your-anon-key>
heroku config:set PORT=3000
```

Get these values from your Supabase project dashboard → Settings → API

### 5. Deploy to Heroku
```bash
git push heroku main
```

Or if using different branch:
```bash
git push heroku your-branch:main
```

### 6. View Live App
```bash
heroku open
```

### 7. Monitor Logs
```bash
heroku logs --tail
```

## Verify Deployment

1. Open your Heroku app URL in browser
2. Test Sign In / Sign Up flow
3. Verify database connections working
4. Check quiz functionality end-to-end
5. Monitor errors with: `heroku logs --tail`

## Common Issues & Fixes

### Issue: "Application error" page
**Fix:** Check logs with `heroku logs --tail` - usually missing env variables

### Issue: Database connection errors
**Fix:** Verify SUPABASE_URL and credentials are correct
```bash
heroku config
```

### Issue: Static files not loading
**Fix:** Already configured in server.js with `express.static(__dirname)`

### Issue: Dyno sleeping
**Fix:** Heroku free tier apps sleep after 30 min of inactivity. Use paid dyno or keep-alive service.

## Post-Deployment

- Monitor app health: https://dashboard.heroku.com/apps/your-app-name
- Set up error tracking (optional): New Relic, Sentry, etc.
- Configure custom domain (if needed)
- Enable automatic deploys from GitHub (optional)

## Useful Heroku Commands

```bash
heroku logs --tail           # Watch logs in real-time
heroku config                # View environment variables
heroku config:set KEY=value  # Set environment variable
heroku restart              # Restart dyno
heroku open                 # Open app in browser
heroku destroy              # Delete app
```

## Database Migrations

If you need to run database migrations:
```bash
heroku run "npm run migrate" 
```

Your database schema is already in `server/schema.sql` - apply it to Supabase project before deployment.

## Rollback

If something goes wrong:
```bash
heroku rollback
```

This reverts to the previous successful deployment.

---

**Your app is ready for production! 🚀**

Stack:
- Backend: Express.js on Node.js 18
- Database: Supabase (PostgreSQL)
- Frontend: Vanilla JS + Tailwind CSS
- Hosting: Heroku
