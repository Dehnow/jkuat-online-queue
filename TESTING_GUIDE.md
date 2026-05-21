# Quick Start - Testing the Integrated Features

## 🚀 Start Development Server

```bash
# From project root directory
npm install   # (if needed)
npm run dev
```

The app will start at `http://localhost:3001`

---

## 🧪 Test Scenarios

### Test 1: Login Page - Live Queue Modal ✅
1. Navigate to `http://localhost:3001/login`
2. Click the **"🔍 Check Queue Status"** button (below the login form divider)
3. **Expected:**
   - Modal appears showing all 3 services
   - Shows "Registrar's Office", "Finance Office", "ICT Helpdesk"
   - Each displays:
     - Number of people waiting
     - Current serving queue number
     - Estimated wait time
     - Progress bar
   - Status automatically updates every 10 seconds
   - "Live" indicator shows active polling

---

### Test 2: Student Dashboard - Join Queue ✅
1. On login page, enter any credentials:
   - Username: `S12345` (or any student ID)
   - Password: `password123` (any password)
   - Click "Login as Student"
2. **Expected:**
   - Redirected to student dashboard
   - Three-column responsive layout appears
   - Left column: "Get Ticket" form
   - Center/Right: "Live Queue Status" with 3 service cards

---

### Test 3: Get a Queue Ticket ✅
1. In the **"Get Ticket"** form:
   - Phone: `+254712345678`
   - Student ID: `S12345`
   - Service: Select one (e.g., "Registrar's Office")
   - Click "Get Queue Number →"
2. **Expected:**
   - Cinematic ticket modal appears with:
     - Large queue number (e.g., #42)
     - TICKET ISSUED header
     - Service office name
     - Reference number (e.g., JK170225-123)
     - Time issued and date
     - Important notice
   - "Print Ticket" and "Close" buttons available

---

### Test 4: Print Ticket ✅
1. In the ticket modal, click **"Print Ticket"** button
2. **Expected:**
   - Print dialog opens in new window
   - Shows JKUAT logo, queue number, service, reference

---

### Test 5: Ticket History ✅
1. Create 2-3 more tickets (use different phone/service combos)
2. Close the ticket modal
3. **Expected:**
   - "Your Tickets" card appears below Live Queue Status
   - Shows all created tickets in reverse order (newest first)
   - Each shows:
     - Queue number
     - Service name
     - Reference number
     - Date/time created
   - Print button for each ticket

---

### Test 6: Live Queue Updates ✅
1. Keep dashboard open
2. Watch the Live Queue Status cards
3. **Expected:**
   - Wait counts update every 8 seconds
   - "Now Serving" numbers change
   - Progress bars animate
   - No flickering (smooth updates)

---

### Test 7: Admin Dashboard - Office Selection ✅
1. Navigate to `http://localhost:3001/login`
2. Click "Staff/Admin" role button
3. Login with:
   - Username: `Admin0375`
   - Password: `group2sysdev`
4. **Expected:**
   - Redirected to Admin Control Panel
   - Three summary cards visible (Registrar, Finance, ICT)
   - One card is highlighted by default (green ring)

---

### Test 8: Click Office Cards ✅
1. In Admin panel, click each summary card:
   - Click Finance card
   - Click ICT card
   - Click Registrar card
2. **Expected:**
   - Card highlights with colored ring (green/amber/blue)
   - "Currently Serving" title updates with office name
   - Waiting queue table updates with new data
   - Data refreshes with office-specific information
   - Visual feedback (hover shadow, smooth transitions)

---

### Test 9: Real-time Admin Updates ✅
1. Keep admin panel open
2. Create new tickets from student dashboard (open in another tab)
3. Watch the admin queue update
4. **Expected:**
   - Waiting count increases for selected office
   - Updates happen every 8 seconds
   - Data is filtered by selected office only

---

### Test 10: Responsive Design ✅
1. Resize browser window (test mobile/tablet/desktop sizes)
2. Use DevTools device emulation:
   - iPhone SE (375px)
   - iPad (768px)
   - MacBook (1440px)
3. **Expected:**
   - Layout adapts smoothly
   - Cards stack on mobile
   - All text readable
   - Buttons properly sized
   - No horizontal scroll

---

## 📋 Features Checklist

### Login Page
- [ ] Live Queue Modal appears on button click
- [ ] Shows 3 service cards
- [ ] Waiting counts visible
- [ ] Auto-refreshes every 10 seconds
- [ ] Modal closes properly

### Student Dashboard
- [ ] Form validation works
- [ ] Ticket modal appears after submission
- [ ] Cinematic design with perforated edge
- [ ] Queue number displayed in color
- [ ] Reference number visible
- [ ] Print button works
- [ ] Ticket history persists
- [ ] "How to Queue" section visible
- [ ] "About System" section visible
- [ ] Feature bar shows 4 items
- [ ] Security notice visible (green pill)
- [ ] Live queue cards update every 8 seconds

### Admin Dashboard
- [ ] Login with admin credentials works
- [ ] Summary cards clickable
- [ ] Visual feedback on selection (ring + color)
- [ ] Office changes update displayed data
- [ ] "Currently Serving" updates
- [ ] Waiting queue filters correctly
- [ ] Data updates in real-time

---

## 🐛 Debugging Tips

### Check Console (F12)
- No TypeScript errors
- No warning messages
- Network tab shows `/api/queue` calls

### Check Local Storage (DevTools → Application)
- `deviceTickets` - array of active ticket IDs
- `ticketHistory_{studentId}` - ticket history for student

### Check Session Storage
- `studentId` - current student ID
- `adminAuth` - admin credentials (Base64)
- `userRole` - "student" or "staff"

---

## 🎯 Expected API Responses

### GET /api/queue?service=registrar
```json
{
  "waitingCount": 5,
  "serving": {
    "id": 42,
    "queueNumber": 42,
    "serviceType": "registrar",
    "status": "serving"
  }
}
```

### POST /api/queue
```json
{
  "id": 123,
  "queueNumber": 43,
  "serviceType": "registrar",
  "status": "waiting",
  "createdAt": "2025-02-17T10:30:00Z"
}
```

---

## ⚠️ Known Limitations

1. **Mock Data**: Waiting lists are generated client-side for demo
2. **Ticket Limits**: 3 tickets per device per day (localStorage-based)
3. **Print**: Opens in new window (browser may block popups)
4. **Real-time**: Polling-based, not WebSocket (refreshes every 8-10 seconds)

---

## ✅ Success Indicators

You'll know everything is working correctly when:
1. ✅ All pages load without console errors
2. ✅ Live queue modal shows data from API
3. ✅ Tickets can be created and displayed
4. ✅ Cinematic ticket modal looks beautiful
5. ✅ Admin office selection filters data
6. ✅ All updates happen in real-time
7. ✅ Responsive design works on all sizes
8. ✅ Print functionality opens correctly
9. ✅ Ticket history persists on reload
10. ✅ No lag or UI freezing

---

## 🚀 Next Steps

1. **Local Testing**: Follow all test scenarios above
2. **API Verification**: Ensure backend is running on port 3000
3. **Build for Production**: `npm run build`
4. **Deploy to Render**: Push to GitHub and connect to Render
5. **Monitor**: Check production errors in Render dashboard

---

**Ready to test? Start the dev server and follow the test scenarios above!**
