# 🧪 M-PESA CALLBACK & STK PUSH - TESTING & DEPLOYMENT GUIDE

## ✅ FIXES APPLIED

1. ✅ **Callback always returns 200 OK** - M-Pesa won't retry if endpoint returns error status
2. ✅ **Multiple lookup strategies** - Tries goldenTicketRef, CheckoutRequestID, and ReceiptNumber
3. ✅ **Defensive metadata parsing** - Handles various callback structures
4. ✅ **Callback URL validation** - Checks for HTTPS and localhost warnings
5. ✅ **Idempotent processing** - Prevents duplicate transaction processing
6. ✅ **Database field verified** - Schema has `mpesaPaidAt` field

---

## 🧪 LOCAL TESTING (SANDBOX MODE)

### Test Setup

1. **Start local development server**:
   ```bash
   cd c:\Users\user\Desktop\jkuat-queue-online 3.2 SRC
   npm run dev
   ```

2. **Verify sandbox mode active** - Check logs:
   ```
   [mpesa-pay.ts] Mode: SANDBOX 🧪
   ✅ Callback URL validated: ...
   ```

3. **Create a test queue entry** via browser:
   - Go to: http://localhost:3001
   - Select service (Registrar, Finance, or ICT Helpdesk)
   - Join queue
   - Note the queue entry ID from URL or database

---

### Test Flow #1: STK Push Initiation

**Endpoint**: `POST /api/queue/{id}/mpesa-pay`

**Request**:
```bash
curl -X POST http://localhost:3001/api/queue/1/mpesa-pay \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+254712345678"
  }'
```

**Expected Response** (Sandbox):
```json
{
  "success": true,
  "checkoutRequestId": "SANDBOX_1_1717891234567",
  "responseCode": "0",
  "message": "STK push initiated - Check your phone for M-Pesa prompt...",
  "mpesaStatus": "pending",
  "goldenTicketRef": "GT-REG-20260531-001",
  "sandbox": true,
  "queueId": 1
}
```

**Check Database**:
```sql
SELECT id, status, isGolden, mpesaStatus, mpesaTransactionId, goldenTicketRef 
FROM queue_entries 
WHERE id = 1;
```

Expected:
```
id  | status | isGolden | mpesaStatus | mpesaTransactionId  | goldenTicketRef
1   | joined | false    | pending     | SANDBOX_1_...      | GT-REG-20260531-001
```

---

### Test Flow #2: Callback Simulation

**To complete the sandbox transaction, simulate M-Pesa callback**:

```bash
curl -X POST http://localhost:3001/api/queue/mpesa-callback \
  -H "Content-Type: application/json" \
  -d '{
    "Body": {
      "stkCallback": {
        "MerchantRequestID": "16813-1590513989-1",
        "CheckoutRequestID": "SANDBOX_1_1717891234567",
        "ResultCode": 0,
        "ResultDesc": "The service request has been initiated successfully",
        "CallbackMetadata": {
          "Item": [
            {"Name": "Amount", "Value": 50},
            {"Name": "MpesaReceiptNumber", "Value": "RB112233445"},
            {"Name": "PhoneNumber", "Value": "254712345678"},
            {"Name": "AccountReference", "Value": "GT-REG-20260531-001"}
          ]
        }
      }
    }
  }'
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Payment processed successfully",
  "queueId": 1,
  "goldenTicketRef": "GT-REG-20260531-001"
}
```

**Check Database After Callback**:
```sql
SELECT id, status, isGolden, mpesaStatus, mpesaTransactionId, goldenTicketRef, mpesaPaidAt
FROM queue_entries 
WHERE id = 1;
```

Expected:
```
id  | status | isGolden | mpesaStatus | mpesaTransactionId | goldenTicketRef        | mpesaPaidAt
1   | joined | true     | success     | RB112233445        | GT-REG-20260531-001    | 2026-05-31 10:23:45
```

✅ **isGolden changed from false → true**  
✅ **mpesaStatus changed from pending → success**  
✅ **mpesaPaidAt is set to current timestamp**

---

### Test Flow #3: Cancel Payment

**Simulate user cancelling the M-Pesa prompt** (ResultCode 1):

```bash
curl -X POST http://localhost:3001/api/queue/mpesa-callback \
  -H "Content-Type: application/json" \
  -d '{
    "Body": {
      "stkCallback": {
        "MerchantRequestID": "16813-1590513989-1",
        "CheckoutRequestID": "SANDBOX_2_1717891234568",
        "ResultCode": 1,
        "ResultDesc": "The user cancelled the transaction",
        "CallbackMetadata": {}
      }
    }
  }'
```

**Expected Response** (200 OK):
```json
{
  "success": true,
  "message": "Callback received"
}
```

**Check Database**:
```sql
SELECT id, isGolden, mpesaStatus FROM queue_entries WHERE id = 2;
```

Expected:
```
id  | isGolden | mpesaStatus
2   | false    | failed
```

✅ **isGolden remains false**  
✅ **mpesaStatus set to failed**

---

### Test Flow #4: Idempotency (Double-Submit)

**Send the same callback twice to verify idempotency**:

First call:
```bash
curl -X POST http://localhost:3001/api/queue/mpesa-callback \
  -d '{"Body": {"stkCallback": {..., "CheckoutRequestID": "TEST_123"}}}'
```
Response: 200 OK, database updated

Second call (same CheckoutRequestID):
```bash
curl -X POST http://localhost:3001/api/queue/mpesa-callback \
  -d '{"Body": {"stkCallback": {..., "CheckoutRequestID": "TEST_123"}}}'
```
Response: 200 OK, database NOT updated again

Check logs:
```
⚠️  Transaction already processed with status: success
```

✅ **Duplicate callback ignored gracefully**

---

## 🚀 PRODUCTION DEPLOYMENT

### Step 1: Deploy Code to Render

```bash
cd c:\Users\user\Desktop\jkuat-queue-online 3.2 SRC
git add -A
git commit -m "🔧 Fix M-Pesa callback URL handling and multiple lookup strategies"
git push origin main
```

**Render will auto-deploy**. Monitor deployment:
- Go to: https://dashboard.render.com/web/srv-d86dsqh9rddc73bvpg60
- Click "Logs" → Monitor for deployment completion
- Look for: `[mpesa-pay.ts] Mode: PRODUCTION 🚀`

---

### Step 2: Configure Production Environment Variables

On Render dashboard:
1. Go to: https://dashboard.render.com/web/srv-d86dsqh9rddc73bvpg60/env
2. Add/Update these variables:

```
CONSUMER_KEY = [from Daraja Dashboard]
CONSUMER_SECRET = [from Daraja Dashboard]
PASSKEY = [from M-Pesa Online]
SHORTCODE = [from M-Pesa Online - your till number]
CALLBACK_URL = https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback
NODE_ENV = production
```

⚠️ **CRITICAL**: Ensure credentials are different from sandbox defaults:
```
SANDBOX: consumer_key = 4PvGSK0r7RiNmZkjnEwYlQ2xAzB8sD3qF5gH6tJ9oP1u2v
YOUR PROD: consumer_key = [completely different value]
```

3. Click "Save" → Service redeploys with new variables

---

### Step 3: Verify Production Mode Active

**Check Render logs**:
```
[mpesa-pay.ts] Mode: PRODUCTION 🚀
✅ Callback URL validated: https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback
```

---

### Step 4: Test STK Push with Real Credentials

**Create a test queue entry**:
1. Go to: https://jkuat-online-queue.onrender.com
2. Select service
3. Join queue
4. Note queue ID

**Test STK push** (use real Kenya phone):
```bash
curl -X POST https://jkuat-online-queue.onrender.com/api/queue/1/mpesa-pay \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+254712345678"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "checkoutRequestId": "ws_CO_11112025115046698741958927",
  "responseCode": "0",
  "message": "STK push initiated...",
  "mpesaStatus": "pending",
  "goldenTicketRef": "GT-REG-20260531-001"
}
```

✅ **STK prompt should appear on your phone within 5-10 seconds**

---

### Step 5: Complete Payment

1. **Check your phone** - M-Pesa prompt appears
2. **Enter your PIN** to complete transaction
3. **M-Pesa sends callback** to our server
4. **Check logs** on Render:

```
🔔 M-Pesa Callback Received
   CheckoutRequestID: ws_CO_11112025115046698741958927
   ResultCode: 0
   ✅ Found entry by goldenTicketRef: GT-REG-20260531-001
   ✅ Payment successful for queue 1
   ✅ Database updated: Queue 1 is now a GOLDEN TICKET
```

**Check database**:
```sql
SELECT id, isGolden, mpesaStatus, mpesaPaidAt 
FROM queue_entries 
WHERE id = 1;
```

Expected:
```
id  | isGolden | mpesaStatus | mpesaPaidAt
1   | true     | success     | 2026-05-31 10:23:45.123456
```

---

## 🔍 TROUBLESHOOTING

### Problem: STK prompt doesn't appear on phone

**Check**:
1. ✅ Phone number format: Must be +254XXXXXXXXX or 0XXXXXXXXX
2. ✅ Credentials set in Render environment
3. ✅ Mode is PRODUCTION 🚀 (not SANDBOX 🧪)
4. ✅ Phone has active M-Pesa account
5. ✅ Phone has sufficient balance to receive prompt

**Error Response Code Meanings**:
- `01`: Invalid credentials → Check CONSUMER_KEY/SECRET in Render
- `14`: Invalid phone format → Use +254712345678 or 0712345678
- `20`: Invalid Passkey → Check PASSKEY in Render  
- `25`: Invalid shortcode → Check SHORTCODE in Render (must be your till)
- `8`: System error → M-Pesa having issues, will auto-retry

### Problem: Callback not being processed

**Check**:
1. ✅ Callback URL is HTTPS (not HTTP)
2. ✅ Callback URL is publicly accessible: `curl https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback`
3. ✅ Callback endpoint returns 200 OK
4. ✅ Check Render logs for callback reception

**Test callback manually**:
```bash
curl -X POST https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback \
  -H "Content-Type: application/json" \
  -d '{"Body": {"stkCallback": {"ResultCode": 0, "CheckoutRequestID": "test"}}}'
```

Should respond: `200 OK`

### Problem: Golden ticket not updating to true

**Check database**:
```sql
SELECT id, mpesaStatus, isGolden, goldenTicketRef 
FROM queue_entries 
WHERE mpesaStatus = 'success' 
LIMIT 5;
```

**If isGolden is still false**:
- Callback received but `isGolden` not set to true
- Check if callback executed at all (check Render logs)
- May need to rerun callback if database update failed

---

## 📊 MONITORING & LOGS

### Render Log Patterns

**Successful STK initiation**:
```
📱 Initiating STK Push
   Phone: 254712345678
   Amount: KES 50
   Mode: PRODUCTION
   Response Code: 0
✅ STK Push successful!
```

**Callback received**:
```
🔔 M-Pesa Callback Received
   CheckoutRequestID: ws_CO_...
   ResultCode: 0
✅ Found entry by goldenTicketRef: GT-REG-...
✅ Database updated: Queue X is now a GOLDEN TICKET
```

**Idempotent retry**:
```
⚠️  Transaction already processed with status: success
```

**Error cases**:
```
❌ Payment failed for queue X: ResponseCode=20
   Message: Invalid Passkey
```

---

## ✅ FINAL CHECKLIST

Before considering production ready:

- [ ] Code deployed to Render
- [ ] Environment variables set with real credentials
- [ ] Logs show: `Mode: PRODUCTION 🚀`
- [ ] Callback URL validated (HTTPS, publicly accessible)
- [ ] Test STK push works (gets prompt on phone)
- [ ] Test callback received and database updated
- [ ] isGolden flag is true after successful payment
- [ ] Duplicate callbacks don't re-process
- [ ] All error responses return 200 OK
- [ ] mpesaPaidAt timestamp is set on success

---

## 🎯 NEXT STEPS

1. ✅ Deploy code with git push
2. ✅ Set Render environment variables
3. ✅ Wait for Render deployment to complete
4. ✅ Test with real phone number
5. ✅ Monitor Render logs for success
6. ✅ Verify database updates correctly
7. ✅ Go live!

