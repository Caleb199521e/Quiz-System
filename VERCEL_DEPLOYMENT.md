# Vercel Deployment Guide

## Pre-Deployment Checklist

✅ **Code Ready**
- All changes committed to git
- `vercel.json` created for Vercel configuration
- `package.json` has Node.js engine specification
- `.env.example` contains all required variables
- `.env` files are in `.gitignore`

✅ **Services Configured**
- Supabase project created and database schema deployed
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY obtained

✅ **Git Repository**
- Code pushed to GitHub (Vercel integrates with GitHub)

## Deployment Steps

### 1. Connect GitHub to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Sign up or log in with your GitHub account
3. Authorize Vercel to access your GitHub repositories

### 2. Import Your Project

1. Click **"Add New..." → "Project"**
2. Select your Quiz System repository
3. Vercel auto-detects it's a Node.js project

### 3. Configure Environment Variables

In the Vercel dashboard:
1. Go to your project → **Settings → Environment Variables**
2. Add these variables:
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   SUPABASE_ANON_KEY=your-anon-key
   PORT=3000
   ```

Get these values from your Supabase project dashboard → Settings → API

### 4. Deploy

Click **"Deploy"** button. Vercel will:
- Install dependencies
- Build the project
- Deploy to production

Your app will be available at: `https://your-project-name.vercel.app`

## Automatic Deployments

Vercel automatically deploys when you push to your repository:
- **Push to main branch** → Production deployment
- **Push to other branches** → Preview deployments
- **Pull requests** → Preview environments

## Verify Deployment

1. Open your Vercel app URL
2. Test Sign In / Sign Up flow
3. Verify database connections working
4. Check quiz functionality end-to-end
5. Monitor with: **Project → Deployments → Logs**

## Custom Domain (Optional)

1. Go to **Project Settings → Domains**
2. Add your custom domain
3. Update DNS records as instructed by Vercel

## Common Issues & Fixes

### Issue: "SUPABASE_URL is not defined"
**Fix:** Check environment variables in Vercel dashboard
```
Settings → Environment Variables → Check all are set
```

### Issue: Database connection errors
**Fix:** Verify credentials are correct
- Copy exact values from Supabase (no extra spaces)
- Make sure SERVICE_ROLE_KEY matches exactly

### Issue: Static files not loading
**Fix:** Already configured in `vercel.json` for serving static files

### Issue: 404 errors on routes
**Fix:** Routes are configured in `vercel.json` to handle all paths

## Post-Deployment

- Monitor deployments: https://vercel.com/dashboard
- Set up error tracking (optional): Sentry, LogRocket
- Configure custom domain
- Enable analytics (Vercel dashboard → Analytics)

## Useful Vercel Features

### View Logs
```
Dashboard → Deployments → Select deployment → Logs
```

### Redeploy Previous Version
```
Deployments → Select previous version → ... → Redeploy
```

### Preview URLs
Each PR automatically gets a unique preview URL for testing before merge.

### Analytics
- **Dashboard → Analytics** shows real-time user metrics
- Request count, response times, error rates

## Database Migrations

Your database schema is in `server/schema.sql`. If you need updates:
1. Run the SQL directly in Supabase SQL Editor
2. Or add migration scripts and run on demand

## Environment Variable Tips

For different environments, use Vercel:
1. **Settings → Environment Variables**
2. Set "Environment" to Production/Preview/Development
3. Variables can have different values per environment

## Auto-Deploy from Git

When you push to GitHub:
```bash
git push origin main
```

Vercel automatically:
1. Detects the push
2. Installs dependencies
3. Builds the project
4. Deploys to production

## Rollback to Previous Version

1. Go to **Deployments**
2. Find the version to restore
3. Click **...** → **Promote to Production**

This is instant - no rebuild needed!

## Monitoring

### Real-time Logs
```
Dashboard → Deployments → Select deployment → Logs
```

### Error Tracking
- Check logs for errors: Deployments → Logs
- Optional: Integrate Sentry for detailed error tracking

### Performance Metrics
- Vercel dashboard shows request counts, response times
- Analytics tab shows user engagement patterns

---

**Your app is ready for production! 🚀**

Stack:
- Frontend: Vanilla JS + Tailwind CSS
- Backend: Express.js on Node.js 18 (Vercel Serverless)
- Database: Supabase (PostgreSQL)
- Hosting: Vercel

**Total setup time: ~5 minutes**
