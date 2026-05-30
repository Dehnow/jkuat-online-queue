# 🚀 RENDER DEPLOYMENT - QUICK ACTION GUIDE

**Status:** Code ready for deployment to Render  
**Branch:** `main`  
**Commit:** `c60974d` (feat: Implement golden ticket premium feature with M-Pesa integration)

---

## ⚡ Deploy Now (3 Steps)

### Step 1: Go to Render Dashboard
```
https://dashboard.render.com/services/jkuat-online-queue
```

### Step 2: Manual Deploy
- Click **"Manual Deploy"** button (top right)
- Select **"Deploy latest commit"**
- Wait for build to complete (~2-3 minutes)

### Step 3: Verify Deployment
```bash
# Test health endpoint
curl https://jkuat-online-queue.onrender.com/api/health

# Expected response:
# { "status": "ok", "database": "connected" }
```

---

## 🔧 Environment Variables (Verify in Render)

These should already be set. If not, add them:

```
NODE_ENV=production
DATABASE_URL=postgresql://...  [Already set]
FRONTEND_URL=https://jkuat-online-queue.onrender.com

# M-Pesa (Sandbox Mode)
MPESA_SANDBOX=true
MPESA_CONSUMER_KEY=YLPydMh4xhirGrux1cdHyqKRCE3BzinLxdlzed4s88XyiRnu
MPESA_CONSUMER_SECRET=RuAadmSxyhwAqjk1GqEwW3vyoDtbCD0nByXAHR7GZw0COLoxSI6u0AKa91wSL4uw
MPESA_SHORTCODE=174379
MPESA_PASSKEY=bfb279f9ba9b9d1380007480bbe7f27425e1aa6d4ede3891ec337007a74ff42
MPESA_CALLBACK_URL=https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback

# Admin
ADMIN_USERNAME=Admin0375
ADMIN_PASSWORD=group2sysdev
```

---

## ✅ Post-Deploy Checklist

After clicking "Manual Deploy", wait for it to complete, then verify:

### 1. Check Deployment Status
- [ ] Render shows "Build successful"
- [ ] Service shows "Live" status
- [ ] No error messages in logs

### 2. Test API Health
```bash
curl https://jkuat-online-queue.onrender.com/api/health
```
- [ ] Returns `{ "status": "ok", "database": "connected" }`

### 3. Test Student Login Page
```
https://jkuat-online-queue.onrender.com/login
```
- [ ] Page loads without errors
- [ ] Login form visible
- [ ] No console errors (F12)

### 4. Test Student Queue Join
1. Click "Student" tab
2. Enter phone: `+254712345678`
3. Enter Student ID: `S55555`
4. Click "Get Queue Number →"
5. [ ] Ticket should be created and dashboard should load

### 5. Test Golden Ticket Feature
1. On dashboard, see "Your Ticket" section
2. Click "⭐ Upgrade to Golden Ticket (KES 50)"
3. [ ] Golden ticket modal should open
4. [ ] Phone field should be pre-filled
5. Enter M-Pesa phone: `+254727610315`
6. Click "Pay KES 50 with M-Pesa"
7. [ ] Should show "Processing Payment..." message
8. [ ] No errors in console or API

### 6. Test Duplicate Prevention
1. Try to click "Upgrade to Golden Ticket" again on same ticket
2. [ ] Should show error: "This queue entry already has a golden ticket"

### 7. Test Staff Login
1. Go to `/admin` or find "Staff" tab
2. Select office: `Registrar's Office`
3. Enter password: `group2sysdev`
4. [ ] Staff dashboard should load

---

## 📊 What Gets Deployed

**Files Changed:**
- ✅ `api-server.js` - Added M-Pesa endpoints + fixed timestamp bug
- ✅ `src/routes/index.tsx` - Added golden ticket modal + UI
- ✅ `src/routes/login.tsx` - Fixed student login flow
- ✅ `src/router.tsx` - Fixed authentication check
- ✅ `.gitignore` - Updated for security

**New Features:**
- ✅ Golden Ticket premium upgrade (KES 50)
- ✅ M-Pesa payment integration (sandbox)
- ✅ Payment status polling
- ✅ Duplicate golden ticket prevention

**Bug Fixes:**
- ✅ Student login now redirects to dashboard
- ✅ Router no longer unconditionally redirects to login
- ✅ Drizzle timestamp error fixed
- ✅ Daily queue limit (429) handled properly

---

## 🆘 If Deployment Fails

### Check Render Logs
1. Go to https://dashboard.render.com/services/jkuat-online-queue
2. Click "Logs" tab
3. Look for error messages

### Common Issues

**Build failed: npm install error**
- Solution: Try "Manual Deploy" again
- If persists: Contact support

**Build failed: TypeScript error**
- This shouldn't happen (tested locally)
- Solution: Revert to previous commit:
  ```bash
  git revert c60974d
  git push origin main
  # Wait for Render to re-deploy
  ```

**API connection timeout**
- Check DATABASE_URL in environment variables
- Verify PostgreSQL is running on Render
- Check network firewall settings

**M-Pesa payment returns 500**
- Check environment variables are set correctly
- Verify MPESA_CALLBACK_URL matches deployed domain
- Check api-server.js for errors in logs

### Rollback (If Critical Issues)
```bash
# Option 1: Revert commit
git revert c60974d
git push origin main
# Render auto-deploys within 1 minute

# Option 2: Render rollback
1. Go to Render dashboard
2. Click "Logs" → "Deploy History"
3. Find previous successful deployment
4. Click "Redeploy"
```

---

## 📞 Deployment Support

**Need help?**

1. Check API health: `curl https://jkuat-online-queue.onrender.com/api/health`
2. Review deployment logs in Render dashboard
3. Check this guide for solutions
4. Review commit `c60974d` for changes made

---

## ✨ Automatic Deployment (After First Manual Deploy)

Once deployed, Render will **automatically** redeploy whenever you:
1. Push changes to `main` branch on GitHub
2. Render detects the push
3. Automatically starts build & deploy
4. Service updates within 2-5 minutes

**No action needed after the first manual deployment!**

---

## 🎯 Summary

| Step | Action | Time |
|------|--------|------|
| 1 | Go to Render dashboard | 30 sec |
| 2 | Click "Manual Deploy" | 10 sec |
| 3 | Wait for build | 2-3 min |
| 4 | Verify health check | 30 sec |
| 5 | Test features | 2-3 min |

**Total: ~5-7 minutes to full deployment + verification**

---

## 🚀 Ready?

**Click "Manual Deploy" now to deploy all the golden ticket features!**

Good luck! 🎉
