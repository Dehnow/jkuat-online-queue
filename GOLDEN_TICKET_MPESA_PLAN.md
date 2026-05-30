# GOLDEN TICKET & M-PESA IMPLEMENTATION PLAN

**Date:** May 30, 2026  
**Status:** 🚀 READY FOR IMPLEMENTATION

---

## OVERVIEW

### Golden Ticket System
- Students can purchase a "Golden Ticket" for priority queue service
- Payment via M-Pesa (Safaricom's mobile money platform)
- Golden tickets are served BEFORE regular queue entries
- Cost: KES 50 per ticket (configurable)

### How It Works
1. Student joins regular queue first
2. In dashboard, sees "Upgrade to Golden Ticket" option
3. Clicks to initiate M-Pesa payment
4. Scans QR or enters M-Pesa PIN (STK prompt on phone)
5. Payment successful → Queue entry marked as golden
6. Staff calls golden tickets first (priority service)

---

## DATABASE SCHEMA (Already in place)

```javascript
// Queue Entry Fields
isGolden: boolean('is_golden').notNull().default(false)
goldenTicketRef: text('golden_ticket_ref')  // e.g., "GT-REG-20260530-001"
mpesaTransactionId: text('mpesa_transaction_id')
mpesaStatus: enum('pending' | 'success' | 'failed')
mpesaPaidAt: timestamp('mpesa_paid_at')
```

---

## FEATURE 1: M-PESA API ENDPOINTS

### Endpoint 1: POST /api/queue/:id/mpesa-pay
**Purpose:** Initiate M-Pesa STK Push payment

**Request:**
```javascript
POST /api/queue/5/mpesa-pay
{
  "phoneNumber": "+254712345678"  // Customer's phone for STK push
}
```

**Response (Success - 200):**
```javascript
{
  "success": true,
  "checkoutRequestId": "ws_CO_DMZ_1234567890",
  "responseCode": "0",
  "message": "STK push sent successfully",
  "mpesaStatus": "pending",
  "goldenTicketRef": "GT-REG-20260530-001"
}
```

**Response (Error - 429):**
```javascript
{
  "error": "Already has golden ticket",
  "message": "This queue entry already has a golden ticket"
}
```

### Endpoint 2: POST /api/queue/mpesa-callback
**Purpose:** Handle M-Pesa payment callback from Safaricom

**Request (from M-Pesa):**
```javascript
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "abc123",
      "CheckoutRequestID": "ws_CO_DMZ_1234567890",
      "ResultCode": 0,  // 0 = success, others = failure
      "ResultDesc": "The service request has been processed successfully.",
      "CallbackMetadata": {
        "Item": [
          { "Name": "Amount", "Value": 50 },
          { "Name": "MpesaReceiptNumber", "Value": "LK451H35OP" },
          { "Name": "TransactionDate", "Value": 20260530104530 },
          { "Name": "PhoneNumber", "Value": 254712345678 }
        ]
      }
    }
  }
}
```

**Actions:**
- Find queue entry by CheckoutRequestID mapping
- If ResultCode == 0: Mark as golden, set mpesaStatus='success'
- If ResultCode != 0: Set mpesaStatus='failed'
- Return 200 OK to acknowledge receipt

### Endpoint 3: GET /api/queue/:id/mpesa-status
**Purpose:** Check payment status for a queue entry

**Response:**
```javascript
{
  "id": 5,
  "isGolden": true,
  "mpesaStatus": "success",
  "mpesaTransactionId": "LK451H35OP",
  "mpesaPaidAt": "2026-05-30T10:45:30.000Z",
  "goldenTicketRef": "GT-REG-20260530-001"
}
```

---

## FEATURE 2: STUDENT DASHBOARD UI

### Section 1: Current Ticket Card
**Shows:**
- Queue number
- Service type
- Current position in queue
- Time waiting

**Actions:**
- Print ticket
- Track queue position
- ✨ **NEW:** "Upgrade to Golden Ticket" button (if not already golden)

### Section 2: Golden Ticket Upgrade Modal
**Triggered when:** Click "Upgrade to Golden Ticket"

**Form Fields:**
1. Phone Number (pre-filled or empty)
2. Display confirmation:
   - Queue number will be prioritized
   - Cost: KES 50
3. "Pay with M-Pesa" button
4. Loading state during payment
5. Success/Error message

**Payment Flow:**
1. User clicks "Pay with M-Pesa"
2. Frontend calls POST /api/queue/:id/mpesa-pay
3. Server initiates STK push on user's phone
4. User sees M-Pesa prompt (enters PIN)
5. Frontend polls GET /api/queue/:id/mpesa-status
6. Payment confirmed → Show success message
7. Queue number now marked as GOLDEN ⭐

---

## FEATURE 3: STAFF DASHBOARD UPDATES

### Change: Serve Next - Priority Logic

**Current Priority:**
1. Regular waiting entries (FIFO)

**New Priority:**
1. **Golden tickets with successful payment** ← FIRST
2. Golden tickets with pending payment → SKIP
3. Regular waiting entries (FIFO)

**Visual Indicator:**
- Show ⭐ icon next to golden ticket numbers
- Highlight golden tickets in different color

---

## IMPLEMENTATION ROADMAP

### Phase 1: API Endpoints (api-server.js)
```javascript
// Add these endpoints:
POST /api/queue/:id/mpesa-pay          // Initiate payment
POST /api/queue/mpesa-callback          // Handle callback
GET /api/queue/:id/mpesa-status         // Check status
```

### Phase 2: Frontend UI (src/routes/index.tsx)
```javascript
// Add components:
<GoldenTicketCard />                    // Shows upgrade option
<GoldenTicketModal />                   // Payment UI
<MpesaPaymentForm />                    // Phone + pay button
```

### Phase 3: Status Tracking
```javascript
// Add polling:
useEffect(() => {
  const interval = setInterval(checkPaymentStatus, 3000)
  return () => clearInterval(interval)
}, [ticketId])
```

---

## M-PESA CONFIGURATION

### Sandbox (Development/Testing)
```
MPESA_SANDBOX=true
MPESA_CONSUMER_KEY=YLPydMh4xhirGrux1cdHyqKRCE3BzinLxdlzed4s88XyiRnu
MPESA_CONSUMER_SECRET=RuAadmSxyhwAqjk1GqEwW3vyoDtbCD0nByXAHR7GZw0COLoxSI6u0AKa91wSL4uw
MPESA_SHORTCODE=174379
MPESA_PASSKEY=bfb279f9ba9b9d1380007480bbe7f27425e1aa6d4ede3891ec337007a74ff42
MPESA_CALLBACK_URL=http://localhost:3000/api/queue/mpesa-callback
```

### Production
```
MPESA_SANDBOX=false
MPESA_CONSUMER_KEY=<production key>
MPESA_CONSUMER_SECRET=<production secret>
MPESA_SHORTCODE=<production shortcode>
MPESA_PASSKEY=<production passkey>
MPESA_CALLBACK_URL=https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback
```

---

## LOCAL TESTING GUIDE

### Step 1: Setup M-Pesa Config
Add to .env.local:
```
MPESA_SANDBOX=true
MPESA_CONSUMER_KEY=YLPydMh4xhirGrux1cdHyqKRCE3BzinLxdlzed4s88XyiRnu
MPESA_CONSUMER_SECRET=RuAadmSxyhwAqjk1GqEwW3vyoDtbCD0nByXAHR7GZw0COLoxSI6u0AKa91wSL4uw
MPESA_SHORTCODE=174379
MPESA_PASSKEY=bfb279f9ba9b9d1380007480bbe7f27425e1aa6d4ede3891ec337007a74ff42
MPESA_CALLBACK_URL=http://localhost:3000/api/queue/mpesa-callback
```

### Step 2: Test Payment Initiation
```bash
# Login as student
curl -X POST http://localhost:3000/api/queue \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Student",
    "studentId": "S12345",
    "serviceType": "registrar"
  }'
# Response: { id: 10, ... }

# Upgrade to golden ticket
curl -X POST http://localhost:3000/api/queue/10/mpesa-pay \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+254712345678"}'

# Response should show:
# "checkoutRequestId": "ws_CO_..."
# "mpesaStatus": "pending"
```

### Step 3: Simulate M-Pesa Callback
```bash
# Simulate successful payment callback
curl -X POST http://localhost:3000/api/queue/mpesa-callback \
  -H "Content-Type: application/json" \
  -d '{
    "Body": {
      "stkCallback": {
        "MerchantRequestID": "abc123",
        "CheckoutRequestID": "ws_CO_DMZ_1234567890",
        "ResultCode": 0,
        "ResultDesc": "Success",
        "CallbackMetadata": {
          "Item": [
            { "Name": "Amount", "Value": 50 },
            { "Name": "MpesaReceiptNumber", "Value": "LK451H35OP" },
            { "Name": "PhoneNumber", "Value": 254712345678 }
          ]
        }
      }
    }
  }'
```

### Step 4: Verify Status
```bash
curl http://localhost:3000/api/queue/10/mpesa-status
# Response shows: isGolden: true, mpesaStatus: 'success'
```

---

## KEY DESIGN DECISIONS

### 1. Golden Ticket Cost
- **Local Testing:** Free (cost = 0)
- **Production:** KES 50 per ticket
- **Reasoning:** Test without real money

### 2. Payment Status Polling
- **Interval:** 3 seconds
- **Timeout:** 120 seconds (2 minutes)
- **Reason:** User-friendly, not too aggressive

### 3. Queue Priority
- **Golden tickets served FIRST** regardless of join time
- **Within golden:** Oldest first (FIFO)
- **Reason:** Premium service for paying customers

### 4. Transaction Reference
- **Format:** `GT-{SERVICE}-{DATE}-{SEQUENCE}`
- **Example:** `GT-REG-20260530-001`
- **Use:** For receipts, tracking, support

---

## VALIDATION & ERROR HANDLING

### Validation Rules
1. ✅ Phone number must be valid Kenya format (+254...)
2. ✅ Can't upgrade to golden twice
3. ✅ Can't pay after queue entry is served/cancelled
4. ✅ Payment amount must be KES 50
5. ✅ Must have active queue entry to upgrade

### Error Messages
- "Invalid phone number format"
- "This queue entry already has a golden ticket"
- "Queue entry has already been served"
- "Payment failed - please try again"
- "Payment timeout - please check status later"

---

## TESTING CHECKLIST

- [ ] Create queue entry successfully (S55555)
- [ ] See "Upgrade to Golden Ticket" button on ticket
- [ ] Click button → Modal opens with phone field
- [ ] Enter phone → Payment initiated
- [ ] See loading spinner during payment
- [ ] Simulate M-Pesa callback
- [ ] Status updates to "Golden ⭐"
- [ ] Staff sees golden ticket as priority
- [ ] Print ticket shows "⭐ PRIORITY TICKET"
- [ ] Payment error → Shows helpful message
- [ ] Can't upgrade golden ticket twice

---

## SUMMARY

This implementation adds a complete golden ticket system with M-Pesa integration:

✅ **Database:** Already has schema (isGolden, mpesaStatus, etc.)  
✅ **API:** Needs 3 endpoints  
✅ **Frontend:** Needs modal + polling logic  
✅ **Staff:** Needs priority sorting  

**Estimated Development Time:** 2-3 hours  
**Estimated Testing Time:** 1 hour  
**Risk Level:** LOW (isolated feature, existing DB schema)
