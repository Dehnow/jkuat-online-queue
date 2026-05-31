# Golden Ticket Eligibility System - Quick Start & Testing

## 🎯 What Changed?

### Before:
- Any ticket could be upgraded to golden at any time
- No restriction on which ticket gets the golden upgrade opportunity

### After:
- ✅ **Only the most recent ticket** can be upgraded to golden
- ✅ When you create a new ticket, the golden upgrade opportunity **moves to the new ticket**
- ✅ Old tickets can no longer be upgraded (except if they're already golden)
- ✅ Golden ticket references now include more details (timestamp, student ID, queue ID)

---

## 📋 Testing Checklist

### Test 1: Create First Ticket
```bash
curl -X POST http://localhost:3001/api/queue \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "studentId": "ASC/2024/001",
    "serviceType": "registrar"
  }'
```

**Expected Response:**
```json
{
  "id": 1,
  "queueNumber": 1,
  "goldenTicketEligible": true,  // ← NEW FIELD
  "message": "You can upgrade this ticket to a Golden Ticket for priority access!"
}
```

### Test 2: Check Ticket Status
```bash
curl http://localhost:3001/api/queue/1
```

**Expected Response:**
```json
{
  "id": 1,
  "queueNumber": 1,
  "status": "waiting",
  "canUpgradeToGolden": true,     // ← NEW FIELD
  "goldenTicketEligible": true,   // ← NEW FIELD
  "isGolden": false
}
```

### Test 3: Create Second Ticket
```bash
curl -X POST http://localhost:3001/api/queue \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "studentId": "ASC/2024/001",
    "serviceType": "registrar"
  }'
```

**Expected Response:**
```json
{
  "id": 2,
  "queueNumber": 2,
  "goldenTicketEligible": true,  // ← Most recent ticket is eligible
  "message": "You can upgrade this ticket to a Golden Ticket for priority access!"
}
```

### Test 4: Check First Ticket (Now Ineligible)
```bash
curl http://localhost:3001/api/queue/1
```

**Expected Response:**
```json
{
  "id": 1,
  "queueNumber": 1,
  "status": "waiting",
  "canUpgradeToGolden": false,    // ← Changed to false!
  "goldenTicketEligible": false,
  "isGolden": false
}
```

### Test 5: Try to Upgrade First Ticket (Should Fail)
```bash
curl -X POST http://localhost:3001/api/queue/1/mark-golden \
  -H "Content-Type: application/json" \
  -d '{
    "action": "mark-golden"
  }'
```

**Expected Response (403 Forbidden):**
```json
{
  "error": "This ticket cannot be upgraded to golden",
  "message": "Golden ticket opportunity is only available for your most recent ticket..."
}
```

### Test 6: Upgrade Second Ticket (Should Succeed)
```bash
curl -X POST http://localhost:3001/api/queue/2/mpesa-pay \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+254712345678"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "STK push sent...",
  "goldenTicketRef": "GT-REG-20260531-1530-0002-1234-ABC",  // ← NEW FORMAT
  "mpesaStatus": "pending"
}
```

---

## 🆕 New Golden Ticket Reference Format

**Format:** `GT-SERVICE-DATE-TIME-QUEUEID-STUDENTID-RANDOM`

**Example:** `GT-REG-20260531-1530-0002-1234-ABC`

| Component | Example | Meaning |
|-----------|---------|---------|
| `GT` | GT | Golden Ticket prefix |
| `REG` | REG | Service (REG/FIN/ICT) |
| `20260531` | 20260531 | Date YYYYMMDD |
| `1530` | 1530 | Time HHMM (24-hour) |
| `0002` | 0002 | Queue ID (padded to 4 digits) |
| `1234` | 1234 | Last 4 chars of Student ID |
| `ABC` | ABC | Random suffix |

---

## 🚀 Deployment Instructions

### 1. Run Migration
```bash
npx drizzle-kit migrate
# OR for development
npm run migrate:local
```

### 2. Restart Server
```bash
# Production
npm run prod

# Development
npm run dev
```

### 3. Verify Changes
```bash
# Check that callback endpoint is working
curl https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback

# Expected response
{
  "status": "ok",
  "message": "M-Pesa callback endpoint is live",
  "method": "POST"
}
```

---

## 📊 Database Changes

### New Column
```sql
ALTER TABLE "queue_entries" ADD COLUMN "can_upgrade_to_golden" boolean DEFAULT true NOT NULL;
```

### What It Tracks
- `TRUE`: Ticket is eligible for golden upgrade (most recent by this student)
- `FALSE`: Ticket is NOT eligible (older ticket or not by this student)

---

## 🔍 API Endpoint Updates

### Modified Endpoints
1. **POST /api/queue** - Now returns `goldenTicketEligible` flag
2. **GET /api/queue/:id** - Now returns `canUpgradeToGolden` and `goldenTicketEligible`
3. **POST /api/queue/:id/mark-golden** - Now validates eligibility
4. **POST /api/queue/:id/mpesa-pay** - Now validates eligibility

### New Validation Rules
- ✅ Cannot upgrade ticket if `canUpgradeToGolden` = false
- ✅ Cannot upgrade already golden tickets
- ✅ Returns 403 Forbidden if not eligible
- ✅ Returns clear error message with guidance

---

## ⚠️ Important Notes

### For Frontend Developers
- Update golden ticket buttons to show eligibility status
- Disable "Upgrade to Golden" button if `goldenTicketEligible` = false
- Show helpful message: "Golden ticket opportunity is only available for your most recent ticket"

### For Admin/Support
- If student asks why they can't upgrade old ticket: Explain they need to create a new ticket
- Each new ticket gets a fresh golden ticket opportunity
- This encourages active engagement and prevents hoarding

### For Students
- You can only upgrade your **most recent** ticket to golden
- When you create a new ticket, the golden opportunity moves to that new ticket
- Previous tickets can no longer be upgraded (unless already golden)

---

## 🐛 Troubleshooting

### Issue: "Cannot upgrade ticket" error
**Solution:** Create a new ticket. You can only upgrade your most recent ticket.

### Issue: Second ticket shows `canUpgradeToGolden: false`
**Cause:** Migration didn't run properly
**Solution:** Run `npm run migrate` or `npm run migrate:local`

### Issue: Old reference format still showing
**Solution:** Ensure api-server.js and golden-ticket.ts are updated and redeployed

---

## 📝 Files Modified
- `db/schema.ts` - New column definition
- `api-server.js` - Queue creation logic
- `src/routes/api/queue/golden-ticket.ts` - Reference format & eligibility
- `src/routes/api/queue/$id/mpesa-pay.ts` - Eligibility validation
- `src/routes/api/queue/-$id.ts` - Response with eligibility fields
- `drizzle/0002_curved_pestilence.sql` - Database migration

---

## ✅ Success Indicators
1. ✅ New tickets show `goldenTicketEligible: true`
2. ✅ Second tickets have `canUpgradeToGolden: false` for first ticket
3. ✅ Golden ticket references include full details (date, time, ID)
4. ✅ Cannot upgrade ineligible tickets (403 error)
5. ✅ M-Pesa payment only works for eligible tickets
