# M-Pesa Quick Test Guide

**Last Updated:** May 31, 2026

---

## 🚀 QUICK START TESTING

### Test 1: Check If Sandbox Mode is Active

**Run This:**
```bash
# Start the dev server
npm run dev

# In another terminal, check logs
# Look for this line:
```

**Expected in Logs:**
```
[mpesa-pay.ts] Mode: SANDBOX 🧪 | Credentials: Missing/Sandbox
```

✅ **PASS:** If you see "SANDBOX 🧪"

---

## 🧪 Test 2: Initiate Payment (Sandbox)

### Test in Browser

1. **Go to:** `http://localhost:3001/`
2. **Fill Queue Form:**
   - Name: `Test User`
   - Student ID: `P12345`
   - Service: `Registrar`
   - Click **Join Queue**

3. **Your ticket appears with 🎫 icon**

4. **Click ⭐ Upgrade to Golden Ticket (KES 50)**

5. **Modal Opens - Fill in:**
   - Phone: `+254712345678` (or `0712345678` or `254712345678`)
   - Click **Pay with M-Pesa**

### Expected Response

**Status:** `pending`
**Message:** "STK push initiated - Check your phone for M-Pesa prompt"

**In Browser Console:**
```
✅ Payment initiated
mpesaStatus: pending
goldenTicketRef: GT-REG-20260531-001
```

**In Server Logs (Render):**
```
📱 Initiating STK Push
   Phone: 254712345678
   Amount: KES 50
   Reference: GT-REG-20260531-001
   Mode: SANDBOX
✅ SANDBOX: STK Push initiated for GT-REG-20260531-001
   Queue ID: 1
   Checkout Request ID: SANDBOX_1_1622540400000
   Status: PENDING (waiting for user PIN entry or callback)
```

✅ **PASS:** If you see "SANDBOX: STK Push initiated"

---

## 🧪 Test 3: Simulate Callback Success

**In Sandbox Mode, you need to manually trigger the callback.**

### Using cURL

```bash
# Replace SANDBOX_1_XXXXX with the Checkout ID from test 2
# Replace GT-REG-XXXXXXX-XXX with the golden ticket ref from test 2

curl -X POST http://localhost:3001/api/queue/mpesa-callback \
  -H "Content-Type: application/json" \
  -d '{
    "Body": {
      "stkCallback": {
        "MerchantRequestID": "test-merchant-123",
        "CheckoutRequestID": "SANDBOX_1_1622540400000",
        "ResultCode": 0,
        "ResultDesc": "The service request has been processed successfully.",
        "CallbackMetadata": {
          "Item": [
            {"Name": "Amount", "Value": 50},
            {"Name": "MpesaReceiptNumber", "Value": "RIJ123ABC"},
            {"Name": "TransactionDate", "Value": "20260531123456"},
            {"Name": "PhoneNumber", "Value": "254712345678"},
            {"Name": "AccountReference", "Value": "GT-REG-20260531-001"}
          ]
        }
      }
    }
  }'
```

### Expected Response

```json
{
  "success": true,
  "message": "Payment processed successfully",
  "queueId": 1,
  "goldenTicketRef": "GT-REG-20260531-001"
}
```

### In Server Logs

```
🔔 M-Pesa Callback Received
   CheckoutRequestID: SANDBOX_1_1622540400000
   ResultCode: 0
   ResultDesc: The service request has been processed successfully.
   GoldenTicketRef: GT-REG-20260531-001
   Amount: 50
   ReceiptNumber: RIJ123ABC
✅ Found entry by goldenTicketRef: GT-REG-20260531-001
✅ Payment successful for queue 1
✅ Database updated: Queue 1 is now a GOLDEN TICKET
   Reference: GT-REG-20260531-001
   Amount: KES 50
   Receipt: RIJ123ABC
```

✅ **PASS:** If you see "Payment successful for queue 1"

---

## ✅ Test 4: Check Golden Ticket Status

### In Browser

**Refresh** `http://localhost:3001/`

**Your ticket should now:**
- ✅ Show ⭐ icon (golden ticket)
- ✅ Show "Golden Ticket Reference: GT-REG-20260531-001"
- ✅ Have special visual styling (gold/yellow highlight)

### Via API

```bash
# Replace ID with your queue entry ID
curl http://localhost:3001/api/queue/1/mpesa-status
```

### Expected Response

```json
{
  "id": 1,
  "isGolden": true,
  "mpesaStatus": "success",
  "mpesaTransactionId": "RIJ123ABC",
  "mpesaPaidAt": "2026-05-31T12:34:56.000Z",
  "goldenTicketRef": "GT-REG-20260531-001",
  "status": "waiting"
}
```

**Key Values:**
- `isGolden: true` ← Golden ticket active
- `mpesaStatus: 'success'` ← Payment confirmed
- `mpesaPaidAt: <timestamp>` ← When payment was confirmed

✅ **PASS:** If `isGolden: true` and `mpesaStatus: 'success'`

---

## ❌ Test 5: Payment Cancellation

### Simulate User Cancels Payment

```bash
curl -X POST http://localhost:3001/api/queue/mpesa-callback \
  -H "Content-Type: application/json" \
  -d '{
    "Body": {
      "stkCallback": {
        "MerchantRequestID": "test-merchant-456",
        "CheckoutRequestID": "SANDBOX_2_1622540500000",
        "ResultCode": 1,
        "ResultDesc": "The user cancelled the payment.",
        "CallbackMetadata": null
      }
    }
  }'
```

### Expected Response

```json
{
  "success": true,
  "message": "Callback received"
}
```

### In Server Logs

```
⚠️  Payment cancelled/incomplete for queue 2: The user cancelled the payment.
```

### Check Status

```bash
curl http://localhost:3001/api/queue/2/mpesa-status
```

### Expected Response

```json
{
  "id": 2,
  "isGolden": false,
  "mpesaStatus": "failed",
  "mpesaTransactionId": "SANDBOX_2_1622540500000",
  "goldenTicketRef": "GT-REG-20260531-002",
  "status": "waiting"
}
```

**Key Values:**
- `isGolden: false` ← NOT upgraded
- `mpesaStatus: 'failed'` ← Payment was rejected

✅ **PASS:** If `isGolden: false` and `mpesaStatus: 'failed'`

---

## 🚫 Test 6: Invalid Phone Number

```bash
curl -X POST http://localhost:3001/api/queue/3/mpesa-pay \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "123"}'
```

### Expected Response

```json
{
  "error": "Invalid phone number",
  "message": "Invalid phone number. Use format: +254712345678, 254712345678, or 0712345678"
}
```

✅ **PASS:** If returns 400 with error message

---

## 🔒 Test 7: Try Double-Upgrade

### Create a Golden Ticket (Test 2-4)

### Try to Upgrade Again

```bash
curl -X POST http://localhost:3001/api/queue/1/mpesa-pay \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+254712345678"}'
```

### Expected Response (HTTP 429)

```json
{
  "error": "Already upgraded",
  "message": "This ticket is already a Golden Ticket (GT-REG-20260531-001). You cannot upgrade it again."
}
```

✅ **PASS:** If returns 429 and prevents double-upgrade

---

## 📊 Test Results Checklist

- [ ] Test 1: Sandbox mode detected ✅
- [ ] Test 2: STK initiation works ✅
- [ ] Test 3: Callback received and processed ✅
- [ ] Test 4: Golden ticket status correct ✅
- [ ] Test 5: Payment cancellation handled ✅
- [ ] Test 6: Invalid phone rejected ✅
- [ ] Test 7: Double-upgrade prevented ✅

**Overall Status:** ✅ **ALL TESTS PASS**

---

## 🔍 Monitoring Commands

### Watch Server Logs Live

```bash
# For Render (production)
render logs -f

# For local dev
npm run dev 2>&1 | grep -E "(M-Pesa|STK|Callback|Error)"
```

### Check Database Status

```bash
# Connect to your PostgreSQL database
psql $DATABASE_URL

# Check queue entries with M-Pesa data
SELECT id, name, student_id, is_golden, mpesa_status, golden_ticket_ref 
FROM queue_entries 
WHERE is_golden = true OR mpesa_status IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

### Monitor Frontend Activity

**Open Browser DevTools → Console**

Look for these messages:
```
✅ Payment initiated
⏳ Checking payment status...
✅ Payment successful! Status updated from M-Pesa callback.
```

---

## 🆘 If Tests Fail

### STK Not Initiating

1. Check logs for `🔐 Requesting M-Pesa access token`
2. Look for `❌ Failed to get M-PESA access token`
3. Verify you're in SANDBOX mode (not production without credentials)

### Callback Not Processed

1. Check logs for `🔔 M-Pesa Callback Received`
2. Look for `⚠️  No queue entry found`
3. Verify CheckoutRequestID matches from STK initiation

### Status Not Updating

1. Check database directly:
   ```sql
   SELECT * FROM queue_entries WHERE id = 1;
   ```
2. Look at `mpesa_status` and `is_golden` columns
3. They should be `'success'` and `true` after callback

---

## 💡 Pro Tips

1. **Speed Up Tests:**
   - Change polling interval from 2s to 500ms in frontend code
   - Makes status updates appear faster

2. **Test Multiple Services:**
   - Try joining different services (Registrar, Finance, ICT)
   - Golden ticket refs should include service: `GT-REG-...`, `GT-FIN-...`, `GT-ICT-...`

3. **Test in Production:**
   - Get real M-Pesa credentials from Daraja dashboard
   - Set environment variables in Render
   - Test with real phone number (will send real STK prompt!)
   - **Recommended:** Test with small amount first (KES 1 instead of 50)

4. **Debug Callback Issues:**
   - Use webhook.site to capture real M-Pesa callbacks
   - Set `CALLBACK_URL=https://webhook.site/your-unique-id`
   - See exact payload M-Pesa sends
   - Then update callback URL back to your app

---

## ✨ Success Indicators

✅ **STK Request Initialization Working:**
- ✅ No errors initiating payment
- ✅ Logs show `📱 Initiating STK Push`
- ✅ Database shows `mpesa_status = 'pending'`

✅ **Callback Working:**
- ✅ Receives callback POST request
- ✅ Logs show `🔔 M-Pesa Callback Received`
- ✅ Finds queue entry by one of three methods
- ✅ Returns HTTP 200 OK

✅ **End-to-End Working:**
- ✅ Can initiate payment
- ✅ Can simulate/receive callback
- ✅ Status updates to success
- ✅ `isGolden` becomes true
- ✅ Frontend shows success message
- ✅ UI updates with golden ticket styling

🎉 **If all above are true, the system is functioning correctly!**
