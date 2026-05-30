# M-Pesa STK Push & Callback Critical Fixes

## 🔴 CRITICAL ISSUE IDENTIFIED & FIXED

**Problem:** Payment status was returning "success" immediately after STK push initiation instead of remaining "pending".

## 🔧 FIXES APPLIED

### 1. **mpesa-callback.ts** - MAJOR FIX ✅
**Location:** `src/routes/api/queue/mpesa-callback.ts`

#### Critical Changes:
```typescript
// ✅ NOW CORRECTLY SETS isGolden = true on successful payment
if (ResultCode === 0) {
  await db.update(queueEntries)
    .set({
      isGolden: true,  // 🔥 CRITICAL FIX: Was missing!
      mpesaStatus: 'success',
      mpesaTransactionId: mpesaTransactionId,
      mpesaPaidAt: new Date(),
    })
    .where(eq(queueEntries.id, entry.id))
}

// ✅ PREVENTS DOUBLE-PROCESSING
if (entry.mpesaStatus === 'success' || entry.mpesaStatus === 'failed') {
  console.warn(`Transaction already processed. Ignoring duplicate callback.`)
  return json({ success: true, message: 'Callback already processed' })
}

// ✅ FALLBACK LOOKUP by CheckoutRequestID
let entry = await db.query.queueEntries.findFirst({
  where: eq(queueEntries.goldenTicketRef, goldenTicketRef),
})
// Fallback if no golden ticket ref found
if (!entry && CheckoutRequestID) {
  entry = await db.query.queueEntries.findFirst({
    where: eq(queueEntries.mpesaTransactionId, CheckoutRequestID),
  })
}

// ✅ NORMALIZED ResultCode COMPARISON
const resultCodeNum = Number(ResultCode)
if (resultCodeNum === 0) { ... }
```

### 2. **mpesa-pay.ts** - ENHANCED LOGGING & VALIDATION ✅
**Location:** `src/routes/api/queue/$id/mpesa-pay.ts`

#### Key Improvements:
- ✅ Sets `mpesaStatus: 'pending'` immediately after STK push initiation
- ✅ Enhanced logging for debugging
- ✅ Better error messages
- ✅ Validates credentials exist before calling Daraja
- ✅ Returns queue ID in response for tracking

```typescript
// ✅ CORRECT FLOW: Status set to PENDING immediately
await db.update(queueEntries)
  .set({
    mpesaTransactionId: paymentResult.checkoutRequestId,
    mpesaStatus: 'pending',  // ✅ Status is PENDING until callback
    goldenTicketRef,
  })
  .where(eq(queueEntries.id, id))

// ✅ Response includes mpesaStatus: 'pending'
return json({
  success: true,
  message: 'Payment prompt sent to your phone',
  checkoutRequestId: paymentResult.checkoutRequestId,
  mpesaStatus: 'pending',  // ✅ Not success!
  goldenTicketRef,
  queueId: id,
})
```

### 3. **legacy mpesa.ts** - FIXED ✅
**Location:** `src/routes/api/queue/mpesa.ts`

#### Critical Fix:
```typescript
// ✅ NOW SETS mpesaStatus: 'pending' on initiation
if (paymentResult.success) {
  await db.update(queueEntries)
    .set({
      mpesaTransactionId: paymentResult.checkoutRequestId,
      mpesaStatus: 'pending',  // 🔥 CRITICAL FIX: Was missing!
    })
    .where(eq(queueEntries.id, queueId))
}
```

### 4. **api-server.js callback** - ENHANCED
**Location:** `api-server.js` lines ~1267-1365

#### Improvements:
- ✅ Better logging for debugging
- ✅ Double-processing protection
- ✅ Normalized ResultCode comparison
- ✅ Sets `isGolden: true` on success
- ✅ Handles cancellation (ResultCode 1, 2) vs other errors

## 📊 PAYMENT FLOW - NOW CORRECT

```
┌─────────────────────────────────────────────────────┐
│ 1. USER CLICKS "PAY WITH M-PESA"                    │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│ 2. POST /api/queue/:id/mpesa-pay                    │
│    - Sends STK push to Daraja API                   │
│    - Database: mpesaStatus = "pending"  ✅          │
│    - Response: mpesaStatus = "pending"  ✅          │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│ 3. M-Pesa sends STK prompt to user's phone          │
│    - Frontend polls every 2 seconds                 │
│    - Status: still "pending" (not changed)          │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│ 4. USER ENTERS PIN & COMPLETES PAYMENT              │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│ 5. M-Pesa sends callback to server                  │
│    POST /api/queue/mpesa-callback                   │
│    - ResultCode: 0 (success) or 1/2 (cancelled)     │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│ 6. CALLBACK HANDLER:                                │
│    - Checks if already processed (prevents double)  │
│    - If ResultCode === 0:                           │
│      • Sets isGolden = true  ✅ (WAS MISSING!)     │
│      • Sets mpesaStatus = 'success'  ✅            │
│      • Records transaction ID & timestamp           │
│    - If ResultCode !== 0:                           │
│      • Sets mpesaStatus = 'failed'                 │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│ 7. FRONTEND POLLING DETECTS CHANGE:                 │
│    GET /api/queue/:id/mpesa-status                  │
│    - Receives: mpesaStatus = 'success'              │
│    - Shows success message                          │
│    - Queue entry now marked as golden ticket        │
└─────────────────────────────────────────────────────┘
```

## ✅ VALIDATION CHECKLIST

### Before Payment Initiation:
- [ ] Queue entry exists with ID
- [ ] Entry is not already golden
- [ ] Entry is not served/cancelled
- [ ] Phone number is valid (254XXXXXXXXX format)
- [ ] M-Pesa credentials configured

### After STK Push Initiation:
- [ ] Database: `mpesaStatus = 'pending'` ✅
- [ ] Response: `mpesaStatus = 'pending'` ✅
- [ ] CheckoutRequestID stored in database
- [ ] GoldenTicketRef generated and stored

### After User Enters PIN:
- [ ] M-Pesa sends callback with ResultCode = 0
- [ ] Callback handler finds queue entry
- [ ] Database: `isGolden = true` ✅ (NEW!)
- [ ] Database: `mpesaStatus = 'success'` ✅
- [ ] TransactionID stored
- [ ] Timestamp recorded

### Frontend Polling:
- [ ] Poll interval: 2 seconds
- [ ] Timeout: 10 minutes (300 attempts)
- [ ] Receives: `mpesaStatus = 'success'` ✅
- [ ] Displays success message
- [ ] Entry appears in golden ticket queue

## 🧪 TESTING THE FIX

### Test 1: Verify Status Remains PENDING
```bash
# 1. Join queue
curl -X POST http://localhost:3000/api/queue \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","studentId":"123","phoneNumber":"+254712345678","serviceType":"registrar"}'

# Response should have: queueId

# 2. Initiate payment
curl -X POST http://localhost:3000/api/queue/11/mpesa-pay \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+254712345678"}'

# ✅ Response should have: mpesaStatus: 'pending'

# 3. Check status (before callback)
curl http://localhost:3000/api/queue/11/mpesa-status

# ✅ Should show: mpesaStatus: 'pending'
```

### Test 2: Verify Callback Sets isGolden
```bash
# After user enters PIN, simulate callback:
curl -X POST http://localhost:3000/api/queue/mpesa-callback \
  -H "Content-Type: application/json" \
  -d '{
    "Body": {
      "stkCallback": {
        "MerchantRequestID": "test",
        "CheckoutRequestID": "SANDBOX_11_123456",
        "ResultCode": 0,
        "ResultDesc": "The user successfully entered their M-Pesa PIN",
        "CallbackMetadata": {
          "Item": [
            { "Name": "Amount", "Value": 50 },
            { "Name": "MpesaReceiptNumber", "Value": "RLJ123456" },
            { "Name": "PhoneNumber", "Value": "254712345678" },
            { "Name": "AccountReference", "Value": "GT-REG-20260530-001" }
          ]
        }
      }
    }
  }'

# 3. Check status (after callback)
curl http://localhost:3000/api/queue/11/mpesa-status

# ✅ Should show: 
#    - mpesaStatus: 'success'
#    - isGolden: true
```

## 🚀 DEPLOYMENT NOTES

1. **Database**: No migrations needed - columns already exist
2. **Environment Variables**: No changes required
3. **Downtime**: No downtime required - hot deploy
4. **Testing**: Test in sandbox first before production

## 📋 FILES MODIFIED

1. ✅ `src/routes/api/queue/mpesa-callback.ts` - MAJOR FIX
2. ✅ `src/routes/api/queue/$id/mpesa-pay.ts` - Enhanced
3. ✅ `src/routes/api/queue/mpesa.ts` - Fixed legacy endpoint
4. ✅ `api-server.js` - Enhanced (partial)

## 🎯 EXPECTED OUTCOMES

### Before Fix ❌
- Payment initiated → mpesaStatus = "success" (WRONG!)
- User cancels → mpesaStatus still "success" (WRONG!)
- isGolden never set to true (WRONG!)

### After Fix ✅
- Payment initiated → mpesaStatus = "pending" (CORRECT!)
- Frontend polls → sees "pending" (CORRECT!)
- User enters PIN → callback received
- Callback processes → isGolden = true, mpesaStatus = "success" (CORRECT!)
- User cancels → mpesaStatus = "failed" (CORRECT!)

## ⚠️ CRITICAL POINTS

1. **Status Flow**: pending → (success|failed), never auto-completes
2. **Golden Flag**: Only set when callback ResultCode === 0
3. **Double Processing**: Ignored if already success/failed
4. **Fallback Lookup**: Tries both goldenTicketRef and CheckoutRequestID
5. **ResultCode Normalization**: Handles both string and number types

---

**Status**: ✅ FIXES APPLIED - Ready for testing and deployment
**Last Updated**: 2026-05-30
