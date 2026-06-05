# JKUAT Queue Management System - Technical Overview

## System Purpose
A digital queue management system for JKUAT (university) students and staff to streamline service delivery across three departments: Registrar, Finance, and ICT Helpdesk. Students join queues, wait for service, and optionally pay to upgrade to priority status (Golden Tickets). Staff manage queues in real-time, and administrators oversee the entire system.

---

## Key Backend Code Snippets

### Queue Entry Creation (Create New Ticket)
```javascript
// POST /api/queue - Create queue entry
const entry = await db.insert(queueEntries).values({
  name: body.name,
  studentId: body.studentId,
  serviceType: body.serviceType,
  queueNumber: maxQueueNum + 1,
  status: 'waiting',
  canUpgradeToGolden: true
}).returning()

return json({ 
  id: entry[0].id, 
  queueNumber: entry[0].queueNumber,
  referenceNumber: `${serviceCode}${entry[0].id}`
})
```

### Claim Gold - Position Calculation
```javascript
// Limit golden tickets ahead: Max 3 golden tickets at priority
const successfulGoldWaiting = waitingWithoutGolden.filter(
  (ticket) => ticket.isGolden && ticket.mpesaStatus === 'success'
)

let targetPosition = 0
if (successfulGoldWaiting.length === 0) {
  targetPosition = 0  // Go to front
} else if (successfulGoldWaiting.length <= 3) {
  const lastGold = successfulGoldWaiting[successfulGoldWaiting.length - 1]
  targetPosition = waitingWithoutGolden.findIndex((ticket) => ticket.queueNumber > lastGold.queueNumber)
} else {
  const thirdGold = successfulGoldWaiting[2]
  targetPosition = waitingWithoutGolden.findIndex((ticket) => ticket.queueNumber > thirdGold.queueNumber)
}

// Shift queue numbers
await db.update(queueEntries)
  .set({ queueNumber: sql`${queueEntries.queueNumber} + 1` })
  .where(and(
    eq(queueEntries.serviceType, serviceType),
    eq(queueEntries.status, 'waiting'),
    not(eq(queueEntries.id, queueId)),
    sql`${queueEntries.queueNumber} >= ${insertionQueueNumber}`
  ))
```

### Call Next - Golden Priority
```javascript
// Priority: Golden tickets first
let nextEntry = await db.query.queueEntries.findFirst({
  where: and(
    eq(queueEntries.officeId, officeId),
    eq(queueEntries.status, 'waiting'),
    eq(queueEntries.isGolden, true),
    eq(queueEntries.mpesaStatus, 'success')
  ),
  orderBy: (table, { asc }) => [asc(table.queueNumber)]
})

// If no golden, get regular
if (!nextEntry) {
  nextEntry = await db.query.queueEntries.findFirst({
    where: and(
      eq(queueEntries.officeId, officeId),
      eq(queueEntries.status, 'waiting')
    ),
    orderBy: (table, { asc }) => [asc(table.queueNumber)]
  })
}
```

### M-Pesa STK Push - Initiate Payment
```javascript
// POST /api/queue/$id/mpesa-pay - Send STK prompt
const stkPayload = {
  BusinessShortCode: MPESA_CONFIG.tillNumber,
  Password: base64Password,
  Timestamp: timestamp,
  TransactionType: 'CustomerPayBillOnline',
  Amount: 50,
  PartyA: phoneNumber,
  PartyB: MPESA_CONFIG.tillNumber,
  PhoneNumber: phoneNumber,
  CallBackURL: MPESA_CONFIG.callbackUrl,
  AccountReference: `GT${queueId}`,
  TransactionDesc: `Golden Ticket ${queueId}`
}

const response = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}` },
  body: JSON.stringify(stkPayload)
})
```

### M-Pesa Callback Handler
```javascript
// POST /api/queue/mpesa-callback - Receive payment confirmation
const { Body } = await request.json()
const resultCode = Body.stkCallback.ResultCode

if (resultCode === 0) {
  // Payment success
  const callbackMetadata = Body.stkCallback.CallbackMetadata.Item
  const mpesaReceiptNumber = callbackMetadata.find(x => x.Name === 'MpesaReceiptNumber').Value
  
  await db.update(queueEntries).set({
    mpesaStatus: 'success',
    mpesaTransactionId: mpesaReceiptNumber,
    mpesaPaidAt: new Date()
  }).where(eq(queueEntries.id, queueId))
} else {
  // Payment failed
  await db.update(queueEntries).set({
    mpesaStatus: 'failed'
  }).where(eq(queueEntries.id, queueId))
}
```

### Mark as Served - Update Status
```javascript
// POST /api/staff/queue-action - End service
await db.update(queueEntries).set({
  status: 'served',
  servedAt: new Date()
}).where(eq(queueEntries.id, queueId))

return json({
  action: 'end_service',
  entry: { id, status: 'served' },
  message: 'Customer service completed'
})
```

### Get Queue Status - Real-time Polling
```javascript
// GET /api/getQueueStatus - Check office and queue status
const offices = await db.query.offices.findMany({
  where: eq(offices.status, 'open')
})

const queueStats = await Promise.all(
  offices.map(async (office) => ({
    officeId: office.id,
    officeName: office.name,
    waitingCount: await db.query.queueEntries.findMany({
      where: and(
        eq(queueEntries.officeId, office.id),
        eq(queueEntries.status, 'waiting')
      )
    }),
    averageWaitTime: calculateWaitTime(...)
  }))
)
```

---

## Architecture Overview

### Tech Stack
- **Frontend**: React 18 + TanStack Router + TanStack Query (SSR with TanStack Start/Vite)
- **Backend**: Express.js (Node.js) with ES Modules
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: Tailwind CSS
- **Build Tool**: Vite
- **Payment Gateway**: M-Pesa (Daraja API)

### Deployment
- **Frontend**: Vite builds to static assets (`/dist`)
- **Server**: Single Express server hosts frontend + API routes
- **Environment**: Auto-detects production vs. sandbox via M-Pesa credentials

---

## Data Model

### Core Tables
1. **queue_entries**: Student queue tickets
   - Tracks: name, student ID, service type, queue number, status (waiting/serving/served/cancelled)
   - Golden ticket fields: isGolden, goldenTicketRef, M-Pesa transaction data
   
2. **offices**: Service departments
   - Each office has: name, service type, status (open/closed), staff credentials
   
3. **staff_accounts**: Individual staff members
   - Linked to an office, supports admin privileges
   
4. **feedbackMessages**: Student feedback and complaints
   - Tracked with status (pending/approved/rejected)
   
5. **adminRequests**: Staff requests for office creation/editing
   - Managed by admin users

---

## User Flows

### 1. Student Journey
```
Landing Page → Enter Details → Join Queue
        ↓
View Ticket (stored in localStorage)
   - Queue number, service type, status
   - Countdown timer to service
        ↓
[Optional] Pay for Golden Ticket (M-Pesa STK prompt)
        ↓
Track Queue Status (real-time polling)
        ↓
Served → Receive confirmation → Done
```

### 2. Staff Dashboard
```
Login (office-specific) → View Office Queue
        ↓
See all waiting/serving students
        ↓
Call Next → Mark as Serving → Mark as Served
        ↓
View service logs, feedback, reports
```

### 3. Admin Dashboard
```
Login (admin credentials) → Manage System
        ↓
- Create/edit offices
- Create/manage staff accounts
- View system-wide reports
- Approve/reject feedback and requests
- View all queue history
```

---

## Key Features Explained

### Queue Management
- Students submit their name, ID, and service type
- System auto-assigns queue number (sequential per service type)
- Queue status: waiting → serving → served (or cancelled)
- Real-time updates via API polling

### Golden Ticket System
- Allows students to skip the queue for a fee (KES 50)
- Implemented via M-Pesa payment
- Payment status linked to queue entry
- Can only upgrade the most recent ticket (canUpgradeToGolden flag)

#### Golden Ticket Reference Generation
Format: `GT-{SERVICE}-{DATE}-{TIME}-{QUEUE_ID}-{STUDENT_ID_LAST4}-{RANDOM}`

Example: `GT-REG-20260531-1530-0042-1234-ABC`

Components:
- `GT`: Golden Ticket prefix
- `SERVICE`: REG (Registrar), FIN (Finance), ICT (ICT Helpdesk)
- `DATE`: YYYYMMDD format
- `TIME`: HHMM format
- `QUEUE_ID`: 4-digit zero-padded queue entry ID
- `STUDENT_ID_LAST4`: Last 4 characters of student ID (uppercase)
- `RANDOM`: 3 random alphanumeric characters

#### Claim Gold Endpoint (`POST /api/queue/claim-gold`)

**Request Parameters:**
```json
{
  "queueId": 42,           // Required: Queue entry ID
  "serviceType": "registrar"  // Required: Service type (registrar, finance, ict_helpdesk)
}
```

**Validation Checks:**
1. Ticket must exist
2. Ticket must be marked as golden (`isGolden === true`)
3. Payment must be successful (`mpesaStatus === 'success'`)
4. Ticket must still be waiting (`status === 'waiting'`)
5. Cannot claim if already being served or served

**Queue Position Algorithm:**
- **Goal**: Move golden ticket ahead of regular tickets while respecting other golden tickets
- **Rules**:
  1. If no other golden tickets exist → Move to position 0 (front of queue)
  2. If 1-3 golden tickets exist → Move behind the last golden ticket
  3. If 4+ golden tickets exist → Move behind the 3rd golden ticket (max 3 golden tickets at a time)
  4. Other golden tickets maintain their priority order

**Response Example (Success):**
```json
{
  "success": true,
  "message": "✅ Golden ticket claimed and moved into the priority line.",
  "oldQueueNumber": 105,
  "newQueueNumber": 3,
  "newPosition": 2,
  "totalWaiting": 24
}
```

**Response Example (Already in Correct Position):**
```json
{
  "success": true,
  "message": "Your golden ticket is already in the correct waiting position.",
  "currentQueueNumber": 3,
  "currentPosition": 1
}
```

**Error Responses:**
- `400`: Not a valid golden ticket (not marked golden or payment failed)
- `400`: Ticket not in waiting status
- `404`: Ticket not found
- `404`: Ticket not found in active waiting queue

#### Golden Ticket Endpoint (`POST /api/queue/golden-ticket`)

**Request Parameters:**
```json
{
  "queueId": 42,              // Required: Queue entry ID
  "action": "mark-golden"     // Required: "mark-golden" or "mark-success"
}
```

**Action 1: mark-golden** (Initiate golden upgrade)
- Prerequisites:
  - Ticket must be eligible for upgrade (`canUpgradeToGolden === true`)
  - Ticket must not already be golden
  
- Response:
```json
{
  "success": true,
  "message": "Golden ticket activated. Proceed to payment.",
  "goldenTicketData": {
    "id": 42,
    "goldenTicketRef": "GT-REG-20260531-1530-0042-1234-ABC",
    "queueNumber": 105,
    "studentId": "STU001234",
    "serviceType": "registrar",
    "originalTicket": "REG42",
    "amount": 50,
    "description": "Golden Ticket Premium - Queue #105",
    "expiresAt": "2026-05-31T15:40:00.000Z"  // 10-minute payment window
  }
}
```

**Action 2: mark-success** (Confirm payment received)
- Prerequisites:
  - Ticket must be marked as golden (`isGolden === true`)
  - Used after M-Pesa callback confirms payment

- Response:
```json
{
  "success": true,
  "message": "✅ Golden ticket activated! You now have priority status.",
  "goldenTicketData": {
    "id": 42,
    "goldenTicketRef": "GT-REG-20260531-1530-0042-1234-ABC",
    "queueNumber": 105,
    "studentId": "STU001234",
    "serviceType": "registrar",
    "mpesaStatus": "success",
    "isGolden": true
  }
}
```

**Error Responses:**
- `403`: Ticket cannot be upgraded (already used on previous ticket)
- `400`: Ticket already marked as golden
- `400`: Ticket not marked as golden yet (for mark-success action)
- `404`: Queue entry not found

#### Golden Ticket Eligibility
- **canUpgradeToGolden Flag**: Only the student's most recent ticket can be upgraded
- When a student creates a new ticket, the previous ticket's `canUpgradeToGolden` is set to `false`
- This ensures students pay for golden tickets only for active/current tickets

#### Claim Gold Button Workflow

**When User Clicks "Claim Gold":**

1. **Prerequisites Check**:
   - Ticket must be marked as golden (`isGolden === true`)
   - Payment must be successful (`mpesaStatus === 'success'`)
   - Ticket must still be waiting in queue (`status === 'waiting'`, not being served)

2. **Queue Repositioning Logic**:
   - Current golden ticket position is calculated
   - Algorithm determines target position based on other golden tickets:
     - **No other golden tickets**: Move to front of queue (position 0)
     - **1-3 other golden tickets**: Move behind the last golden ticket
     - **4+ other golden tickets**: Move behind the 3rd golden ticket (max 3 golden tickets at priority)
   - All regular tickets at or after insertion point are shifted +1 position
   - Golden ticket receives new queue number

3. **Success Response**:
   - Old and new queue numbers shown
   - New position in queue displayed
   - Message: "✅ Golden ticket claimed and moved into the priority line."

4. **Real-Time Update**:
   - UI refreshes to show new position
   - Queue display updated for other users watching

#### Why Students Buy Golden Tickets

**Scenario 1: Speed & Efficiency**
- Student joins queue and sees many people ahead (queue #50+)
- Student immediately buys golden ticket for KES 50
- After payment, student clicks "Claim Gold"
- Golden ticket moves them to front of priority line
- Gets served much faster (typically 5-15 minutes vs. 45+ minutes)
- Best for: Urgent business, limited time window

**Scenario 2: Late Arrival / On-Demand Upgrade**
- Student joins queue normally (no rush)
- Gets queue ticket, goes to rest area or class
- Later realizes they need service urgently
- Returns and buys golden ticket upgrade
- Clicks "Claim Gold" to enter priority queue
- Gets served within minutes instead of waiting for their original number
- Best for: Changed circumstances, unexpected urgency

**Scenario 3: Long Queue With High Wait Time**
- Service office is busy (many students in queue)
- Regular queue estimated time: 90+ minutes
- Student buys golden to cut waiting time by 80%
- Willing to pay KES 50 for time savings

#### Queue Servicing Priority (Call Next Algorithm)

**Staff Calls Next Customer - Priority Order:**

When a staff member clicks "Call Next":
1. **Check golden tickets first**: Fetch all waiting golden tickets sorted by queue number (ascending)
   - If found → Call the first golden ticket customer
   - Display: "Calling golden ticket holder 🎫"
2. **If no golden tickets**: Fetch regular waiting customers
   - Call the first regular customer in queue
   - Display: "Calling next customer"
3. **If queue empty**: Show "No waiting customers"

**Result**: Golden tickets are ALWAYS served before regular tickets when available, ensuring their premium service.

**Fairness Mechanism**: 
- The claim-gold algorithm limits max 3 golden tickets in priority queue at once
- This ensures regular customers still get served (not completely blocked)
- After 3 golden tickets are claimed, regular tickets must wait less
- Achieves balance between paying customers (golden) and regular customers

#### Service Logs Export & Printing

**Print Functionality:**

Admin Staff can generate and print service reports in two formats:

**Format 1: Print (Web Browser Print)**
- Button: "Print" on admin service report page
- Action: Triggers `window.print()`
- Output: Browser's print dialog opens
- Formats available: PDF, Paper, or other OS print options
- Includes:
  - Service report table (reference number, queue number, name, student ID, status, served at)
  - Statistics cards (total, served, cancelled, today's served)
  - Service details for each entry
  - Header with office name and service type

**Format 2: Excel/CSV Export**
- Not yet implemented in current UI button
- Can be added by implementing:
  - Convert table data to CSV or Excel format
  - Use libraries: `xlsx`, `papaparse`, or `exceljs`
  - Add "Export as Excel" button
  - Generate downloadable file

**Report Contents:**
- Reference Number (REF-{id})
- Queue Number (#)
- Student Name
- Student ID
- Service Status (served/cancelled/waiting/serving)
- Timestamp (Served At)
- Service Statistics summary

**Use Cases:**
- Daily reports for management review
- Archive records for compliance
- Share performance metrics with stakeholders
- Email to higher administration
- Budget/resource planning based on service volume

#### How Report Data Flows

```
1. Admin logs in to dashboard
2. Navigates to "Service Reports" → selects service (Registrar/Finance/ICT)
3. System fetches all queue entries for that service from database
4. Displays in table format with statistics
5. Admin clicks "Print" 
6. Browser print dialog opens
7. Admin selects:
   - Print to paper
   - Save as PDF
   - Save to file
8. Report exported in selected format
```

### M-Pesa Payment Integration
- **Auto-detection**: 
  - If production credentials present (CONSUMER_KEY, CONSUMER_SECRET, PASSKEY, SHORTCODE) → Uses **Production** (real payments)
  - If missing → Falls back to **Sandbox** (no real STK prompts)
- **Flow**:
  1. Student clicks "Buy Golden Ticket"
  2. STK prompt sent to student's phone
  3. Student enters M-Pesa PIN
  4. System receives callback with transaction status
  5. Queue entry updated with mpesaStatus and mpesaPaidAt
  6. Student upgraded to golden status

### Feedback System
- Students can submit feedback/complaints to their respective office
- Staff can respond or forward to admin
- Admin can approve/reject with responses

---

## API Routes

### Student Routes
- `GET /api/queue/$id` - Fetch single ticket status
- `POST /api/queue` - Create new queue entry
- `GET /api/getQueueStatus` - Get office status
- `POST /api/queue/$id/mpesa-pay` - Initiate payment
- `GET /api/queue/$id/mpesa-status` - Check payment status

### M-Pesa Routes
- `POST /api/queue/mpesa-callback` - Receive payment confirmations
- `POST /api/queue/golden-ticket` - Get golden ticket details

### Staff Routes
- `POST /api/staff/auth` - Staff login
- `GET /api/staff/office-status` - Get assigned office status
- `POST /api/staff/queue-action` - Call next, serve, cancel student
- `DELETE /api/staff/queue/-$officeId` - Remove entry from queue

### Admin Routes
- `GET /api/admin/offices` - List all offices
- `POST /api/admin/offices` - Create/edit office
- `GET /api/admin/feedback` - View all feedback
- `POST /api/admin/feedback` - Respond to feedback

---

## Request Flow (Example: Student Joins Queue)

```
1. Student fills form → React component state
2. Form submitted → POST /api/queue
3. Server receives request
4. Validates input (name, ID, service type)
5. Queries database for current queue count
6. Inserts new entry (id auto-generated, status='waiting')
7. Returns ticket JSON {id, queueNumber, referenceNumber, ...}
8. Frontend stores id in localStorage (deviceTickets array)
9. Displays ticket confirmation with reference number
10. Frontend starts polling /api/queue/$id every 2-5 seconds
11. When staff calls next → status changes to 'serving'
12. When staff marks done → status changes to 'served'
13. UI updates in real-time based on status
```

---

## Database Connection

### Configuration
- **Local Dev**: Uses `.env.local` (not committed to git)
- **Production**: Uses `.env` and `.env.example`
- Database URL: `DATABASE_URL` environment variable

### Migrations
```bash
npm run migrate:local   # Development
npm run migrate:prod    # Production
```

### Initialization
```bash
npm run init-data:local   # Seed demo data
```

---

## Running the System

### Development
```bash
npm run dev:local
# Starts Vite dev server (port 5173) + Express server (port 3000)
```

### Production
```bash
npm run build     # Build frontend
npm run start     # Run production server
```

### Scripts
- `dev:client` - Vite frontend only
- `dev:server` - Express server only (watch mode)
- `migrate` - Run DB migrations
- `init-data` - Seed database with demo data

---

## Key Implementation Details

### Session Management
- No persistent sessions; staff/admin credentials verified on each request
- JWT not implemented; authentication via simple username/password checks

### Client-Side Storage
- `deviceTickets`: Array of ticket IDs for active tracking
- `StudentId`: Student details persisted during session
- M-Pesa transaction data stored in queue entry

### Real-Time Updates
- Frontend polls API every 2-5 seconds for queue status
- No WebSocket; simple HTTP polling
- Batch ticket fetches to reduce API calls

### Error Handling
- Try-catch around API calls
- Graceful fallback to cached data
- User-friendly error messages

---

## Deployment Checklist

- [ ] Set `DATABASE_URL` in production environment
- [ ] Set M-Pesa credentials (CONSUMER_KEY, CONSUMER_SECRET, PASSKEY, SHORTCODE) for production payments
- [ ] Run migrations: `npm run migrate:prod`
- [ ] Seed initial data: `npm run init-data:prod`
- [ ] Set `CALLBACK_URL` to production domain for M-Pesa callbacks
- [ ] Verify CORS settings for allowed domains
- [ ] Test queue flow end-to-end
- [ ] Test M-Pesa payments in target environment
- [ ] Monitor logs for errors

---

## Security Notes

- **Credentials**: Store in environment variables, never hardcode
- **Database**: All queries use parameterized ORM (Drizzle) to prevent SQL injection
- **Validation**: Input validation needed at API layer
- **CORS**: Configured per environment
- **M-Pesa Callback**: Verify authenticity of payment confirmations
