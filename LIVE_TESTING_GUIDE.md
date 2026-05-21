# JKUAT Queue System - Live Testing Guide

## System Architecture Overview
- **Frontend**: React with TanStack Router (Vite)
- **Backend**: Express.js API server
- **Database**: PostgreSQL with Drizzle ORM
- **Icons**: lucide-react library
- **Deployment**: Single Express server + built React SPA

## Pre-Launch Checklist

### 1. Environment Variables ✓
Ensure these are set in your deployment environment:
```bash
DATABASE_URL=postgresql://user:password@host:port/dbname
NODE_ENV=production
PORT=3000  # or your preferred port
```

### 2. Dependencies ✓
All required packages are in package.json:
- react 18.3.1
- @tanstack/react-router 1.70.0
- @tanstack/react-query 5.40.0
- lucide-react 0.576.0
- express 4.18.2
- drizzle-orm 0.45.2
- postgres 3.4.3

## Testing Procedures

### Test 1: Icon Rendering
**Location**: Admin Dashboard (`/admin`)
**Icons to Verify**:
- ✓ Building2 - Registrar's Office (green)
- ✓ Banknote - Finance Office (amber)
- ✓ Headphones - ICT Helpdesk (blue)

**Expected**: All icons render without errors
**If fails**: Check lucide-react version compatibility

### Test 2: Admin Login Flow
**Location**: Login Page (`/login` or `/`)
**Steps**:
1. Click "Staff/Admin" button
2. Enter Username: `Admin0375`
3. Enter Password: `group2sysdev`
4. Click "Login as Staff"

**Expected Results**:
- ✓ No error message
- ✓ Redirected to `/admin`
- ✓ Admin dashboard loads with service cards
- ✓ sessionStorage contains `adminAuth` token

**If fails**:
- Check DATABASE_URL is set
- Verify API server is running
- Check CORS settings in api-server.js
- Look for "Unauthorized" errors in console

### Test 3: Ticket Serve Functionality
**Location**: Admin Dashboard (`/admin`)
**Steps**:
1. Ensure you're logged in as admin
2. Select a service office (Registrar, Finance, or ICT)
3. Create a test queue entry via student dashboard
4. Click "▶ Serve Next" button
5. Verify queue advances

**Expected Results**:
- ✓ Button shows loading state ("...")
- ✓ Currently serving ticket updates
- ✓ Waiting list decrements
- ✓ Chart data updates

**If fails**:
- Check /api/admin/serve endpoint is responding
- Verify Basic Auth header is correctly formatted
- Check database has queue entries

### Test 4: Admin Reports
**Location**: Admin Dashboard - Report Tab (`/admin`)
**Steps**:
1. Ensure you're logged in
2. Click "Service Report" tab
3. Verify served entries display

**Expected Results**:
- ✓ Table shows all served entries
- ✓ Reference numbers display correctly
- ✓ Served timestamps are accurate
- ✓ Chart shows hourly served statistics

**If fails**:
- Check /api/admin/report endpoint
- Verify authentication is being passed
- Check database has served entries

### Test 5: Student Ticket Creation
**Location**: Student Dashboard (`/dashboard`)
**Steps**:
1. Login as student with any credentials
2. Enter Name, Student ID, Select Service
3. Click "Join Queue"
4. Verify ticket is created

**Expected Results**:
- ✓ Ticket confirmation modal appears
- ✓ Queue number is assigned
- ✓ Reference number displays
- ✓ Can track ticket position
- ✓ Active ticket count updates

**If fails**:
- Check /api/queue POST endpoint
- Verify database has queue_entries table
- Check student limit validation (max 3 active)

### Test 6: Real-time Queue Tracking
**Location**: Queue Tracker (`/track/:id`)
**Steps**:
1. Create a student ticket (copy the ID)
2. Navigate to `/track/{ticket-id}`
3. Observe real-time updates

**Expected Results**:
- ✓ Queue number displays
- ✓ Position in queue updates
- ✓ Notification triggers when serving
- ✓ Polls every 5 seconds

**If fails**:
- Check /api/queue/:id endpoint
- Verify polling interval (5 seconds)
- Check browser notification permissions

## Troubleshooting

### Issue: "Unauthorized" on Admin Login
```
Solution: 
1. Verify credentials: Admin0375 / group2sysdev
2. Check api-server.js has checkAuth middleware
3. Verify DATABASE_URL is set
4. Check CORS settings allow login origins
```

### Issue: Icons Not Rendering
```
Solution:
1. Verify lucide-react is installed: npm ls lucide-react
2. Check import statements are correct
3. Verify CSS is loading (Tailwind classes working)
4. Check browser console for import errors
```

### Issue: Serve Next Button Not Working
```
Solution:
1. Verify admin is authenticated (check sessionStorage.adminAuth)
2. Test endpoint directly: curl -X POST http://localhost:3000/api/admin/serve \\
   -H "Authorization: Basic $(echo -n Admin0375:group2sysdev | base64)" \\
   -H "Content-Type: application/json" \\
   -d '{"serviceType":"registrar","action":"serve_next"}'
3. Check database connection
4. Look for errors in api-server.js logs
```

### Issue: Reports Not Showing Data
```
Solution:
1. Verify /api/admin/report returns data
2. Check admin is authenticated
3. Verify database has served entries
4. Check query in api-server.js: GET /api/admin/report
```

## Performance Monitoring

### Key Metrics to Monitor:
- **Page Load Time**: < 3 seconds
- **API Response Time**: < 1 second
- **Data Refresh Rate**: 8 seconds (admin), 5 seconds (tracker)
- **Database Query Time**: < 500ms

### Logging Points (Already in Code):
```javascript
// Backend logging
console.log('🚀 Queue entry created:', newEntry[0])
console.log('✅ Serving next ticket:', updated[0])
console.log('❌ Error creating queue entry:', error.message)

// Check logs for these emojis to monitor health
```

## Security Checklist

- ✓ Basic Auth credentials not exposed in code
- ✓ CORS properly configured
- ✓ Database URL not in code (use env vars)
- ✓ Authentication required for admin endpoints
- ✓ Input validation on form submissions
- ✓ Database connection pooling enabled (max: 10)

## Deployment Verification

After deploying to production:

1. **Check API Health**:
   ```bash
   curl https://your-domain/api/health
   ```
   Expected: `{"status":"ok","databaseConnected":true}`

2. **Verify Icons Load**:
   - Open `/admin` in browser
   - Check for missing images in DevTools
   - Verify no 404 errors for static assets

3. **Test Admin Login**:
   - Try login with correct credentials
   - Try login with incorrect credentials
   - Verify proper error messages

4. **Monitor Logs**:
   ```bash
   # Check for any ❌ or ⚠️ messages
   # Monitor database connection status
   ```

## Quick Restart Procedure

If something goes wrong:

1. **Development**:
   ```bash
   npm run dev          # Starts both backend and frontend
   # or separately:
   npm run dev:server   # Terminal 1
   npm run dev:client   # Terminal 2
   ```

2. **Production**:
   ```bash
   npm run build        # Build React SPA
   npm run server       # Start Express server (serves dist)
   ```

3. **Check Status**:
   ```bash
   curl http://localhost:3000/api/health
   curl http://localhost:3000/health
   ```
