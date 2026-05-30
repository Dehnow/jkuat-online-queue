# M-Pesa STK Push Verification Guide

## Credentials Configured ✅

All exact sandbox credentials have been configured in `api-server.js`:

```
MPESA_SHORTCODE (Till Number): 174379
MPESA_PASSKEY: bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
MPESA_CONSUMER_KEY: YLPydMh4xhirGrux1cdHyqKRCE3BzinLxdlzed4s88XyiRnu
MPESA_CONSUMER_SECRET: RuAadmSxyhwAqjk1GqEwW3vyoDtbCD0nByXAHR7GZw0COLoxSI6u0AKa91wSL4uw
```

**Updated:** Commit `ecca5b7` pushed to GitHub main branch  
**Status:** Render will auto-deploy from this commit

---

## STK Push Flow Verification

### Step 1: Verify Password Generation
The STK push uses this formula:
```
Password = base64(TILLNUMBER + PASSKEY + TIMESTAMP)
Example: base64("174379" + "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919" + "20260530153045")
```

**Verification Tool:** Run in Node.js console:
```javascript
const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
const password = Buffer.from(
  "174379" + "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919" + timestamp
).toString('base64');
console.log('Password:', password);
```

---

### Step 2: Test STK Push Endpoint (Sandbox Mode)

**Test via cURL:**
```bash
curl -X POST https://jkuat-online-queue.onrender.com/api/queue/1/mpesa-pay \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+254727610315"
  }'
```

**Expected Response (Sandbox):**
```json
{
  "success": true,
  "checkoutRequestId": "<CheckoutRequestID>",
  "message": "STK push sent successfully. Waiting for user PIN entry...",
  "mpesaStatus": "pending",
  "goldenTicketRef": "GT-REG-20260530-XXX",
  "sandbox": false
}
```

---

### Step 3: Full End-to-End Test in Browser

1. **Navigate to:** https://jkuat-online-queue.onrender.com/login
2. **Click "Student" tab**
3. **Enter credentials:**
   - Student ID: S77777
   - Phone: +254727610315
   - Service: Registrar
   - Password: Test@123
4. **Click "Join Queue"** → Should see golden ticket option
5. **Click "Upgrade to Golden Ticket"**
6. **Verify Modal:**
   - Phone field pre-populated with +254727610315
   - Benefits displayed correctly
   - Payment button clickable
7. **Enter Phone:** +254727610315 (or test number)
8. **Click "Pay KES 50"**

**Expected Behavior:**
- Status changes to "Processing..."
- In **sandbox mode**: Immediate success, golden ticket activated
- In **production mode**: STK prompt should appear on M-Pesa app on device
- After payment: Database updates with:
  - `mpesaStatus: 'success'`
  - `goldenTicketRef: 'GT-REG-20260530-XXX'`
  - `isGolden: true`
  - `mpesaPaidAt: <timestamp>`

---

### Step 4: Verify Callback Handler

When M-Pesa sends callback (after PIN entry in production):

**Database Impact:**
- ✅ Entry marked with `mpesaStatus: 'success'` if ResultCode = 0
- ✅ Entry marked with `mpesaStatus: 'failed'` if ResultCode ≠ 0
- ✅ Transaction ID stored in `mpesaTransactionId`
- ✅ Golden ticket reference in `goldenTicketRef`

**Server Logs:**
```
INFO STK Push initiated (PRODUCTION): GT-REG-20260530-001
INFO CheckoutRequestID: ws_co_050520261530454769
🔔 M-Pesa Callback received: {...}
```

---

## Testing Checklist

### Local Testing (Sandbox Mode)
- [ ] Verify MPESA_CONFIG has correct passkey
- [ ] Test password generation produces valid base64
- [ ] Make test API call with valid phone number
- [ ] Observe immediate success response in sandbox
- [ ] Check database shows pending status
- [ ] Verify golden ticket reference format: `GT-{SERVICE}-{DATE}-{SEQUENCE}`

### Production Testing (After Deployment)
- [ ] Verify Render deployment successful (check /api/health)
- [ ] Test OAuth token generation from Daraja
- [ ] Trigger STK push with real M-Pesa phone
- [ ] Observer STK prompt appears on phone
- [ ] Enter M-Pesa PIN
- [ ] Verify payment success callback received
- [ ] Check database shows success status
- [ ] Verify no duplicate golden tickets created

### Error Scenarios
- [ ] Test with invalid phone format → should reject with 400
- [ ] Test when already has golden ticket → should return 429
- [ ] Test with network timeout → should return 500 with helpful error
- [ ] Test OAuth failure → should log and return 500
- [ ] Test STK push rejection → should catch and return 500

---

## Debugging Commands

### Check Current MPESA_CONFIG
```bash
grep -A 7 "const MPESA_CONFIG" api-server.js
```

### View Recent Payment Attempts
```bash
# In Render logs
tail -f logs/app.log | grep "STK\|M-Pesa\|Payment"
```

### Test Payment Status
```bash
curl https://jkuat-online-queue.onrender.com/api/queue/1/mpesa-status
```

### Manual Callback Test (for testing callback handler)
```bash
curl -X POST http://localhost:3000/api/queue/mpesa-callback \
  -H "Content-Type: application/json" \
  -d '{
    "Body": {
      "stkCallback": {
        "MerchantRequestID": "test-001",
        "CheckoutRequestID": "ws_co_050520261530454769",
        "ResultCode": 0,
        "ResultDesc": "The service request has been accepted successively",
        "CallbackMetadata": {
          "Item": [
            {"Name": "Amount", "Value": 50},
            {"Name": "MpesaReceiptNumber", "Value": "RK7XVPV31Z"},
            {"Name": "PhoneNumber", "Value": 254727610315}
          ]
        }
      }
    }
  }'
```

---

## Production Readiness Checklist

**Before Going Live:**
- [ ] Passkey updated to exact value: `bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919`
- [ ] All 4 credentials verified in code
- [ ] GitHub commit `ecca5b7` pushed successfully
- [ ] Render auto-deployment completed
- [ ] /api/health endpoint returns `{ status: 'ok', databaseConnected: true }`
- [ ] Callback URL accessible: `https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback`
- [ ] Test payment flow in sandbox mode works
- [ ] Error handling catches all M-Pesa failures
- [ ] Database schema includes all golden ticket fields
- [ ] Rate limiting prevents duplicate payments (429 on retry)
- [ ] Browser console shows no errors during payment

**To Switch to Production:**
1. Update `MPESA_SANDBOX=false` in Render environment variables
2. Redeploy
3. Trigger real M-Pesa payment with production phone number
4. Verify STK prompt appears on M-Pesa app
5. Enter M-Pesa PIN to complete payment
6. Verify callback received and database updated

---

## Key Implementation Details

### Password Formula
```
Password = base64(TILL_NUMBER + PASSKEY + TIMESTAMP)
TILL_NUMBER: 174379
PASSKEY: bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919
TIMESTAMP: YYYYMMDDHHmmss (14 digits, no separators)
```

### STK Push Payload
```json
{
  "BusinessShortCode": "174379",
  "Password": "<base64-encoded-password>",
  "Timestamp": "20260530153045",
  "TransactionType": "CustomerPayBillOnline",
  "Amount": 50,
  "PartyA": "254727610315",
  "PartyB": "174379",
  "PhoneNumber": "254727610315",
  "CallBackURL": "https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback",
  "AccountReference": "GT-REG-20260530-001",
  "TransactionDesc": "Golden Ticket - Priority Queue Access"
}
```

### Callback URL Must Be Public
- ✅ `https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback` (public, Render domain)
- ❌ `http://localhost:3000/api/queue/mpesa-callback` (local, M-Pesa cannot reach)
- ❌ `http://192.168.x.x:3000/api/queue/mpesa-callback` (private IP, M-Pesa cannot reach)

---

## Success Indicators

✅ **STK Push Function Works Effectively When:**
1. OAuth token obtained successfully from Daraja
2. Password generated correctly with updated passkey
3. STK Push API call returns ResponseCode = 0
4. CheckoutRequestID received from M-Pesa
5. Database updates with pending status
6. Callback received and processed
7. Golden ticket activated on successful payment
8. Duplicate prevention active (429 on retry)
9. Error messages helpful to end user
10. No crashes or unhandled exceptions

---

## Quick Test Command

```bash
# Test endpoint directly
curl -X POST https://jkuat-online-queue.onrender.com/api/queue/1/mpesa-pay \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+254727610315"}' | jq .

# Should return success response with goldenTicketRef
```

---

**Last Updated:** Commit `ecca5b7`  
**Status:** ✅ Production credentials configured, ready for testing
