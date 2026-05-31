# 🔍 M-PESA STK PUSH & CALLBACK API ANALYSIS & FIX

## Analysis of Safaricom API (from Postman Collection)

### STK Push Endpoint
**Endpoint**: `https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest` (Sandbox)  
**Production**: `https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest`

### Required Payload Structure
```json
{
    "BusinessShortCode": "174379",          // Your till number
    "Password": "<base64_encoded>",         // base64(BusinessShortCode + Passkey + Timestamp)
    "Timestamp": "20250925124519",          // YYYYMMDDHHmmss format
    "TransactionType": "CustomerPayBillOnline",
    "Amount": 50,                           // In KES
    "PartyA": "254741958927",               // Phone number (254XXXXXXXXX format)
    "PartyB": "174379",                     // Same as BusinessShortCode
    "PhoneNumber": "254741958927",          // Same as PartyA
    "CallBackURL": "https://yourdomain.com/callback",
    "AccountReference": "Golden-Ticket-001", // Reference string
    "TransactionDesc": "Golden Ticket Payment"
}
```

---

## 🔴 CRITICAL ISSUES FOUND

### Issue #1: Callback URL Must Be HTTPS & Accessible
**Status**: ⚠️ BLOCKING PRODUCTION

From API requirements:
- ✅ Must be HTTPS (not HTTP)
- ✅ Must be publicly accessible
- ✅ Must accept POST requests
- ✅ Must respond with HTTP 200 OK
- ✅ M-Pesa sends JSON payload with transaction details

**Your Current Configuration**:
```
CallBackURL: process.env.CALLBACK_URL 
             || 'https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback'
```

**Issue**: If callback URL is NOT reachable, M-Pesa:
- ✅ Still sends STK prompt to phone
- ❌ BUT doesn't retry if callback fails
- ❌ Payment appears stuck if callback unreachable
- ❌ No automatic status update to your system

---

### Issue #2: Password Calculation Must Be Exact
**Status**: ⚠️ CAUSES RESPONSE CODE 20 ERROR

**Correct Calculation**:
```
Password = base64(BusinessShortCode + Passkey + Timestamp)
         = base64("174379" + "bfb279f9ba9b9d1380007480bbe7f27425e1aa6d4ede3891ec337007a74ff42" + "20250925124519")
```

**Your Code**:
```javascript
const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64')
```

✅ This is CORRECT

**But Watch For**:
- ❌ Wrong passkey → ResponseCode 20
- ❌ Wrong timestamp format → Invalid encoding
- ❌ Using production passkey in sandbox → ResponseCode 01

---

### Issue #3: Phone Number Format MUST Be 254XXXXXXXXX
**Status**: ⚠️ CAUSES RESPONSE CODE 14

**Your Code**:
```javascript
let formattedPhone = phoneNumber.replace(/\D/g, '')
if (!formattedPhone.startsWith('254')) {
  if (formattedPhone.startsWith('0')) {
    formattedPhone = '254' + formattedPhone.slice(1)  // ✅ CORRECT
  }
}
```

✅ This is CORRECT format handling

**But Watch For**:
- ❌ `+254` → Remove the `+` first
- ❌ `00254` → Should be `254`
- ❌ `0712345678` → Must become `254712345678`

---

### Issue #4: BusinessShortCode vs Passkey Mismatch
**Status**: 🔴 CRITICAL - Causes ResponseCode 25 or 01

**For Production**:
- Sandbox Shortcode: `174379` with Sandbox Passkey
- Production Shortcode: Your **till number** (from M-Pesa Online)
- Production Passkey: Your **passkey** (from M-Pesa Online)

**MUST Match**: ShortCode ↔ Passkey pair

If you use:
- ❌ Sandbox shortcode with production passkey → ERROR
- ❌ Production shortcode with sandbox passkey → ERROR
- ✅ Sandbox shortcode with sandbox passkey → OK
- ✅ Production shortcode with production passkey → OK

---

### Issue #5: Callback Response Must Be Correct
**Status**: 🔴 M-Pesa Won't Mark Transaction Complete Without It

M-Pesa **EXPECTS** your callback endpoint to:
1. **Receive** POST request with:
   ```json
   {
     "Body": {
       "stkCallback": {
         "MerchantRequestID": "...",
         "CheckoutRequestID": "...",
         "ResultCode": 0,          // 0 = success, 1 = cancelled, other = error
         "ResultDesc": "The service request has been initiated successfully",
         "CallbackMetadata": {
           "Item": [
             {"Name": "Amount", "Value": 50},
             {"Name": "MpesaReceiptNumber", "Value": "RB112233445"},
             {"Name": "PhoneNumber", "Value": 254712345678}
           ]
         }
       }
     }
   }
   ```

2. **Respond** with HTTP 200 OK immediately

**Your Current Callback**:
```typescript
// POST /api/queue/mpesa-callback
```

✅ Endpoint exists, but check:
- Does it respond with 200 OK?
- Does it handle both success (ResultCode 0) and error cases?
- Does it update database correctly?

---

## 🛠️ REQUIRED FIXES

### Fix #1: Verify Callback URL is Reachable

**Test Your Callback**:
```bash
curl -X POST https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback \
  -H "Content-Type: application/json" \
  -d '{"test": "callback"}'

# Should respond with 200 OK (not 404 or 500)
```

**Render Requirements**:
- ✅ Callback must be accessible from internet (not localhost)
- ✅ Callback must be HTTPS (Render provides this automatically)
- ✅ Callback should respond quickly (< 30 seconds)

### Fix #2: Ensure Callback is Idempotent

**Problem**: M-Pesa may retry callbacks. Your callback must handle:
```typescript
// In callback handler:
const existingPayment = await db.query.queueEntries.findFirst({
  where: eq(queueEntries.mpesaTransactionId, CheckoutRequestID)
})

if (existingPayment && existingPayment.mpesaStatus === 'success') {
  // Already processed - return 200 OK without reprocessing
  return res.status(200).json({ success: true })
}
```

### Fix #3: Callback Must Handle Both Success & Error

**Your callback must handle**:
```typescript
// ResultCode meanings:
// 0 = Payment successful - set isGolden = true
// 1 = User cancelled - set mpesaStatus = 'failed'
// Other = Transaction error - set mpesaStatus = 'failed'

if (resultCode === 0) {
  // SUCCESS: Update ticket to golden
  await db.update(queueEntries).set({
    isGolden: true,
    mpesaStatus: 'success',
    mpesaTransactionId: CheckoutRequestID
  })
} else {
  // FAILURE: Mark as failed
  await db.update(queueEntries).set({
    mpesaStatus: 'failed'
  })
}

// Always respond with 200 OK
return res.status(200).json({ success: true })
```

### Fix #4: Endpoint URLs Must Match Environment

**Current Setup**:
```javascript
const baseUrl = SANDBOX_MODE 
  ? 'https://sandbox.safaricom.co.ke'
  : 'https://api.safaricom.co.ke'
```

✅ **CORRECT**

**For Callback URL**:
```javascript
const callbackUrl = NODE_ENV === 'production'
  ? 'https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback'
  : 'http://localhost:3000/api/queue/mpesa-callback'
```

⚠️ **Issue**: Localhost won't work! M-Pesa can't reach it.
✅ **Fix**: Use ngrok or test with production endpoint

---

## 📋 VERIFICATION CHECKLIST

Before deploying to production, verify:

- [ ] Callback URL is HTTPS
- [ ] Callback URL is publicly accessible
- [ ] Callback endpoint responds with 200 OK
- [ ] Callback correctly parses M-Pesa JSON payload
- [ ] Callback handles ResultCode 0 (success) correctly
- [ ] Callback handles ResultCode 1 (cancelled) correctly
- [ ] Callback is idempotent (handles retries)
- [ ] Production shortcode matches production passkey
- [ ] Phone number formatting is 254XXXXXXXXX
- [ ] Timestamp is YYYYMMDDHHmmss format
- [ ] Password is base64(shortcode + passkey + timestamp)
- [ ] Bearer token is valid
- [ ] Environment variables are set correctly

---

## 🚀 PRODUCTION DEPLOYMENT CHECKLIST

### On Render Dashboard:

1. **Environment Variables Set**:
   ```
   CONSUMER_KEY = [real_key]
   CONSUMER_SECRET = [real_secret]
   PASSKEY = [real_passkey]
   SHORTCODE = [real_till_number]
   CALLBACK_URL = https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback
   ```

2. **Callback URL Reachable**:
   ```
   Test: curl -X POST https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback
   Response should be 200 OK
   ```

3. **Logs Show**:
   ```
   ✅ M-Pesa Mode: PRODUCTION 🚀
   ✅ Real credentials detected
   ✅ STK Push successful
   ✅ Callback received
   ```

---

## 🔧 API ENDPOINT SUMMARY

| Operation | Sandbox URL | Prod URL | Method | Purpose |
|-----------|---|---|---|---|
| Get Token | `https://sandbox.safaricom.co.ke/oauth/v1/generate` | `https://api.safaricom.co.ke/oauth/v1/generate` | GET | Authenticate |
| STK Push | `https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest` | `https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest` | POST | Send STK prompt |
| Query STK | `https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query` | `https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query` | POST | Check payment status |
| Your Callback | (M-Pesa → Your Server) | `https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback` | POST | Receive payment result |

---

## ✅ CURRENT STATUS

Your implementation:
- ✅ Auto-detects sandbox vs production
- ✅ Has retry logic with exponential backoff
- ✅ Formats phone numbers correctly
- ✅ Generates password correctly
- ✅ Has callback endpoint defined

**Next Steps**:
1. Deploy with production credentials
2. Test callback endpoint is reachable
3. Verify M-Pesa callback is received
4. Check database is updated correctly
5. Monitor logs for any errors

---

**Key Rule**: If you set production credentials but callback URL is unreachable, STK will appear to work but payment won't complete.

