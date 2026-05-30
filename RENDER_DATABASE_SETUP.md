# Render Deployment - DATABASE_URL Configuration Guide

## Current Issue ❌

```
Error: Failed to load operational offices. Please try again.
HTTP 500 - Server error
Cause: DATABASE_URL environment variable not set on Render
```

---

## Solution: Set DATABASE_URL on Render

### Step 1: Access Render Dashboard
1. Go to https://dashboard.render.com
2. Log in with your account
3. Click on **jkuat-online-queue** service

### Step 2: Navigate to Environment Variables
1. Click **"Settings"** in the left sidebar
2. Scroll to **"Environment"** section
3. Click **"Add Environment Variable"**

### Step 3: Add DATABASE_URL

**Variable Name:** `DATABASE_URL`

**Variable Value:** (Choose your option below)

---

## Database Options

### ✅ Option 1: Create Render PostgreSQL Database (Recommended)

**Steps:**
1. In Render Dashboard, click **"New +"** → **"PostgreSQL"**
2. Fill in:
   - **Name:** `jkuat-queue-db`
   - **Database:** `queue_app`
   - **Username:** `postgres`
   - **Password:** (auto-generated, copy it)
3. Create the database
4. Copy the **"Internal Database URL"** (shows as `postgresql://...`)
5. Paste as `DATABASE_URL` in your service

**Connection String Format:**
```
postgresql://postgres:PASSWORD@jkuat-queue-db.onrender.com:5432/queue_app
```

---

### ✅ Option 2: Use External PostgreSQL (Supabase)

**Steps:**
1. Go to https://supabase.com
2. Create a project or use existing
3. Click **"Settings"** → **"Database"**
4. Copy **"Connection string - Postgresql"**
5. Replace `[YOUR-PASSWORD]` with your actual password
6. Paste as `DATABASE_URL` in Render environment

**Connection String Format:**
```
postgresql://postgres:PASSWORD@db.supabase.co:5432/postgres
```

---

### ✅ Option 3: Use Render PostgreSQL with SSL (More Secure)

```
postgresql://postgres:PASSWORD@host.onrender.com:5432/queue_app?sslmode=require
```

---

## After Setting DATABASE_URL

### Step 1: Run Migrations
The migrations will automatically run when the server starts (if using api-server.js)

Or manually:
```bash
npm run migrate
```

### Step 2: Initialize Data
```bash
npm run init-data
```

### Step 3: Redeploy (If Needed)
1. In Render, click **"Manual Deploy"** → **"Deploy latest commit"**
2. Wait for deployment to complete
3. Check logs for any errors

---

## Verify Database Connection

### Check Server Logs in Render
1. Click your service on Render Dashboard
2. Click **"Logs"** tab
3. Look for:
   ```
   ✓ DATABASE_URL found in environment
   ✓ Database connection successful
   ✓ All migrations completed successfully
   ```

### Test the API
```bash
curl https://jkuat-online-queue.onrender.com/api/health
```

Expected response:
```json
{
  "status": "ok",
  "database": "connected",
  "migrations": "applied",
  "tables": ["queue_entries", "offices", "staff_accounts", "feedback_messages"]
}
```

---

## Troubleshooting

### ❌ Still Getting 500 Error?

1. **Check DATABASE_URL is set:**
   - Go to Render Settings → Environment
   - Verify `DATABASE_URL` is listed

2. **Check connection string format:**
   - Must start with `postgresql://`
   - Must include password (URL encoded if special chars)
   - Must include database name

3. **Check database is running:**
   - For Render PostgreSQL: Service should show "Available"
   - For External: Test connection locally first

4. **Review server logs:**
   - Render → Logs tab
   - Look for `FATAL` or `ERROR` messages

### ✅ Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| `FATAL: DATABASE_URL not set` | Set environment variable in Render Settings |
| `Connection refused` | Database service not running or wrong host |
| `Authentication failed` | Wrong username/password in connection string |
| `Database "queue_app" does not exist` | Create database or check database name |
| `SSL error` | Add `?sslmode=require` to connection string |

---

## Example: Complete Setup with Render PostgreSQL

### 1. Create Render PostgreSQL
```
Service: jkuat-queue-db (PostgreSQL)
Database: queue_app
Username: postgres
Password: [AUTO-GENERATED]
Internal URL: postgresql://postgres:abcd1234@jkuat-queue-db.onrender.com:5432/queue_app
```

### 2. Set Render Environment Variable
```
Key: DATABASE_URL
Value: postgresql://postgres:abcd1234@jkuat-queue-db.onrender.com:5432/queue_app
```

### 3. Deploy Service
```
Service: jkuat-online-queue
Deploy: Manual or automatic on git push
```

### 4. Verify
```
✓ Server starts
✓ DATABASE_URL found
✓ Database connects
✓ Migrations run
✓ API responds with 200/404/401 (not 500)
```

---

## Next Steps

1. **Choose your database option** (Render PostgreSQL recommended)
2. **Get the connection string**
3. **Set DATABASE_URL** in Render Settings
4. **Redeploy** the service
5. **Test** the login page → Staff Office Access

---

## Questions?

If you still see errors after setting DATABASE_URL:
1. Check Render Logs
2. Verify connection string format
3. Ensure database service is "Available"
4. Try manual redeploy

---

**Status:** 🔴 ACTION REQUIRED - DATABASE_URL must be set on Render  
**Priority:** ⚡ HIGH - Application cannot function without database  
**Time to Fix:** 5-10 minutes

