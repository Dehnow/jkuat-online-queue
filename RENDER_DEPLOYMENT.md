# Render Deployment Guide

## Prerequisites

1. GitHub account with your repository pushed
2. Render account (https://render.com)
3. PostgreSQL database (Render provides free tier)

## Step 1: Create PostgreSQL Database on Render

1. Go to https://dashboard.render.com
2. Click "New +" → "PostgreSQL"
3. Name: `jkuat-queue-db`
4. Region: Choose closest to you
5. PostgreSQL Version: Latest
6. Click "Create Database"
7. Wait for database to be ready
8. Copy the "Internal Database URL" - you'll need this

## Step 2: Deploy Backend + Frontend Service

1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. **Settings:**
   - **Name:** `jkuat-queue`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run production`
   - **Plan:** Free

5. **Environment Variables:**
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = (Paste the Internal URL from PostgreSQL)
   - `PORT` = `3000`
   - `FRONTEND_URL` = `https://your-service-name.onrender.com`

6. Click "Create Web Service"

## Step 3: Update Environment

After deployment, update `FRONTEND_URL`:
1. Go to your web service settings
2. Find Environment Variables
3. Update `FRONTEND_URL` to your actual Render URL
   - Format: `https://your-service-name.onrender.com`

## Step 4: Initialize Database

The first deployment will automatically create tables.

Check if everything is working:
```bash
curl https://your-service-name.onrender.com/api/health
```

Should return: `{"status":"ok","timestamp":"...","environment":"production"}`

## Step 5: Access Your App

- **Frontend:** https://your-service-name.onrender.com
- **Admin Login:** Admin0375 / group2sysdev
- **API Endpoints:** https://your-service-name.onrender.com/api/*

## Troubleshooting

### Database connection fails
- Check `DATABASE_URL` is correct
- Ensure it uses `Internal Database URL`, not External
- Wait 2-3 minutes after database creation

### Port binding error
- Render provides PORT via environment variable
- Server automatically uses it (see api-server.js line 38)

### Build fails
- Check build logs in Render dashboard
- Ensure `npm install` completes
- Check for TypeScript errors

### Deployment times out
- Free tier has 30 second timeout for build
- May need paid plan if build takes longer
- Check `npm install` isn't downloading too many packages

## Post-Deployment

### Monitoring
- Logs: Dashboard → Your Service → Logs
- Check for database connection errors
- Monitor API response times

### Updates
- Push changes to GitHub
- Render auto-deploys on git push
- Check deployment status in dashboard

### SSL/TLS
- Render provides free SSL
- Automatic HTTPS on your domain

## Scaling

If you need more power:
1. Go to your service in Render dashboard
2. Change Plan from Free to Paid
3. Choose instance type
4. Restart service

## Costs

**Free Tier:**
- Backend: 3 hours/month (free)
- PostgreSQL: Limited, runs down after 90 days

**Paid Tier:**
- Backend: ~$7/month
- PostgreSQL: ~$7/month

## Common Issues

| Issue | Solution |
|-------|----------|
| 503 Service Unavailable | Database not ready - wait 30s and retry |
| Database connection timeout | Check DATABASE_URL format |
| CORS errors | Update FRONTEND_URL in environment |
| Build fails | Check npm install log for errors |
| Port already in use | Render manages ports automatically |

## Important Notes

1. **Never commit `.env`** - Use environment variables in Render
2. **Database backups** - Enable in Render PostgreSQL settings
3. **Cold starts** - Free tier sleeps after 15 mins, takes 30s to wake
4. **Storage** - PostgreSQL only (frontend built to static files)

## Useful Commands

```bash
# Test local before deploying
npm run build
npm run production

# Check build output
ls -la dist/

# Test API locally
curl http://localhost:3000/api/health
```

## Next Steps

After successful deployment:
1. Test all endpoints
2. Set up monitoring/alerting
3. Consider paid plan for reliability
4. Enable database backups
5. Set up custom domain (optional)
