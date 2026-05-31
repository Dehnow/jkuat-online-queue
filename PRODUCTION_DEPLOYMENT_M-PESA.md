# Production Deployment Checklist - M-Pesa Integration

**Status:** Ready for Production ✅  
**Date:** May 31, 2026

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### ✅ Step 1: Verify M-Pesa API Credentials

**Go to:** https://developer.safaricom.co.ke/dashboard/myapps

**Required:**
- [ ] App is in **Active** state
- [ ] M-Pesa Online Checkout is enabled
- [ ] You have:
  - Consumer Key
  - Consumer Secret
  - Shortcode (e.g., 174379)
  - Passkey (shown under M-Pesa Online settings)

**Note:** These are PRODUCTION credentials from Daraja

---

### ✅ Step 2: Whitelist Callback URL

**In Daraja Dashboard:**
1. Go to **My Apps** → Your App
2. Click **M-Pesa Online Checkout**
3. Find **Callback URL** section
4. Add:
   ```
   https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback
   ```
5. Save

**Important:** Must be HTTPS, not HTTP

---

### ✅ Step 3: Get Production Database URL

**From Render Dashboard or ElephantSQL:**
- [ ] PostgreSQL connection string ready
- Format: `postgresql://username:password@host:port/database`
- [ ] Test connection works

---

### ✅ Step 4: Set Environment Variables in Render

**Go to:** https://dashboard.render.com/web/srv-xxxxx/env

**Add these variables:**

```
# M-Pesa Production Credentials (from Daraja)
CONSUMER_KEY=<your_production_consumer_key>
CONSUMER_SECRET=<your_production_consumer_secret>
SHORTCODE=<your_production_shortcode>
PASSKEY=<your_production_passkey>

# Callback URL (must match whitelisted URL)
CALLBACK_URL=https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback

# Database
DATABASE_URL=<your_postgres_connection_string>

# Optional: Turn off sandbox (defaults to production if all credentials are set)
MPESA_SANDBOX=false
```

**⚠️ IMPORTANT:**
- Never use `MPESA_` prefix on CONSUMER_KEY, CONSUMER_SECRET, SHORTCODE, PASSKEY
- Code checks for: `CONSUMER_KEY`, `CONSUMER_SECRET`, `SHORTCODE`, `PASSKEY` (exact names)
- If MPESA_ prefix is used, environment detection will fail

---

### ✅ Step 5: Apply Database Migrations

**Run in Terminal:**

```bash
cd /path/to/jkuat-queue-online
npm install
npx drizzle-kit migrate
```

**This creates tables:**
- queue_entries (with mpesa_status, is_golden, etc.)
- offices
- staff_accounts
- feedback_messages
- admin_requests

**Verify in Database:**
```sql
-- Should return the following columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'queue_entries';

-- Should include: id, name, student_id, service_type, is_golden, 
-- mpesa_status, mpesa_transaction_id, golden_ticket_ref, mpesa_paid_at
```

---

### ✅ Step 6: Deploy Code

```bash
# Commit and push to GitHub
git add .
git commit -m "Production deployment with M-Pesa integration"
git push origin main

# Render auto-deploys on push
# Monitor logs: https://dashboard.render.com/web/srv-xxxxx/logs
```

**Wait for:**
- [ ] Build completes successfully
- [ ] "Service started" message in logs
- [ ] App responds at https://jkuat-online-queue.onrender.com

---

### ✅ Step 7: Verify Production Credentials Detected

**Check Render Logs for:**

```
[mpesa-pay.ts] Mode: PRODUCTION 🚀 | Credentials: Real
```

✅ If you see **PRODUCTION 🚀**, credentials are correct

---

## 🧪 PRODUCTION TESTING

### Test 1: Create Queue Entry

**Go to:** https://jkuat-online-queue.onrender.com

**Join Queue:**
- Name: Test User
- Student ID: P999999
- Service: Registrar
- Click Join

**Verify:**
- [ ] Ticket appears
- [ ] Has ⭐ Upgrade button

---

### Test 2: Initiate Payment with REAL Phone Number

**Click** ⭐ Upgrade to Golden Ticket

**Enter Real Phone Number:**
- Your actual phone number (must be Safaricom M-Pesa enabled)
- Format: +254712345678 or 0712345678

**Click** Pay with M-Pesa

**Expected:**
- [ ] Page shows "Payment prompt sent to your phone"
- [ ] Status shows "pending"
- [ ] M-Pesa prompt appears on your phone in 5-10 seconds
- [ ] Server logs show: `📱 Initiating STK Push` and `✅ STK Push successful!`

---

### Test 3: Complete Payment

**On Your Phone:**
1. M-Pesa prompt appears
2. Enter your M-Pesa PIN
3. Confirm payment

**Expected:**
- [ ] M-Pesa shows "KES 50 sent successfully"
- [ ] Browser shows success message (within 30 seconds)
- [ ] Ticket now shows ⭐ icon and golden styling
- [ ] Server logs show: `🔔 M-Pesa Callback Received` and `✅ Payment successful`

---

### Test 4: Verify Database

**In your PostgreSQL:**

```sql
SELECT id, name, is_golden, mpesa_status, golden_ticket_ref, mpesa_paid_at 
FROM queue_entries 
ORDER BY created_at DESC 
LIMIT 1;
```

**Expected:**
- `is_golden: true`
- `mpesa_status: 'success'`
- `golden_ticket_ref: GT-REG-20260531-001` (or similar)
- `mpesa_paid_at: 2026-05-31 12:34:56 UTC` (current timestamp)

---

### Test 5: Handle Cancellation

**Initiate another payment** but cancel on M-Pesa prompt

**Expected:**
- [ ] Browser shows "Payment failed" after a few seconds
- [ ] Database shows `mpesa_status: 'failed'`
- [ ] Ticket is NOT upgraded (`is_golden: false`)
- [ ] Can retry payment

---

## ⚠️ COMMON PRODUCTION ISSUES

### Issue: "M-Pesa credentials not configured"

**Cause:** Environment variables not set correctly

**Fix:**
1. Check variable names in Render are exact: `CONSUMER_KEY`, `CONSUMER_SECRET`, etc.
2. No spaces before/after values
3. Check database is connected (DATABASE_URL set)
4. Restart service: Render dashboard → Service → Redeploy

---

### Issue: STK Not Appearing on Phone

**Possible Causes:**

1. **Wrong Phone Number**
   - [ ] Verify phone is Safaricom M-Pesa enabled
   - [ ] Try another phone
   - [ ] Check format: +254712345678

2. **Credentials Invalid**
   - [ ] Double-check CONSUMER_KEY, CONSUMER_SECRET in Daraja
   - [ ] Verify app is in "Active" state
   - [ ] Try resetting credentials in Daraja
   - [ ] Check if app permissions changed

3. **Callback URL Not Whitelisted**
   - [ ] Log into Daraja dashboard
   - [ ] Go to M-Pesa Online settings
   - [ ] Verify callback URL is in whitelist
   - [ ] Must be HTTPS

4. **Daily/Hourly Rate Limits**
   - [ ] Wait 5 minutes and try again
   - [ ] Check if you've exceeded M-Pesa sandbox/production limits

5. **Network Issues**
   - [ ] Check Render logs for timeout errors
   - [ ] Verify M-Pesa API endpoint is reachable from Render
   - [ ] M-Pesa servers might be down (rare)

**Debug:**
```
Check Render logs for:
❌ Failed to get M-PESA access token
❌ STK Push error: ResponseCode=
❌ Error parsing response
```

---

### Issue: Payment Succeeds But Not Marked as Golden

**Possible Causes:**

1. **Callback Not Received**
   - [ ] Verify callback URL in Daraja whitelist
   - [ ] Check Render logs for incoming callback: `🔔 M-Pesa Callback Received`
   - [ ] If not there, M-Pesa can't reach your endpoint

2. **Callback URL Mismatch**
   - [ ] Verify `CALLBACK_URL` env var matches Daraja whitelist exactly
   - [ ] No trailing slashes
   - [ ] HTTPS required

3. **Database Connection Failed**
   - [ ] Check Render logs for database errors
   - [ ] Verify `DATABASE_URL` is set and correct
   - [ ] Test connection: `psql $DATABASE_URL`

**Debug:**
```sql
-- Check if payment was received by looking at mpesa_transaction_id
SELECT id, mpesa_status, mpesa_transaction_id, mpesa_paid_at 
FROM queue_entries 
WHERE is_golden = false AND mpesa_transaction_id IS NOT NULL;

-- Should show recently paid entries with mpesa_transaction_id set
-- If mpesa_status is 'pending' for old entries, callback never arrived
```

---

### Issue: "Callback URL must be HTTPS"

**Cause:** You used HTTP instead of HTTPS

**Fix:**
1. Use HTTPS domain: `https://jkuat-online-queue.onrender.com`
2. Not `http://...`
3. Update in Daraja whitelist
4. Update `CALLBACK_URL` env var

---

## 🚀 MONITOR AFTER DEPLOYMENT

### Daily Checks

1. **Check Status Endpoint**
   ```bash
   curl https://jkuat-online-queue.onrender.com/api/queue/getQueueStatus
   ```
   Should return 200 OK

2. **Watch Logs for Errors**
   ```
   https://dashboard.render.com/web/srv-xxxxx/logs
   ```
   Look for:
   - ❌ Any M-Pesa errors
   - ❌ Database connection errors
   - ❌ Callback failures

3. **Test Payment Occasionally**
   - Initiate a test payment with small amount
   - Verify it completes successfully
   - Check database updated

### Weekly Checks

1. **Count Successful Payments**
   ```sql
   SELECT COUNT(*) as golden_tickets 
   FROM queue_entries 
   WHERE mpesa_status = 'success';
   ```

2. **Check Failed Payments**
   ```sql
   SELECT COUNT(*) as failed_payments 
   FROM queue_entries 
   WHERE mpesa_status = 'failed';
   ```

3. **Verify Callback Health**
   ```sql
   SELECT 
     COUNT(*) as total_attempts,
     COUNT(CASE WHEN mpesa_status = 'success' THEN 1 END) as successful,
     COUNT(CASE WHEN mpesa_status = 'failed' THEN 1 END) as failed
   FROM queue_entries 
   WHERE mpesa_transaction_id IS NOT NULL;
   ```

---

## 📞 SUPPORT

### If Payment Fails

1. **Check Render Logs:**
   - Go to https://dashboard.render.com/web/srv-xxxxx/logs
   - Search for error messages
   - Look for `❌`, `Error`, `failed`

2. **Check Daraja Status:**
   - Visit https://developer.safaricom.co.ke/dashboard/myapps
   - Is app in "Active" state?
   - Check your account balance/limits

3. **Test Callback URL Directly:**
   ```bash
   curl -X POST https://your-domain.com/api/queue/mpesa-callback \
     -H "Content-Type: application/json" \
     -d '{"Body":{"stkCallback":{"ResultCode":0}}}'
   ```
   Should return 200 OK

4. **Check M-Pesa Status:**
   - Is M-Pesa server down? (check Safaricom Twitter)
   - Are you rate-limited?
   - Is your account active?

---

## ✅ FINAL CHECKLIST

Before going live:

- [ ] M-Pesa credentials obtained from Daraja
- [ ] All environment variables set in Render
- [ ] Database migrations applied
- [ ] Callback URL whitelisted in Daraja
- [ ] Code deployed to production
- [ ] Production mode detected in logs (PRODUCTION 🚀)
- [ ] Test payment successful with real phone
- [ ] Database shows payment in queue_entries
- [ ] Render logs monitored and healthy

**Status:** ✅ **READY FOR PRODUCTION**

---

## 🎉 Production is Live!

Your M-Pesa integration is now:
- ✅ Accepting payments
- ✅ Issuing golden tickets
- ✅ Processing callbacks
- ✅ Updating database
- ✅ Ready for production traffic

Monitor regularly and reach out to Safaricom if you encounter issues.

Good luck! 🚀
