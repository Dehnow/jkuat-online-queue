# 🔍 M-PESA STK PROMPT NOT REACHING PHONE - DIAGNOSTIC GUIDE

## Problem
STK prompt is not reaching the phone after payment initiation returns success.

---

## Root Causes & Solutions

### ❌ Issue #1: SANDBOX MODE (Most Common)
**Status**: 🔴 **LIKELY CULPRIT**

**How to Detect**:
```
Check Render dashboard logs for:
"INFO M-Pesa Mode: SANDBOX 🧪 (simulated payments)"
```

**Problem**: System is in sandbox mode by default. No real STK prompts are sent to phones in sandbox mode.

**Solution**:
1. Go to [Render Dashboard](https://dashboard.render.com/web/srv-d86dsqh9rddc73bvpg60/env)
2. Click "Environment"
3. Add variable:
   ```
   MPESA_SANDBOX = false
   ```
4. Redeploy the app
5. Check logs: Should now show `"INFO M-Pesa Mode: PRODUCTION 🚀 (real M-Pesa)"`

---

### ❌ Issue #2: INVALID CREDENTIALS
**Status**: 🔴 **MUST FIX FOR PRODUCTION**

**How to Detect**:
```
Check Render logs for:
"ERROR Token request failed (401): Unauthorized"
OR
"ERROR STK Push failed: Invalid credentials"
```

**Problem**: Using sandbox credentials in production, or production credentials not set.

**What You Need**:
From Safaricom Daraja Dashboard (https://developer.safaricom.co.ke/):
1. **Consumer Key** (from App credentials)
2. **Consumer Secret** (from App credentials)
3. **Passkey** (from M-Pesa Online)
4. **Till Number/Shortcode** (from M-Pesa Online)

**Solution**:
1. Go to Render Environment variables
2. Set these variables with YOUR real credentials:
   ```
   CONSUMER_KEY = [your_actual_consumer_key]
   CONSUMER_SECRET = [your_actual_consumer_secret]
   PASSKEY = [your_actual_passkey]
   SHORTCODE = [your_actual_till_number]
   MPESA_SANDBOX = false
   ```
3. Redeploy

---

### ❌ Issue #3: CALLBACK URL UNREACHABLE
**Status**: 🔴 **CRITICAL**

**How to Detect**:
```
M-Pesa accepts the STK request (ResponseCode 0)
BUT phone never gets the prompt
AND you never see a callback in server logs
```

**Why This Happens**:
- M-Pesa can't reach your callback endpoint
- It can't confirm payment delivery
- It doesn't send the STK prompt

**Check**:
1. Go to Render Logs
2. Look for: `"INFO Callback URL: [URL]"`
3. Make sure it shows: `https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback`

**If Wrong**:
1. Set in Render environment:
   ```
   CALLBACK_URL = https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback
   ```
2. Redeploy

**Test Callback Is Reachable**:
```bash
curl -X GET https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback
# Should NOT return 404 or timeout
```

---

### ❌ Issue #4: INVALID PHONE NUMBER FORMAT
**Status**: 🟡 **CHECK IF YOU'RE ENTERING CORRECTLY**

**Accepted Formats**:
✅ `+254712345678` (with + prefix)
✅ `0712345678` (with 0 prefix, auto-converted)
✅ `254712345678` (full number)

**NOT Accepted**:
❌ `12345678` (missing country code)
❌ `712345678` (missing prefix)
❌ `+1712345678` (wrong country code)

**System Auto-Converts To**: `254712345678` (no spaces, no special chars)

---

### ❌ Issue #5: AMOUNT TOO LOW OR INVALID
**Status**: 🟡 **UNLIKELY BUT POSSIBLE**

**Current Amount**: KES 50

**M-Pesa Minimum**: Usually KES 1-KES 70,000

**If You Changed Amount**:
- Ensure it's between 1 and 70,000
- Check code at line 1194 in api-server.js: `Amount: 50`

---

### ❌ Issue #6: TILL NUMBER (SHORTCODE) INVALID
**Status**: 🟡 **CHECK IN PRODUCTION**

**Sandbox Shortcode**: `174379` ✅ (works for sandbox)
**Your Production Shortcode**: Should be from your Daraja account

**If Using Wrong Shortcode**:
- M-Pesa rejects or ignores the request
- Phone doesn't get prompt

**Check**:
1. Go to Render logs
2. Look for: `"INFO Till Number: 174379"` (or your number)
3. If it's 174379 AND you set `MPESA_SANDBOX = false`, that's the problem!

---

## Quick Fix Checklist

### For Sandbox Testing (No Real STK)
- [ ] System is in sandbox mode (default)
- [ ] Using sandbox credentials (default)
- [ ] Callback URL is set
- Expected: No real STK prompt

### For Production Testing (Real STK)
- [ ] `MPESA_SANDBOX = false` in Render
- [ ] Real consumer key & secret from Daraja
- [ ] Real passkey from Daraja
- [ ] Real till number from Daraja
- [ ] Callback URL is correct HTTPS URL
- [ ] Redeployed after env changes
- Expected: Real STK prompt on phone

---

## Step-by-Step Fix

### Step 1: Check Current Mode
```bash
# View Render logs
# Look for line: "INFO M-Pesa Mode: ..."
```

### Step 2: If Sandbox Mode (expected):
- This is correct for testing
- No real STK prompts will appear
- To fully test, you need production credentials

### Step 3: If Production Mode but Not Working:
1. Check credentials are valid in Daraja dashboard
2. Test credentials with a simple auth test:
   ```
   curl -X GET https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials \
     -H "Authorization: Basic [base64(key:secret)]"
   # Should return: {"access_token": "..."}
   ```

### Step 4: Deploy and Test
```bash
# After setting env variables:
1. Go to Render dashboard
2. Trigger manual deploy
3. Wait for "Build succeeded"
4. Check logs for: "INFO M-Pesa Mode: ..."
5. Try STK push again
```

---

## Error Messages & Meanings

| Error | Cause | Fix |
|-------|-------|-----|
| `ResponseCode: 01` | Invalid credentials | Check CONSUMER_KEY, CONSUMER_SECRET in Daraja |
| `ResponseCode: 08` | System error | Try again, contact Safaricom |
| `ResponseCode: 20` | Invalid password | Check PASSKEY in Daraja |
| `ResponseCode: 25` | Invalid account | Check SHORTCODE in Daraja |
| `Token request failed (401)` | Invalid credentials | Verify key & secret in Render env |
| No callback received | URL unreachable | Verify CALLBACK_URL is accessible |
| Prompt not on phone | Multiple issues | Run through checklist above |

---

## Testing Different Scenarios

### Test 1: Sandbox Mode (No Real Payments)
```
Environment: NODE_ENV=production (Render)
MPESA_SANDBOX: (not set, defaults to true)
Result: Database gets pending status, no real STK
```

### Test 2: Production Mode (Real M-Pesa)
```
Environment: NODE_ENV=production (Render)
MPESA_SANDBOX: false
CONSUMER_KEY: [real key]
CONSUMER_SECRET: [real secret]
PASSKEY: [real passkey]
SHORTCODE: [real till]
Result: Real STK prompt on phone
```

---

## Next Actions

1. **Check current logs**: View Render dashboard logs
2. **Identify mode**: Is it sandbox or production?
3. **If sandbox**: Expected behavior - no real prompt
4. **If production**: Follow the fix checklist
5. **Set env variables**: Add `MPESA_SANDBOX`, credentials, callback URL
6. **Redeploy**: Trigger build in Render
7. **Test again**: Try STK push with correct phone number
8. **Monitor logs**: Watch for "STK Push initiated" messages

---

**Last Updated**: 2026-05-30  
**Status**: Diagnostic guide ready  
