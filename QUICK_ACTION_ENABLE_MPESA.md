# IMMEDIATE ACTION: Enable Real M-Pesa STK Prompts 🚀

**Current Issue:** System is in SANDBOX mode (simulating payments, not sending real STK prompts)  
**Solution:** Set one environment variable in Render  
**Time:** 2-3 minutes to fully take effect

---

## Step-by-Step: Enable Real M-Pesa Payments

### Step 1: Open Render Dashboard
```
Go to: https://dashboard.render.com
```

### Step 2: Select Your Service
```
Click: jkuat-online-queue (Web Service)
```

### Step 3: Go to Environment
```
In left sidebar, click: Environment
```

### Step 4: Add New Environment Variable
```
Click: "+ Add Environment Variable"

Name:  MPESA_SANDBOX
Value: false

Then click: "Save Changes"
```

**Screenshot of what to look for:**
```
┌─────────────────────────────────────┐
│ Environment                         │
├─────────────────────────────────────┤
│ Name              │ Value           │
├───────────────────┼─────────────────┤
│ DATABASE_URL      │ postgresql://.. │
│ NODE_ENV          │ production      │
│ MPESA_SANDBOX     │ false           │ ← ADD THIS
├─────────────────────────────────────┤
│ [Save Changes]                      │
└─────────────────────────────────────┘
```

### Step 5: Wait for Deployment
```
Render will automatically:
1. Detect the environment change
2. Trigger a new deployment
3. Redeploy with MPESA_SANDBOX=false
4. Takes 1-2 minutes

Check status at:
https://dashboard.render.com/web/srv-d86dsqh9rddc73bvpg60/deploys
```

### Step 6: Verify Deployment
```
When deployment completes, you should see:
Status: "Live" ✅

Check logs show:
"INFO M-Pesa Mode: PRODUCTION 🚀"
```

---

## Test Real M-Pesa Payment

### After deployment completes:

1. **Navigate to:** https://jkuat-online-queue.onrender.com/login

2. **Login as student:**
   ```
   Student ID: S77777
   Phone: +254[YOUR_MPESA_NUMBER]
   Service: registrar
   Password: Test@123
   ```

3. **Join queue**

4. **Click: "Upgrade to Golden Ticket"**

5. **Enter phone:** +254727610315 (or your actual M-Pesa number)

6. **Click: "Pay KES 50"**

7. **🔔 WATCH YOUR M-PESA APP** 
   ```
   Within 2-3 seconds, you should see:
   "You have received an M-Pesa payment prompt"
   
   A prompt will appear asking you to:
   "Complete this M-Pesa payment for KES 50?"
   ```

8. **Enter your M-Pesa PIN**

9. **Payment completes**
   ```
   ✅ "Payment successful"
   ✅ "Golden Ticket: GT-REG-20260530-XXX"
   ✅ Queue shows "Golden Ticket Activated"
   ```

---

## What Changed

### Before (SANDBOX mode):
```
User clicks "Pay"
   ↓
System immediately returns: "Success! Golden ticket activated"
   ↓
NO M-Pesa app notification
NO real transaction
NO user payment required
```

### After (PRODUCTION mode):
```
User clicks "Pay"
   ↓
Real M-Pesa API called (Daraja)
   ↓
STK prompt sent to M-Pesa app on phone
   ↓
User enters M-Pesa PIN
   ↓
Money deducted (KES 50)
   ↓
Callback received confirming payment
   ↓
"Success! Golden ticket activated"
   ↓
Database shows receipt number as proof
```

---

## How We Know Payment Was Successful

**System verifies payment through M-Pesa callback:**

```
1. M-Pesa processes user's PIN
2. Deducts money from account
3. Sends callback to: https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback
4. Callback includes:
   - ResultCode: 0 (success indicator)
   - MpesaReceiptNumber: RK7XVPV31Z (transaction proof)
   - Amount: 50 (amount deducted)
5. We verify callback and activate golden ticket
```

**Only after callback with ResultCode=0 do we:**
- ✅ Set `isGolden = true`
- ✅ Set `mpesaStatus = "success"`
- ✅ Store receipt number as proof
- ✅ Activate golden ticket in UI

---

## Troubleshooting

### If STK prompt still doesn't appear:

**Check 1: Verify variable was saved**
```
Go to Environment section
Should show: MPESA_SANDBOX = false
(not 'true', not missing)
```

**Check 2: Check deployment completed**
```
Go to Deploys tab
Should show green checkmark ✅
Status: "Live"
```

**Check 3: Check phone number format**
```
Phone must be registered for M-Pesa
Phone must be in format: +254[9-digit-number]
Examples:
✅ +254727610315
✅ +254701234567
❌ +254027610315 (wrong: leading 0)
❌ 0727610315 (wrong: missing country code)
```

**Check 4: Monitor server logs**
```
Look for line:
"INFO STK Push initiated (PRODUCTION): GT-REG-20260530-XXX"

If you see instead:
"INFO M-Pesa Mode: SANDBOX 🧪"
Then MPESA_SANDBOX didn't get set correctly
```

---

## Callback Proof of Payment

After successful payment, database should show:

```
GET /api/queue/:id/mpesa-status

{
  "id": 15,
  "isGolden": true,
  "mpesaStatus": "success",
  "mpesaTransactionId": "RK7XVPV31Z",     ← M-Pesa receipt
  "mpesaPaidAt": "2026-05-30T11:05:44Z",  ← When paid
  "goldenTicketRef": "GT-REG-20260530-003",
  "status": "waiting"
}
```

This proves:
- ✅ User entered M-Pesa PIN
- ✅ Money was deducted from their account
- ✅ M-Pesa sent us the callback
- ✅ Receipt number shows transaction is real and immutable

---

## Next Steps

1. ✅ **Code is ready** - Fixed in commit bc8dacf
2. 🔄 **Add MPESA_SANDBOX=false** to Render environment (YOUR ACTION NOW)
3. 🔄 **Wait 2-3 minutes** for deployment
4. 🔄 **Test with real phone** - STK prompt should appear
5. ✅ **Golden ticket activates** after payment confirmed

---

**This is the final piece needed to make M-Pesa STK prompts work in production! 🎉**

For detailed debugging information, see: MPESA_DEBUG_STK_PROMPT_NOT_REACHING.md
