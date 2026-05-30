# M-Pesa STK Payment Flow Fix - Testing Guide

## What Was Fixed

### The Problem
Users were experiencing a broken M-Pesa payment flow:
1. Enter phone number
2. Dialog closes immediately saying "successful"
3. **M-Pesa STK prompt never appears on phone**
4. No payment was actually made

### The Root Cause
The backend was **auto-completing** the payment status after 2 seconds without waiting for actual M-Pesa callback. The flow finished before the user could interact with the M-Pesa prompt.

---

## The Fixes

### 1. Backend Fix: Remove Auto-Complete (CRITICAL)
**File**: `src/routes/api/queue/$id/mpesa-pay.ts`

```typescript
// OLD (BROKEN):
setTimeout(async () => {
  // After 2 seconds, mark as success without user interaction
  await db.update(queueEntries).set({
    isGolden: true,
    mpesaStatus: 'success',
    mpesaPaidAt: new Date(),
  })
}, 2000)

// NEW (CORRECT):
// Payment stays PENDING until M-Pesa sends callback
// No auto-complete - wait for user to complete transaction on their phone
```

### 2. Fix Environment Variable Detection
**File**: `src/routes/api/queue/$id/mpesa-pay.ts`

```typescript
// OLD:
const SANDBOX_MODE = process.env.NODE_ENV !== 'production' || process.env.MPESA_SANDBOX === 'true'

// NEW:
const SANDBOX_MODE = process.env.MPESA_ENVIRONMENT === 'sandbox' || process.env.MPESA_SANDBOX === 'true' || process.env.NODE_ENV !== 'production'
```

Now correctly detects sandbox mode from Render environment variables.

### 3. Frontend Fix: Longer Polling & Better UX
**File**: `src/routes/index.tsx`

- **Timeout**: Extended from 2 minutes → 10 minutes
- **Poll Interval**: 2 seconds (unchanged)
- **User Messages**: Much clearer instructions on what to expect
- **Logging**: Console logs help debug payment flow

---

## Correct Payment Flow (Now)

```
1. User enters phone number
   ↓
2. Frontend POSTs to /api/queue/{id}/mpesa-pay
   ↓
3. Backend initiates STK push with M-Pesa Daraja API
   ↓
4. Backend returns: mpesaStatus = 'pending'
   ↓
5. ✅ M-PESA PROMPT APPEARS ON USER'S PHONE ← THIS WAS MISSING
   ↓
6. User enters M-Pesa PIN to authorize payment
   ↓
7. ✅ USER'S ACCOUNT IS DEBITED ← PAYMENT ACTUALLY HAPPENS
   ↓
8. M-Pesa sends callback to /api/queue/mpesa-callback
   ↓
9. Backend updates database: mpesaStatus = 'success'
   ↓
10. Frontend's polling detects success
    ↓
11. Dialog shows: ✅ "Payment Successful!"
```

---

## How to Test

### Test in Sandbox Mode (Recommended)

#### Prerequisites
Ensure Render has these environment variables set:
```
MPESA_ENVIRONMENT=sandbox
MPESA_CONSUMER_KEY=<your_sandbox_key>
MPESA_CONSUMER_SECRET=<your_sandbox_secret>
MPESA_SHORTCODE=174379
MPESA_PASSKEY=bfb279f9ba9b9d1380007480bbe7f27425e1aa6d4ede3891ec337007a74ff42
MPESA_CALLBACK_URL=https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback
```

#### Testing Steps

**Step 1: Join Queue**
1. Go to https://jkuat-online-queue.onrender.com
2. Select a service (Registrar, Finance, or ICT)
3. Fill in details and join queue
4. Note your queue number

**Step 2: Initiate Golden Ticket Payment**
1. Click "⭐ Upgrade to Golden Ticket (KES 50)" on your ticket card
2. Modal opens showing Golden Ticket benefits
3. Enter your phone number (254XXXXXXXXX format)
4. Click "Pay KES 50 with M-Pesa"

**Step 3: Observe Waiting Dialog**
The dialog should show:
```
⏳ Waiting for M-Pesa Confirmation...
Do not close this dialog. The system is waiting for payment 
confirmation from Safaricom.

📱 What to expect:
1️⃣ M-Pesa prompt appears on your phone within seconds
2️⃣ Enter your M-Pesa PIN to authorize payment
3️⃣ You receive M-Pesa confirmation message (KES 50 deducted)
4️⃣ This dialog updates to show ✅ Payment Successful!
```

**Step 4: Simulate M-Pesa Callback (For Testing)**

Since you're in sandbox, you need to manually trigger the callback. Use this test script:

```bash
curl -X POST https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback \
  -H "Content-Type: application/json" \
  -d '{
    "Body": {
      "stkCallback": {
        "MerchantRequestID": "test-merchant-123",
        "CheckoutRequestID": "test-checkout-456",
        "ResultCode": 0,
        "ResultDesc": "The service request has been processed successfully.",
        "CallbackMetadata": {
          "Item": [
            {"Name": "Amount", "Value": 50},
            {"Name": "MpesaReceiptNumber", "Value": "TEST123456789"},
            {"Name": "TransactionDate", "Value": "20260530105000"},
            {"Name": "PhoneNumber", "Value": "254712345678"},
            {"Name": "AccountReference", "Value": "GT-REG-1234567890-ABC123"}
          ]
        }
      }
    }
  }'
```

**Replace** `GT-REG-1234567890-ABC123` with the actual golden ticket reference shown in your queue card.

**Step 5: Verify Success**
1. The dialog should update to show ✅ "Payment Successful!"
2. Your ticket card should now show: "🥇 Golden Ticket Activated"
3. Your ticket is now prioritized in the admin queue

---

## Testing in Production (Real M-Pesa)

Once sandbox testing passes:

1. Update environment variables to production:
```
MPESA_ENVIRONMENT=production
CONSUMER_KEY=<production_key>
CONSUMER_SECRET=<production_secret>
SHORTCODE=<production_shortcode>
PASSKEY=<production_passkey>
```

2. Test with real M-Pesa account (KES 50 will be deducted)

3. **DO NOT** test with your own phone first - use a test M-Pesa account if available

---

## Debugging

### If M-Pesa Prompt Doesn't Appear

1. **Check logs in Render**:
   - Look for: "✅ STK Push initiated"
   - Look for: "waiting for callback"

2. **Check these common issues**:
   - ✓ Phone number format is exactly: 254XXXXXXXXX (11 digits, no spaces)
   - ✓ M-Pesa account exists and is active
   - ✓ M-Pesa account has at least KES 50 balance
   - ✓ Phone has mobile signal or internet
   - ✓ M-Pesa app is updated to latest version

3. **Check database**:
   - Verify `mpesa_status = 'pending'` (not 'success' or 'failed')
   - Verify `golden_ticket_ref` is set (e.g., GT-REG-...)

### If Dialog Shows Success But Payment Didn't Go Through

This would indicate the callback was faked/incorrect:
1. Check `mpesa_status` in database - is it really 'success'?
2. Check if `mpesa_paid_at` is set
3. Check Safaricom Daraja logs for actual transaction

### Browser Console

The frontend logs important messages:
```
✅ M-Pesa payment initiated. Status: pending
📱 Waiting for user to complete payment on their phone...
✅ Payment successful! Status updated from M-Pesa callback.
```

---

## Key Differences From Old Flow

| Old (Broken) | New (Fixed) |
|---|---|
| Auto-completes after 2s | Waits for actual callback |
| No prompt appears on phone | M-Pesa STK prompt appears immediately |
| Dialog shows success instantly | Dialog shows success after payment |
| Payment status never actually changes | Payment marked success only after user pays |
| Confusing UX | Clear messaging about waiting for M-Pesa |

---

## Timeline

When user clicks "Pay KES 50 with M-Pesa":

### OLD (BROKEN) - ~2 seconds
```
0s:  Request sent
0.5s: STK push initiated
0.5-2s: Waiting...
2s: Auto-complete (without user action!)
2.1s: Dialog shows "✅ Payment Successful"
- User never sees M-Pesa prompt
```

### NEW (FIXED) - ~30-60 seconds
```
0s:    Request sent
0.5s:  STK push initiated, payment status = 'pending'
1-3s:  M-Pesa prompt appears on user's phone
3-30s: User enters PIN, M-Pesa processes payment
30s:   M-Pesa sends callback to server
30s+:  Frontend detects success (within 2-4 seconds after callback)
35s:   Dialog shows "✅ Payment Successful"
```

The 30-60 second delay is **normal and expected** - it's the user confirming their payment on their phone!

---

## Next Steps

After testing:

1. ✅ Verify golden tickets are prioritized in admin queue
2. ✅ Confirm golden ticket holders are served before regular queue
3. ✅ Check that `isGolden` flag is set to `true` after payment
4. ✅ Verify webhook/callback is working in production

---

## Support

If payment flow still doesn't work:
1. Check Render deployment logs
2. Verify M-Pesa credentials are correct
3. Check callback URL is accessible: https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback
4. Contact Safaricom Daraja support if callback not reaching server
