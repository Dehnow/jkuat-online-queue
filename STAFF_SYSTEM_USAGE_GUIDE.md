# Staff Management System - Quick Start & Usage Guide

## 🎯 Overview
The new Staff Management System enables offices to have independent staff accounts with real-time queue management, office-level operations control, and integrated feedback/messaging with administrators.

## 🔐 Login & Authentication

### For Admins
1. Navigate to login page
2. Click **"Admin"** button
3. Enter credentials:
   - Username: `Admin0375`
   - Password: `group2sysdev`
4. Access admin dashboard with all system controls

### For Staff Members
1. Navigate to login page
2. Click **"Staff"** button
3. **Select Your Office** from the list
   - Shows all operational offices
   - Displays office status (Open/Closed)
   - Service type indicator
4. Enter office login credentials
5. Access Staff Dashboard

### For Students
- Same as before: Click "Student" and enter any credentials
- Or check queue status without logging in

---

## 📊 Staff Dashboard Features

### 1. **Today's Queue Widget**
The mini dashboard shows:
- **Total Waiting**: Number of customers in queue
- **Now Serving**: Current ticket number and customer name
- **Served Today**: Completed transactions count
- **Cancelled**: Cancelled tickets count

#### Miniature Queue View
- Displays compact visual representation of queue
- Green box = currently serving
- Blue boxes = waiting (numbered 1-10+)
- Shows "N more" if queue exceeds 10 people
- Click **"Show Full View"** for expanded overlay

#### Full Queue View
- Click "Show Full View" to expand to full-screen
- Blur background for focus
- See complete waiting list with details
- View served and cancelled entries
- See timestamps for each entry

### 2. **Queue Control Buttons**
Located above the queue widget with four dominant action buttons:

#### 🔔 CALL NEXT
- **Function**: Notifies the next waiting customer
- **Action**: Moves next person from waiting to serving status
- **Effect**: Updates student's live dashboard automatically
- **Availability**: Only enabled when people are waiting

#### ▶️ START SERVICE
- **Function**: Marks the start of service for current customer
- **Action**: Confirms service has begun
- **Effect**: Tracks service start time
- **Availability**: Only enabled when someone is being served

#### ⏹️ END SERVICE  
- **Function**: Completes service for current customer
- **Action**: Marks entry as served and records completion time
- **Effect**: Clears serving slot for next customer
- **Availability**: Only enabled when service is in progress

#### ✗ CANCEL TICKET
- **Function**: Cancels ticket without service
- **Action**: Removes customer from queue as cancelled
- **Effect**: Cannot be undone; ticket cannot be reused
- **Availability**: Only enabled during active service

### 3. **Office Status Toggle**
Located in top right of header:
- **Current Status**: Shows OPEN (green) or CLOSED (red)
- **Function**: Toggle office availability
- **Effect**: Affects whether new students can join this office's queue
- **Behavior**: Instantly updates across entire system

### 4. **Feedback Button**
Located in top right of header:
- Click to send messages to administrators
- Request features or office privileges
- Types of messages:
  - General feedback
  - Feature requests
  - Privilege requests (e.g., "I want to create a new office")

#### Sending Feedback
1. Click **"Feedback"** button
2. Type your message
3. Click **"Send"**
4. Admin will respond through the messaging system
5. Notifications appear in dashboard

---

## 🏢 Admin Dashboard - New Features

### Tab Navigation
Admin dashboard now has 4 tabs:

#### 1. **Queue Management** (Original)
- Manage queues across all services
- View real-time status
- Serve customers per service

#### 2. **Service Report** (Original)
- View served entries
- Today's service log
- Performance charts

#### 3. **🏢 Offices** (NEW)
Click this tab to access office management system.

##### Creating a New Office
1. Click **"Add New Office"** button
2. **Step 1 - Office Name**
   - Enter office name (e.g., "East Campus Registrar")
3. **Step 2 - Service Station**
   - Choose service type:
     - Registrar's Office
     - Finance Office
     - ICT Helpdesk
4. **Step 3 - Login Credentials**
   - Set username for office login
   - Set password (will be shared with staff)
   - Confirm password
5. **Step 4 - Review & Deploy**
   - Review all information
   - **Important**: Take note of credentials
   - Click **"Deploy Office"**
   - Office becomes available immediately

##### Managing Existing Offices
- **View All**: All active offices displayed as cards
- **Edit**: Click "Edit" button to modify settings
- **Delete**: Click "Delete" to remove office
- **Status Indicator**: Shows OPEN or CLOSED
- **Credentials**: View office username

##### Removing an Office
1. Find office in list
2. Click **"Delete"** button
3. Confirm in dialog box
4. Office removed from system

#### 4. **💬 Feedback** (NEW)
Click this tab to manage staff messages and requests.

##### Viewing Messages
**Pending Messages Section**
- Shows all unresponded messages from staff
- Displays:
  - Office name
  - Staff member username
  - Message type (Feedback, Request, etc.)
  - Timestamp
  - Message content

**Responded Messages Section**
- Shows all processed messages
- Color-coded:
  - Green = Approved
  - Red = Rejected
- Shows response from admin

##### Responding to Messages
1. Find pending message
2. Click **"Respond"** button
3. In modal:
   - Read original message
   - Type your response
   - Choose decision:
     - **Approve** (green) - Accept request/feedback
     - **Reject** (red) - Decline request
4. Click **"Send Response"**
5. Staff member receives notification

---

## 🎯 Common Workflows

### Workflow 1: Setting Up a New Office
**Timeline**: ~5 minutes

1. **Admin**:
   - Log into admin dashboard
   - Click "Offices" tab
   - Click "Add New Office"
   - Complete 4-step wizard
   - Share credentials with office staff

2. **Staff**:
   - At login page, click "Staff"
   - Select new office from list
   - Enter provided credentials
   - Access dashboard

3. **Result**: New office operational and ready to manage queues

### Workflow 2: Serving Customers

1. **Staff Dashboard Open**
   - Monitor queue visualization
   - See waiting customers

2. **When ready to serve**:
   - Click **CALL NEXT** → Next person moves to serving
   - Student receives notification to proceed to counter

3. **Service in progress**:
   - Click **START SERVICE** → Records start time
   - Process customer

4. **Service complete**:
   - Click **END SERVICE** → Marks served, records time
   - Automatically prepares for next customer

5. **If customer doesn't show**:
   - Click **CANCEL TICKET** → Removes from queue permanently

### Workflow 3: Staff Requests Admin Privilege

1. **Staff**:
   - Click **"Feedback"** button
   - Type message: "I would like permission to create a new office"
   - Click **"Send"**

2. **Admin**:
   - Opens admin dashboard
   - Click **"Feedback"** tab
   - Finds message from staff
   - Reviews request
   - Clicks **"Respond"**
   - Types approval message
   - Clicks **"Approve"** (green button)
   - Clicks **"Send Response"**

3. **Staff**:
   - Receives notification of approval
   - Can now request to create office through proper channels

---

## 📱 Queue Widget Details

### Compact View
- **Visual**: Row of colored boxes
- **Colors**: 
  - Green box with "S" = Currently serving
  - Blue boxes numbered = Waiting in order
- **Space Efficiency**: Shows only first 10 + counter for more
- **Interaction**: Click "Show Full View" to expand

### Full View (Overlay)
- **Background**: Blurred with semi-transparent overlay
- **Layout**: Large expandable window
- **Sections**:
  1. Waiting list with full names and times
  2. Served section (faded with X)
  3. Cancelled section (if any)
- **Interaction**: Click X or outside to close

---

## 🔔 Notifications

### Types of Notifications
1. **Queue Notifications** (Student receives)
   - "Your number is being served"
   - Browser notification + sound

2. **Admin Notifications** (If implemented)
   - New office created
   - Staff requests approval

3. **Staff Notifications** (If implemented)
   - Admin response received
   - Request approved/rejected

---

## ⚙️ Office Settings

### Office Status (Open/Closed)
- **OPEN**: Students can join queue
- **CLOSED**: New students cannot join, existing stay

### When to Close Office
- End of day operations
- Lunch breaks
- Emergency/maintenance
- Holiday/special events

### Toggle Status
- One-click toggle in top right
- Instant system-wide update
- No confirmation needed

---

## 🛡️ Security Tips

### Credentials
- **Admin**: Keep credentials secure and confidential
- **Office**: Share office credentials only with authorized staff
- **Staff**: Each staff member should have individual account
- **Never**: Share credentials via email or text

### Best Practices
- Change default passwords immediately
- Use strong passwords (mix upper/lower/numbers/symbols)
- Log out when leaving dashboard
- Don't share login screens with others

---

## ❓ Troubleshooting

### Issue: Office not appearing in list
**Solution**: Refresh page or check if office was actually deployed

### Issue: Can't log in as staff
**Solution**: Verify:
1. Correct office is selected
2. Credentials are correct
3. Office status is OPEN
4. Password is exact (case-sensitive)

### Issue: Queue buttons disabled
**Solution**:
- CALL NEXT: Ensure people are waiting
- START SERVICE: Ensure someone is being called
- END/CANCEL: Ensure service is active

### Issue: Feedback not sending
**Solution**: 
1. Check message is not empty
2. Verify internet connection
3. Try refreshing page

---

## 📞 Support

For technical issues:
1. Check this guide first
2. Contact IT support
3. Provide: Error message, steps to reproduce, screenshot

---

## 🚀 Getting Started

1. **First Admin**: Log in with default credentials
2. **Create Office**: Add first office through wizard
3. **Share Credentials**: Provide office login to staff
4. **Staff Login**: Staff uses office credentials to access dashboard
5. **Begin Operations**: Start managing queues in real-time!

---

**System Ready to Use! 🎉**
