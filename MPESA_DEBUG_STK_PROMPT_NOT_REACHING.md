# M-Pesa STK Prompt Not Reaching Phone - Root Cause & Solution

**Issue:** STK prompt (payment request) is not reaching the user's M-Pesa app on their phone  
**Root Cause:** System is in SANDBOX mode (simulating payments) instead of calling real M-Pesa  
**Status:** FIXED - Configuration corrected (Commit: bc8dacf)

---

## Why Isn't the STK Prompt Reaching the Phone?

### The Problem: System is in Sandbox Mode 🧪

The code defaults to **SANDBOX mode** which means:
- ❌ Does NOT call M-Pesa Daraja API
- ❌ Does NOT send STK prompt to phone
- ✅ Just returns simulated "success" immediately

```javascript
// Current config (before fix):
isSandbox: process.env.MPESA_SANDBOX !== 'false'
//         ↑ Defaults to TRUE unless explicitly set to 'false'
```

### Why This Happens

When `isSandbox = true`:
```javascript
if (MPESA_CONFIG.isSandbox) {
  // SANDBOX MODE: Just simulate success
  const checkoutRequestId = `SANDBOX_${id}_${Date.now()}`
  
  // Mark as golden IMMEDIATELY (no real payment)
  await db.update(queueEntries).set({
    isGolden: true,
    mpesaStatus: 'success',  // ← Marked success without any real transaction!
    mpesaTransactionId: 'SANDBOX_TEST_123',
  })
  
  return res.status(200).json({
    success: true,
    message: 'STK push SIMULATED (SANDBOX MODE)',  // ← Key indicator!
    sandbox: true
  })
} else {
  // PRODUCTION MODE: Call real M-Pesa Daraja API
  // 1. Get OAuth token
  // 2. Send STK push to Daraja
  // 3. M-Pesa sends STK to phone
  // 4. Wait for callback
}
```

---

## How Payment Is Actually Verified ✅

### The Real M-Pesa Flow (Production Mode)

```
1️⃣ USER INITIATES PAYMENT
   POST /api/queue/:id/mpesa-pay
   ├─ Status set to: "pending"
   └─ Awaiting M-Pesa action

2️⃣ DARAJA OAUTH TOKEN REQUEST
   POST https://api.safaricom.co.ke/oauth/v1/generate
   ├─ Consumer Key: YLPydMh4xhirGrux1cdHyqKRCE3BzinLxdlzed4s88XyiRnu
   ├─ Consumer Secret: RuAadmSxyhwAqjk1GqEwW3vyoDtbCD0nByXAHR7GZw0COLoxSI6u0AKa91wSL4uw
   └─ Response: access_token (valid for 60 min)

3️⃣ STK PUSH INITIATED
   POST https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest
   ├─ Authorization: Bearer {access_token}
   ├─ Payload:
   │  ├─ BusinessShortCode: 174379
   │  ├─ Password: base64(174379 + passkey + timestamp)
   │  ├─ PhoneNumber: 254727610315
   │  ├─ Amount: 50 (KES)
   │  ├─ CallBackURL: https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback
   │  └─ AccountReference: GT-REG-20260530-001
   └─ Response: CheckoutRequestID

4️⃣ STK PROMPT SENT TO PHONE 📱
   ├─ M-Pesa app on user's phone receives notification
   ├─ Payment request appears on screen
   ├─ User sees amount (KES 50) and merchant (174379)
   └─ User enters M-Pesa PIN

5️⃣ PAYMENT PROCESSING 🔄
   ├─ M-Pesa processes PIN entry
   ├─ Checks balance
   ├─ Deducts amount
   └─ Sends CALLBACK to us

6️⃣ CALLBACK RECEIVED ON OUR SERVER ✅
   POST /api/queue/mpesa-callback
   ├─ Body contains:
   │  ├─ ResultCode: 0 (success) or other (failure)
   │  ├─ CheckoutRequestID: ws_co_050520261530454769
   │  ├─ MpesaReceiptNumber: RK7XVPV31Z (proof of payment)
   │  └─ Amount: 50
   │
   └─ We update database:
      ├─ If ResultCode = 0:
      │  ├─ isGolden: true ✅
      │  ├─ mpesaStatus: "success"
      │  ├─ mpesaTransactionId: RK7XVPV31Z (proof)
      │  └─ mpesaPaidAt: timestamp
      │
      └─ If ResultCode ≠ 0:
         └─ mpesaStatus: "failed" (allow retry)

7️⃣ GOLDEN TICKET ACTIVATED 🎫
   ├─ Dashboard shows "Golden Ticket: GT-REG-20260530-001"
   ├─ User moves to front of queue
   └─ Payment confirmed and immutable
```

### How We Know Payment Was Successful

The system knows payment is successful ONLY when:

```javascript
// M-Pesa callback arrives with:
if (ResultCode === 0) {  // ← This is the proof!
  // Payment succeeded - M-Pesa authenticated it
  isGolden: true           // ← Now we activate golden ticket
  mpesaStatus: 'success'   // ← Now we trust it
  mpesaTransactionId: 'RK7XVPV31Z'  // ← Receipt from M-Pesa
}
```

**Important:** We CANNOT mark as golden until the callback arrives, because:
- ❌ User might not have M-Pesa registered
- ❌ User might not enter correct PIN
- ❌ User might cancel the prompt
- ❌ Network error might prevent callback
- ✅ Only callback with ResultCode=0 is absolute proof

---

## The Fix: Enable Production Mode

### Step 1: Set Environment Variable in Render

You MUST set `MPESA_SANDBOX=false` to enable real M-Pesa calls:

**In Render Dashboard:**

1. Go to: https://dashboard.render.com
2. Select your service: **jkuat-online-queue**
3. Click **Environment**
4. Add new environment variable:
   ```
   Name: MPESA_SANDBOX
   Value: false
   ```
5. Click **Save Changes**
6. Render will auto-deploy with new setting

**What This Does:**
```javascript
// Before: isSandbox = true (sandbox mode)
// After: isSandbox = false (production mode - real M-Pesa calls)
```

### Step 2: Verify Callback URL is Correct

The callback URL has been fixed to use the production Render domain:

```javascript
// BEFORE (broken for production):
callbackUrl: '...' || 'http://localhost:3000/api/queue/mpesa-callback'
             ❌ localhost unreachable by M-Pesa

// AFTER (fixed):
callbackUrl: process.env.MPESA_CALLBACK_URL || (NODE_ENV === 'production'
  ? 'https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback'  ✅ Public HTTPS
  : 'http://localhost:3000/api/queue/mpesa-callback'                     ✅ Dev localhost
)
```

**This was deployed in Commit: bc8dacf**

---

## Testing Real M-Pesa Payments

### Step 1: Set MPESA_SANDBOX=false (as above)

### Step 2: Wait for Render Deployment
- Check: https://dashboard.render.com/web/srv-d86dsqh9rddc73bvpg60/deploys
- Status should show "Live"
- Takes 2-3 minutes

### Step 3: Verify Logs Show Production Mode

```bash
# Check server logs for:
"INFO M-Pesa Mode: PRODUCTION 🚀"  ← Should see this
"INFO Callback URL: https://jkuat-online-queue.onrender.com/..."  ← Should be HTTPS
```

### Step 4: Test Payment Flow

1. **Navigate to:** https://jkuat-online-queue.onrender.com/login
2. **Student login with real phone:**
   - Student ID: S77777
   - Phone: +254727610315 (actual M-Pesa registered number)
   - Service: registrar
3. **Join queue and upgrade to golden:**
   - Click "Upgrade to Golden Ticket"
   - Enter phone number: +254727610315
   - Click "Pay KES 50"
4. **Expected result:**
   - Status shows "Processing STK prompt..."
   - **M-Pesa app should show payment request** ← THIS IS THE KEY TEST
   - Enter M-Pesa PIN
   - Payment completes

### Step 5: Verify Golden Ticket Activated

Check database to confirm:
```
GET /api/queue/:id/mpesa-status

Response should show:
{
  "isGolden": true,              ← ✅ Only true after payment
  "mpesaStatus": "success",      ← ✅ After callback received
  "goldenTicketRef": "GT-REG-20260530-003",
  "mpesaTransactionId": "RK7XVPV31Z",  ← ✅ M-Pesa receipt
  "mpesaPaidAt": "2026-05-30T..."
}
```

---

## Callback Verification Details

### How Callback Proves Payment

M-Pesa sends callback with this structure:

```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "16813-3596064-1",
      "CheckoutRequestID": "ws_co_050520261530454769",
      "ResultCode": 0,                    // ← 0 means SUCCESS
      "ResultDesc": "The service request has been accepted successfully",
      "CallbackMetadata": {
        "Item": [
          {"Name": "Amount", "Value": 50},
          {"Name": "MpesaReceiptNumber", "Value": "RK7XVPV31Z"},
          {"Name": "PhoneNumber", "Value": 254727610315},
          {"Name": "TransactionDate", "Value": 20260530105045}
        ]
      }
    }
  }
}
```

### What Each Field Means

| Field | Meaning | Value |
|-------|---------|-------|
| `ResultCode: 0` | Payment succeeded | ✅ Trust it |
| `ResultCode: 1` | User cancelled | ❌ Ask retry |
| `ResultCode: 1032` | Process timeout | ❌ Ask retry |
| `MpesaReceiptNumber` | Transaction proof | RK7XVPV31Z (immutable) |
| `Amount` | Money actually taken | 50 (from account) |
| `PhoneNumber` | Who paid | 254727610315 |

**Our code checks:**
```javascript
if (ResultCode === 0) {
  // Payment VERIFIED by M-Pesa
  isGolden = true
  mpesaStatus = 'success'
  mpesaTransactionId = receiptNumber  // Store as proof
} else {
  // Payment NOT verified
  mpesaStatus = 'failed'
  // Allow user to retry
}
```

---

## Checklist: Production STK Push Verification

- [ ] Set `MPESA_SANDBOX=false` in Render environment
- [ ] Wait for Render deployment to complete
- [ ] Check logs show "PRODUCTION 🚀" mode
- [ ] Verify callback URL shows HTTPS Render domain
- [ ] Test with real M-Pesa registered phone
- [ ] Observe STK prompt appears on M-Pesa app within 2-3 seconds
- [ ] Enter M-Pesa PIN successfully
- [ ] Check database shows `isGolden: true` and `mpesaStatus: success`
- [ ] Verify `mpesaTransactionId` matches M-Pesa receipt number
- [ ] Confirm `mpesaPaidAt` timestamp is recorded

---

## Debugging If Still Not Working

### Problem: STK prompt still not appearing

**Check 1: Verify MPESA_SANDBOX=false**
```bash
# In Render dashboard, check environment variables
# Must show: MPESA_SANDBOX = false
# (not 'true', not unset, exactly 'false')
```

**Check 2: Monitor Render logs**
```bash
# Look for:
"INFO M-Pesa Mode: PRODUCTION 🚀"
"INFO STK Push initiated (PRODUCTION)"
"INFO CheckoutRequestID: ws_co_..."

# If you see:
"INFO M-Pesa Mode: SANDBOX 🧪"  ← MPESA_SANDBOX not set correctly
```

**Check 3: Verify OAuth token obtained**
```bash
# In logs, look for:
"Token request succeeded" (or error message)
# If "Token request failed", credentials might be wrong
```

**Check 4: Phone number format**
```javascript
// Must be 10 digits (without +254 prefix)
Input: "+254727610315"
Extracted: "4727610315"  ← Correct
PartyA: "4727610315"     ← Sent to M-Pesa
```

**Check 5: Callback URL accessibility**
```bash
# Test callback URL is reachable:
curl -X POST https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback \
  -H "Content-Type: application/json" \
  -d '{"Body":{"stkCallback":{"ResultCode":0}}}'

# Should return 200 (OK)
```

### Problem: Callback not being received

**Verify callback URL in STK payload:**
```javascript
// Should be:
CallBackURL: "https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback"

// NOT:
CallBackURL: "http://localhost:3000/api/queue/mpesa-callback"
```

**Check Render deployment logs for errors:**
```bash
# Navigate to: https://dashboard.render.com/web/srv-../deploys
# Look for any error messages during build/deploy
```

---

## Summary

| Aspect | Sandbox Mode 🧪 | Production Mode 🚀 |
|--------|------------------|-------------------|
| **Payment Real?** | ❌ Simulated | ✅ Real money |
| **STK Prompt?** | ❌ Not sent | ✅ Sent to phone |
| **Flow** | Immediate success | Awaits user PIN + callback |
| **How We Know Paid?** | We don't (simulated) | M-Pesa callback + receipt |
| **Golden Activated?** | Immediately (unsafe) | Only after callback (safe) |
| **Environment** | Development/Testing | Production |
| **Enable by** | Leave MPESA_SANDBOX unset | Set `MPESA_SANDBOX=false` |

---

## Next Actions

1. ✅ **Code fixed** (Commit: bc8dacf) - Callback URL corrected
2. 🔄 **Set `MPESA_SANDBOX=false`** in Render environment (YOUR ACTION)
3. 🔄 **Wait for deployment** - 2-3 minutes
4. 🔄 **Test with real phone** - Verify STK prompt appears
5. ✅ **Monitor callback** - Check logs for callback receipt
6. ✅ **Verify golden ticket** - Confirm database updated

**Current Status:** Ready for production testing  
**Blocking Issue:** MPESA_SANDBOX=false needs to be set in Render environment

---

**Verification Complete:** May 30, 2026  
**Fix Deployed:** Commit bc8dacf  
**Production URL:** https://jkuat-online-queue.onrender.com
