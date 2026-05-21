# JKUAT Queue System - Live Testing Checklist

## Environment Setup
- [ ] Node.js installed and running
- [ ] npm dependencies installed (`npm install`)
- [ ] DATABASE_URL environment variable configured
- [ ] Backend API server running on port 3000
- [ ] Frontend dev server running on port 3001

## Admin Login Flow
- [ ] Staff/Admin role selection appears
- [ ] Username/Password inputs visible for staff
- [ ] Credentials: `Admin0375` / `group2sysdev` work
- [ ] After login, redirects to `/admin`
- [ ] Session token stored in sessionStorage as `adminAuth`

## Admin Dashboard - Icons
- [ ] Building2 icon renders for Registrar's Office
- [ ] Banknote icon renders for Finance Office
- [ ] Headphones icon renders for ICT Helpdesk
- [ ] All service cards are clickable and highlight on selection

## Admin Dashboard - Ticket Management
- [ ] "Currently Serving" card displays active ticket
- [ ] Queue numbers display correctly
- [ ] "Serve Next" button works and advances queue
- [ ] Waiting queue list updates in real-time
- [ ] Wait time calculation is accurate

## Admin Dashboard - Reports
- [ ] Report tab shows all served entries
- [ ] Chart displays hourly served statistics
- [ ] All served tickets listed with details
- [ ] Data refreshes every 8 seconds

## Ticket Execution
- [ ] Serve Next: Marks current as served, gets next from queue
- [ ] Complete: Marks ticket as served with timestamp
- [ ] Cancel: Marks ticket as cancelled
- [ ] All actions require proper Basic Auth

## Data Persistence
- [ ] Database connection established on startup
- [ ] Queue entries persist across page reloads
- [ ] Served timestamps update correctly
- [ ] Status changes reflect immediately

## Error Handling
- [ ] Database connection failures display appropriate errors
- [ ] Authentication failures show error message
- [ ] Network errors are handled gracefully
- [ ] Invalid requests return proper HTTP status codes

## Performance
- [ ] Page loads in under 3 seconds
- [ ] Icon rendering is smooth
- [ ] No console errors on load
- [ ] Polling updates don't cause lag
