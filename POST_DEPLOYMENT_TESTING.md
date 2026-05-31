# Post-Deployment M-Pesa Callback Testing Guide

**Last Updated:** May 31, 2026  
**Tested Against:** Production deployment on Render

---

## Quick Verification (5 minutes)

### Step 1: Check Server Health

```bash
curl https://jkuat-online-queue.onrender.com/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-05-31T14:30:00Z",
  "environment": "production",
  "databaseConnected": true
}
```

✅ **Pass if:** Database shows `true`  
❌ **Fail if:** `databaseConnected: false`

---

### Step 2: Verify M-Pesa Configuration

```bash
curl https://jkuat-online-queue.onrender.com/api/mpesa/diagnose
```

**Expected Response:**
```json
{
  "status": "ok",
  "environment": "production",
  "shortcode": "your_till_number",
  "consumerKeyPresent": true,
  "consumerSecretPresent": true,
  "passkeyPresent": true,
  "callbackUrl": "https://jkuat-online-queue.onrender.com/api/mpesa/callback",
  "oauthTest": "passed"
}
```

✅ **Pass if:**
- All keys show `true`
- `oauthTest` shows `"passed"`
- `callbackUrl` is correct HTTPS URL

❌ **Fail if:**
- Any key shows `false`
- `oauthTest` shows error
- `callbackUrl` is not HTTPS

---

### Step 3: Check Payment Status

```bash
curl https://jkuat-online-queue.onrender.com/api/mpesa/pending
```

**Expected Response:**
```json
{
  "pending": 0,
  "successful": 5,
  "failed": 1,
  "total": 6,
  "payments": [...]
}
```

✅ **Pass if:** Endpoint responds with payment counts  
❌ **Fail if:** HTTP error or database error

---

## Full Transaction Test (15 minutes)

### Manual Test Procedure

**Prerequisites:**
- Valid M-Pesa account with test phone number
- Access to the web app at your deployed URL
- Access to the phone for entering M-Pesa PIN

**Steps:**

#### 1. Join Queue
1. Open browser to `https://your-deployed-site.onrender.com`
2. Select a service (e.g., "Registrar")
3. Click "Join Queue"
4. Note the **queue number** shown (e.g., Queue #5)
5. Note the **queue entry ID** from the URL or response

#### 2. Initiate Golden Ticket Payment
1. Find your queue entry on the dashboard
2. Click "Upgrade to Golden Ticket" or similar button
3. Enter your M-Pesa phone number
4. Click "Pay with M-Pesa"

**Expected:**
```json
{
  "success": true,
  "checkoutRequestId": "ws_CO_12345...",
  "message": "STK push initiated - Check your phone for M-Pesa prompt.",
  "mpesaStatus": "pending",
  "goldenTicketRef": "GT-REG-20260531-001"
}
```

✅ **Pass if:**
- You see STK prompt on your phone within 10 seconds
- `mpesaStatus` shows `"pending"`

❌ **Fail if:**
- No STK prompt appears
- Error message about credentials

#### 3. Complete M-Pesa Transaction
1. Look at your phone - you should see **STK Push prompt**
2. Enter your **M-Pesa PIN**
3. Wait for confirmation

**Phone Display:**
```
JKUAT Queue System
Enter your M-Pesa PIN
Amount: KES 200
Account: GT-REG-20260531-001
[****]
```

✅ **Pass if:** Prompt appears on phone within 10 seconds

#### 4. Verify Database Update
Immediately after PIN entry, the backend receives a callback:

**Server Logs (check in Render dashboard):**
```
📞 M-Pesa Callback received from Safaricom
🔍 Lookup: CheckoutRequestID = ws_CO_12345..., ResultCode = 0
📋 Found queue entry: ID=42, GoldenRef=GT-REG-20260531-001, Status=pending
✅ M-Pesa payment SUCCESS for queue 42
   Receipt: PBL123456789, Amount: KES 200, Phone: 254712345678
🎉 Golden ticket ACTIVATED: GT-REG-20260531-001
```

✅ **Pass if:** Logs show "Golden ticket ACTIVATED"

#### 5. Verify Frontend Update
Frontend polls `/api/queue/:id/mpesa-status` every 5 seconds:

```bash
curl "https://jkuat-online-queue.onrender.com/api/queue/42/mpesa-status"
```

**Expected Response:**
```json
{
  "id": 42,
  "queueNumber": 5,
  "isGolden": true,
  "goldenTicketRef": "GT-REG-20260531-001",
  "mpesaStatus": "success",
  "feedback": {
    "isPending": false,
    "isSuccessful": true,
    "isFailed": false,
    "message": "✅ Golden ticket activated! You now have priority status."
  }
}
```

✅ **Pass if:**
- `isGolden: true`
- `mpesaStatus: 'success'`
- `isSuccessful: true`

#### 6. Verify Dashboard Update
1. Go back to web app dashboard
2. Your queue entry should now show **"Golden Ticket"** badge
3. Queue position should be at **top** (priority)

✅ **Pass if:** Golden ticket badge shows on your entry

---

## Verification Checklist

### Pre-Deployment
- [ ] Database URL set in Render environment variables
- [ ] All M-Pesa credentials set:
  - [ ] `MPESA_CONSUMER_KEY`
  - [ ] `MPESA_CONSUMER_SECRET`
  - [ ] `MPESA_PASSKEY`
  - [ ] `MPESA_SHORTCODE`
  - [ ] `MPESA_ENVIRONMENT=production`
  - [ ] `MPESA_CALLBACK_URL=https://jkuat-online-queue.onrender.com/api/mpesa/callback`

### Post-Deployment
- [ ] Server health check passes
- [ ] M-Pesa diagnostics show all green
- [ ] Payment monitoring endpoint works
- [ ] Manual transaction test completes successfully

### After First Real Transaction
- [ ] Callback received (check logs)
- [ ] Database updated with:
  - [ ] `isGolden = true`
  - [ ] `mpesaStatus = 'success'`
  - [ ] `mpesaPaidAt = timestamp`
- [ ] Frontend shows golden ticket badge
- [ ] User moved to priority queue position

---

## Troubleshooting

### Problem: STK Prompt Not Appearing

**Possible Causes:**
1. M-Pesa credentials not set or incorrect
2. Phone number format wrong (must be 254712345678)
3. Amount too low
4. Service account not active

**How to Verify:**
```bash
# Check if credentials are loaded
curl https://jkuat-online-queue.onrender.com/api/mpesa/diagnose
```

**Action:**
- Verify `consumerKeyPresent`, `consumerSecretPresent`, `passkeyPresent` all show `true`
- If not, add missing variables to Render dashboard
- Restart app: Dashboard > Settings > Restart

### Problem: Callback Received but Database Not Updated

**Possible Causes:**
1. Database connection error
2. Queue entry ID mismatch
3. CheckoutRequestID not stored correctly

**How to Verify:**
```bash
# Check if database is responding
curl https://jkuat-online-queue.onrender.com/health
```

**Check Logs:**
1. Go to Render dashboard
2. Click your app
3. Logs tab
4. Search for: `Error processing M-Pesa callback`

**Action:**
- Verify `DATABASE_URL` is correct
- Check for database migration errors in logs
- Ensure queue entry was created before payment attempt

### Problem: Golden Ticket Not Showing on Frontend

**Possible Causes:**
1. Frontend not polling correctly
2. API response format wrong
3. Cache issue

**How to Verify:**
```bash
# Get status directly
curl "https://jkuat-online-queue.onrender.com/api/queue/42/mpesa-status"
```

**Action:**
- Hard refresh browser (Ctrl+F5 on Windows, Cmd+Shift+R on Mac)
- Check browser console for fetch errors
- Verify API response shows `isGolden: true`

### Problem: "Database not ready" Errors

**Cause:** Express server responding to requests before database initialized

**Solution:**
This is already handled in your code, but if it persists:

1. Check `DATABASE_URL` is set
2. Verify PostgreSQL server is running
3. Restart app on Render dashboard
4. Check Render logs for connection timeout

---

## Live Monitoring After Deployment

### Monitor Payment Status in Real-Time

**Terminal 1: Monitor All Payments**
```bash
watch -n 5 'curl -s https://jkuat-online-queue.onrender.com/api/mpesa/pending | jq'
```

This updates every 5 seconds with:
- Pending payments
- Successful payments
- Failed payments

**Terminal 2: Watch Server Logs**
1. Go to Render dashboard
2. Select your app
3. Click "Logs"
4. Search for "M-Pesa" to see transactions
5. OR search for "Error" to find problems

**Terminal 3: Monitor Specific Queue Entry**
```bash
watch -n 2 'curl -s "https://jkuat-online-queue.onrender.com/api/queue/42/mpesa-status" | jq'
```

Replace `42` with actual queue entry ID

---

## Testing Checklist - Copy & Paste

```markdown
## M-Pesa Callback Verification (Date: _________)

### Before Deployment
- [ ] MPESA_CONSUMER_KEY set
- [ ] MPESA_CONSUMER_SECRET set
- [ ] MPESA_PASSKEY set
- [ ] MPESA_SHORTCODE set
- [ ] MPESA_ENVIRONMENT = production
- [ ] MPESA_CALLBACK_URL = https://jkuat-online-queue.onrender.com/api/mpesa/callback
- [ ] DATABASE_URL set
- [ ] NODE_ENV = production

### After Deployment - Quick Checks
- [ ] Server health: ✅ (databaseConnected=true)
- [ ] M-Pesa config: ✅ (status=ok, oauthTest=passed)
- [ ] Payments endpoint: ✅ (responds with payment counts)

### After First Transaction
- [ ] STK prompt received on phone: ✅
- [ ] M-Pesa PIN entered: ✅
- [ ] Callback received by server: ✅ (check logs for "Golden ticket ACTIVATED")
- [ ] Database updated: ✅ (isGolden=true)
- [ ] Frontend shows golden ticket: ✅
- [ ] Queue position moved to priority: ✅

### Verified By
- Name: _________________
- Date: _________________
- Time: _________________
- Test Transaction Amount: KES 200
- Result: ✅ PASSED / ❌ FAILED (notes: ___________)
```

---

## Success Indicators

You'll know everything is working when you see:

1. **On the phone:** STK prompt appears within 10 seconds
2. **In Render logs:** "🎉 Golden ticket ACTIVATED" message
3. **On dashboard:** User's queue entry shows golden badge
4. **In database:** Entry marked `isGolden = true`, `mpesaStatus = 'success'`
5. **In user experience:** Priority queue position is honored

---

## Emergency Contacts

If things don't work:

**Check these files first:**
- [MPESA_CALLBACK_VERIFICATION.md](MPESA_CALLBACK_VERIFICATION.md) - Full technical details
- [API_TESTING.md](API_TESTING.md) - API endpoint documentation
- Render App Logs - Search for "Error" or "M-Pesa"

**Verification script:**
```bash
node verify-mpesa-deployment.js https://jkuat-online-queue.onrender.com
```

---

## Success Confirmation

Once you've completed the manual test and all checks pass:

```
✅ M-Pesa Callback System VERIFIED
   - STK prompts sending correctly
   - Callbacks being received
   - Database updating properly
   - Frontend reflecting changes
   - Golden ticket priority working

🚀 System is PRODUCTION READY
```

Record this date and keep for your records.
