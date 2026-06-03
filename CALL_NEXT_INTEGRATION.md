# CALL NEXT Button Integration - Implementation Summary

## Overview
Integrated real-time CALL NEXT button functionality from staff dashboard with real-time student notifications using Socket.IO with polling fallback.

## Files Modified

### 1. **src/routes/api/call-next.ts** (NEW)
**Purpose:** TanStack Start serverless handler for calling next customer  
**Features:**
- Retrieves next customer (golden tickets prioritized)
- Updates status to 'serving'
- Returns customer details for real-time notification
- Compatible with both TanStack Start and polling-based systems

### 2. **api-server.js**
**Location:** Lines 1078-1180 (New endpoint)  
**Changes:**
- Added POST `/api/call-next` endpoint with Basic Auth
- Implements same logic as TanStack handler
- Integrates with Socket.IO for real-time broadcasts (if available)
- Broadcasts `summon-student` event to specific student socket room
- Fallback: Works without Socket.IO using polling

### 3. **src/routes/admin.tsx**
**Location:** serveNext function (lines 249-284)  
**Changes:**
- Updated from `/api/admin/serve` to `/api/call-next`
- Changed from `serviceType` to `officeId` parameter
- Improved error handling with user-friendly alerts
- Shows confirmation with called customer name and ticket number
- Enhanced feedback: "Called: {name} (Ticket #{queueNumber}) to {counter}"

### 4. **src/routes/index.tsx** (Student Dashboard)
**Changes:**
- Added Socket.IO client initialization with graceful fallback
- New useEffect hook for Socket.IO real-time connections
- Registers student's active tickets with server for targeted notifications
- Listens for `summon-student` events when staff calls next
- New UI modal: Fullscreen "ATTENTION!" summon alert
- Audio and text-to-speech notifications (optional)
- Added state management:
  - `showSummonAlert` - Display alert modal
  - `summonedTicket` - Called ticket details
  - `summonMessage` - Counter/location message

## Real-Time Notification Flow

### Without Socket.IO (Fallback):
```
1. Staff clicks "Serve Next" in admin dashboard
2. /api/call-next endpoint called
3. Customer status updated to 'serving'
4. API returns customer details
5. Staff sees confirmation alert
6. Student polls queue status and sees "Serving" status
7. Student can manually check their ticket via dashboard
```

### With Socket.IO (Enhanced):
```
1. Staff clicks "Serve Next" in admin dashboard
2. /api/call-next endpoint called
3. Customer status updated to 'serving'
4. Socket.IO broadcasts summon-student event to student's ticket room
5. Student's browser receives real-time notification
6. Fullscreen "ATTENTION!" modal appears
7. Audio and text-to-speech alerts notify student immediately
```

## Socket.IO Setup (Optional Enhancement)

Socket.IO is imported dynamically in index.tsx and gracefully fails if not installed. To enable full Socket.IO support:

```bash
npm install socket.io socket.io-client
```

Then the system will use true real-time push notifications instead of polling.

## Key Features

### Staff Dashboard (admin.tsx):
- ✅ Click "Serve Next" button
- ✅ Automatically finds next waiting customer (golden first)
- ✅ Updates database status to 'serving'
- ✅ Shows confirmation: "Called: {name} (Ticket #{number}) to {counter}"
- ✅ Auto-refreshes queue view

### Student Dashboard (index.tsx):
- ✅ Real-time socket notification (if Socket.IO available)
- ✅ Polling fallback (always works)
- ✅ Fullscreen "ATTENTION!" alert when called
- ✅ Ticket number and counter location displayed
- ✅ Audio notification (beep)
- ✅ Text-to-speech: "Ticket {number}, Proceed to {counter}"
- ✅ "I am Proceeding" button to dismiss alert
- ✅ Auto-close after 10 seconds if not dismissed

## Existing Behavior Preserved

✅ All existing queue operations unchanged:
- Join queue flow
- Queue number assignment
- Service selection
- Golden ticket upgrade
- M-Pesa integration
- Queue polling/status checks
- Admin login and authentication
- Staff queue actions (serve, complete, cancel)
- Ticket history
- Reports

✅ No disruption to:
- TanStack Start routing
- Express fallback server
- Database schema
- M-Pesa callback handling
- Session management

## Priority Logic

**When "Serve Next" is clicked:**
1. Check for golden tickets with successful M-Pesa payment (`isGolden=true, mpesaStatus='success'`)
2. If found, call the oldest golden ticket (by queueNumber)
3. If no golden tickets, call the next regular ticket (by queueNumber)
4. Update status from 'waiting' to 'serving'
5. Notify student via Socket.IO or polling

## Testing Checklist

- [ ] Staff can click "Serve Next" button
- [ ] Next customer called correctly (golden first)
- [ ] Confirmation alert shows customer name and ticket
- [ ] Queue view refreshes after calling
- [ ] Student receives notification (Socket.IO or polls)
- [ ] Student sees fullscreen "ATTENTION!" alert
- [ ] Ticket details show in alert
- [ ] Counter location displayed
- [ ] Audio notification plays
- [ ] Text-to-speech works (if enabled)
- [ ] Multiple calls work without conflicts
- [ ] No impact on other admin functions (complete, cancel)
- [ ] Golden tickets prioritized correctly
- [ ] Works with M-Pesa golden tickets

## Dependencies

**New Dependencies Required (Optional):**
- `socket.io` - Server-side real-time transport (npm install socket.io)
- `socket.io-client` - Client-side real-time transport (npm install socket.io-client)

**Without these dependencies:** System works fine using polling fallback

## Production Notes

- Socket.IO requires persistent server connection
- Works in development (Node.js)
- Netlify Functions are stateless - for production, Socket.IO would need:
  - Separate persistent server (not Netlify Functions)
  - Redis/message broker for state management
  - Load balancer for multiple instances
  
**Current Setup:** Express fallback server (api-server.js) can be deployed to Render or similar platforms that support Socket.IO.

## Backward Compatibility

✅ All changes are backward compatible
✅ System works without Socket.IO (graceful fallback)
✅ Existing admin endpoints unchanged
✅ Database schema unchanged
✅ No breaking changes to API contracts
