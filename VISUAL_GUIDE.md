# Visual Setup Guide

## System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        JKUAT Queue System                               │
├────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────┐          ┌──────────────────────┐            │
│  │  React Frontend SPA  │          │   Express Backend    │            │
│  │  (Port 3001)         │          │   (Port 3000)        │            │
│  │                      │◄────────►│                      │            │
│  │ • Home Dashboard     │  HTTP    │ • /api/queue         │            │
│  │ • Login Page         │  JSON    │ • /api/admin/serve   │            │
│  │ • Admin Panel        │  +CORS   │ • /api/admin/report  │            │
│  │ • Queue Tracker      │          │ • Basic Auth         │            │
│  └──────────────────────┘          └──────────────────────┘            │
│                                            │                            │
│                                            │ SQL                        │
│                                            │                            │
│                                    ┌───────▼──────────┐                │
│                                    │  PostgreSQL      │                │
│                                    │  Database        │                │
│                                    │  (Port 5432)     │                │
│                                    │                  │                │
│                                    │ queue_entries    │                │
│                                    │ • registrar      │                │
│                                    │ • finance        │                │
│                                    │ • ict_helpdesk   │                │
│                                    └──────────────────┘                │
│                                                                          │
└────────────────────────────────────────────────────────────────────────┘
```

## Setup Flow

```
START: npm install
  │
  ├─► Copy .env.example to .env
  │   ├─► Edit DATABASE_URL
  │   └─► Example: postgresql://user:pass@localhost:5432/jkuat_queue
  │
  ├─► Create PostgreSQL Database
  │   └─► Command: createdb jkuat_queue
  │
  ├─► Start Backend
  │   └─► npm run dev:server (Port 3000)
  │   └─► Listen for API requests
  │   └─► Connect to PostgreSQL
  │
  ├─► Start Frontend  
  │   └─► npm run dev:client (Port 3001)
  │   └─► React app loads in browser
  │   └─► Ready for user interaction
  │
  └─► Ready to use!
```

## User Flow: Student Joins Queue

```
STUDENT VISITS http://localhost:3001
│
├─► Sees Home Dashboard
│   ├─ Queue Status for each service
│   ├─ Join Queue Form
│   └─ Queue Numbers
│
├─► Clicks "Join Queue"
│   ├─ Selects Service (Registrar/Finance/ICT)
│   ├─ Enters Phone Number
│   └─ Enters Student ID
│
├─► Frontend sends POST /api/queue
│   ├─ {name, studentId, serviceType}
│   └─ To: http://localhost:3000/api/queue
│
├─► Backend processes
│   ├─ Validates input
│   ├─ Generates queue number
│   ├─ Stores in PostgreSQL
│   └─ Returns entry with ID
│
├─► Frontend displays
│   ├─ Queue Number (e.g., 15)
│   ├─ Position in queue
│   ├─ Tracking Link
│   └─ "Track Your Queue" button
│
└─► Student can track via /track/{id}
    ├─ Polls every 5 seconds
    ├─ Shows position
    ├─ Browser notification when called
    └─ Alerts with sound
```

## Admin Flow: Manage Queue

```
ADMIN VISITS http://localhost:3001/login
│
├─► Enters Credentials
│   ├─ Username: Admin0375
│   └─ Password: group2sysdev
│
├─► Frontend sends Basic Auth
│   └─ Authorization: Basic <base64>
│
├─► Frontend shows Admin Panel
│   ├─ Service Selection Tabs
│   ├─ Current Queue Status
│   ├─ Next Person Info
│   └─ Action Buttons
│
├─► Admin clicks "Serve Next"
│   ├─ Frontend sends POST /api/admin/serve
│   ├─ {serviceType: "registrar", action: "serve_next"}
│   ├─ Backend validates auth
│   └─ Backend updates database (status: serving)
│
├─► Admin clicks "Complete"
│   ├─ Frontend sends POST /api/admin/serve
│   ├─ {action: "complete", entryId: 5}
│   ├─ Backend marks as served
│   └─ Sets timestamp
│
├─► Admin clicks "Cancel"
│   ├─ Frontend sends POST /api/admin/serve
│   ├─ {action: "cancel", entryId: 5}
│   └─ Backend marks as cancelled
│
└─► Admin views "Report"
    ├─ Frontend sends GET /api/admin/report
    ├─ Backend returns all served entries
    └─ Shows performance metrics
```

## API Request Flow

```
FRONTEND REQUEST:
┌─────────────────────────────────────────────────────────┐
│ fetch('http://localhost:3000/api/queue', {              │
│   method: 'POST',                                        │
│   headers: { 'Content-Type': 'application/json' },      │
│   body: JSON.stringify({                                │
│     name: "0712345678",                                 │
│     studentId: "STU123",                                │
│     serviceType: "registrar"                            │
│   })                                                     │
│ })                                                       │
└─────────────────────────────────────────────────────────┘
                         │
                         │ CORS Check ✓
                         │ JSON Parse ✓
                         ▼
┌─────────────────────────────────────────────────────────┐
│ BACKEND EXPRESS SERVER                                  │
│ ┌───────────────────────────────────────────────────┐  │
│ │ app.post('/api/queue', (req, res) => {            │  │
│ │   // 1. Validate input                            │  │
│ │   // 2. Check service_type is valid               │  │
│ │   // 3. Generate queue_number                     │  │
│ │   // 4. Insert into PostgreSQL                    │  │
│ │   // 5. Return created entry                      │  │
│ │ })                                                │  │
│ └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         │
                         │ Database Query
                         ▼
┌─────────────────────────────────────────────────────────┐
│ POSTGRESQL DATABASE                                     │
│ ┌───────────────────────────────────────────────────┐  │
│ │ INSERT INTO queue_entries (                       │  │
│ │   name, student_id, service_type, queue_number,  │  │
│ │   status, created_at                             │  │
│ │ ) VALUES (...)                                    │  │
│ │ RETURNING *;                                      │  │
│ └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         │
                         │ Row inserted
                         │ Returns: {id, ...all fields...}
                         ▼
┌─────────────────────────────────────────────────────────┐
│ BACKEND RESPONSE                                        │
│ ┌───────────────────────────────────────────────────┐  │
│ │ {                                                 │  │
│ │   "id": 5,                                        │  │
│ │   "name": "0712345678",                           │  │
│ │   "studentId": "STU123",                          │  │
│ │   "serviceType": "registrar",                     │  │
│ │   "queueNumber": 15,                             │  │
│ │   "status": "waiting",                           │  │
│ │   "createdAt": "2025-05-20T11:45:00.000Z",       │  │
│ │   "servedAt": null                               │  │
│ │ }                                                 │  │
│ └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│ FRONTEND RECEIVES                                       │
│ ┌───────────────────────────────────────────────────┐  │
│ │ .then(response => response.json())                │  │
│ │ .then(data => {                                   │  │
│ │   // Display queue number 15                      │  │
│ │   // Show "Queue position: 3"                     │  │
│ │   // Redirect to /track/5                         │  │
│ │ })                                                │  │
│ └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Database Diagram

```
queue_entries Table:
┌────────────────────────────────────────────────────────┐
│ PRIMARY KEY                                            │
│ id (SERIAL)                                            │
├────────────────────────────────────────────────────────┤
│ name (TEXT)           - Phone number "0712345678"      │
│ student_id (TEXT)     - Student ID "STU001"            │
│ service_type (ENUM)   - 'registrar', 'finance', etc   │
│ queue_number (INT)    - Unique per service (1, 2, 3...) │
│ status (ENUM)         - 'waiting', 'serving', 'served'│
│ created_at (TIMESTAMP) - When joined (auto: now())    │
│ served_at (TIMESTAMP) - When served (null initially)  │
└────────────────────────────────────────────────────────┘

Sample Data:
┌────┬──────────────┬─────────┬──────────────┬──────┬────────┬──────────────────────┐
│ id │ name         │ stud_id │ service_type │ q_no │ status │ created_at           │
├────┼──────────────┼─────────┼──────────────┼──────┼────────┼──────────────────────┤
│ 1  │ 0712345678   │ STU001  │ registrar    │ 10   │ served │ 2025-05-20 10:00:00 │
│ 2  │ 0723456789   │ STU002  │ registrar    │ 11   │ served │ 2025-05-20 10:05:00 │
│ 3  │ 0734567890   │ STU003  │ finance      │ 5    │ served │ 2025-05-20 10:10:00 │
│ 4  │ 0745678901   │ STU004  │ registrar    │ 12   │ serving│ 2025-05-20 10:20:00 │
│ 5  │ 0756789012   │ STU005  │ registrar    │ 13   │ waiting│ 2025-05-20 10:25:00 │
└────┴──────────────┴─────────┴──────────────┴──────┴────────┴──────────────────────┘
```

## File Organization

```
jkuat-queue-online/
│
├─ 📄 INDEX.md (You are here - Navigation guide)
├─ 📄 QUICKSTART.md (Quick 5-min setup)
├─ 📄 SETUP.md (Detailed instructions)
├─ 📄 API_TESTING.md (Test endpoints)
├─ 📄 DEPLOYMENT.md (Production setup)
├─ 📄 TROUBLESHOOTING.md (Fix issues)
├─ 📄 BACKEND_SETUP_COMPLETE.md (Summary)
│
├─ 📝 api-server.js (Backend Express server)
├─ 📝 package.json (Dependencies)
├─ 📝 .env (Environment variables - CREATE THIS)
├─ 📝 .env.example (Environment template)
├─ 📝 vite.config.ts (Frontend build)
├─ 📝 index.html (HTML entry point)
│
├─ 📁 src/ (Frontend React code)
│  ├─ main.tsx (Entry point)
│  ├─ router.tsx (Routes)
│  ├─ styles.css (Global styles)
│  └─ routes/
│     ├─ __root.tsx
│     ├─ index.tsx (Home)
│     ├─ admin.tsx (Admin)
│     ├─ login.tsx (Login)
│     └─ track.$id.tsx (Tracker)
│
├─ 📁 db/ (Database)
│  ├─ index.ts (Drizzle client)
│  └─ schema.ts (Schema definition)
│
└─ 📁 node_modules/ (Dependencies - created after npm install)
```

## Command Quick Reference

```
┌─────────────────────────────────────────────────────────────┐
│ SETUP COMMANDS                                              │
├─────────────────────────────────────────────────────────────┤
│ npm install              Install all dependencies            │
│ cp .env.example .env     Create .env file                   │
│ createdb jkuat_queue     Create PostgreSQL database         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ DEVELOPMENT COMMANDS                                        │
├─────────────────────────────────────────────────────────────┤
│ npm run dev              Start both frontend & backend       │
│ npm run dev:client       Start frontend only (port 3001)    │
│ npm run dev:server       Start backend only (port 3000)     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ PRODUCTION COMMANDS                                         │
├─────────────────────────────────────────────────────────────┤
│ npm run build            Build frontend (creates dist/)     │
│ npm run server           Run backend (production mode)       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ VERIFICATION                                                │
├─────────────────────────────────────────────────────────────┤
│ node verify-setup.js     Check setup is complete            │
└─────────────────────────────────────────────────────────────┘
```

## Port Mapping

```
┌──────────────────┬──────────────┬──────────────────────────┐
│ Service          │ Port         │ URL                      │
├──────────────────┼──────────────┼──────────────────────────┤
│ Frontend (React) │ 3001         │ http://localhost:3001    │
│ Backend (API)    │ 3000         │ http://localhost:3000    │
│ PostgreSQL DB    │ 5432         │ localhost:5432           │
└──────────────────┴──────────────┴──────────────────────────┘
```

## Status Indicators

```
✅ Setup Complete
├─ Frontend ready
├─ Backend running
├─ Database connected
└─ API responding

⚠️  Setup Incomplete
├─ Missing .env file
├─ DATABASE_URL not set
├─ Database not created
└─ Dependencies not installed

❌ Setup Failed
├─ PostgreSQL not running
├─ Port already in use
├─ Invalid DATABASE_URL
└─ Missing permissions
```

## Next Steps Visual

```
You are here:
     │
     ▼
┌─────────────────────┐
│  Read INDEX.md      │ ◄─── You've already done this!
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│  Read QUICKSTART.md │ ◄─── Next: Follow quick setup
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│  npm install        │ ◄─── Install dependencies
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│  Setup .env         │ ◄─── Configure DATABASE_URL
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│  Create database    │ ◄─── createdb jkuat_queue
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│  npm run dev        │ ◄─── Start everything!
└─────────────────────┘
     │
     ▼
┌─────────────────────┐
│  http://localhost   │ ◄─── Open in browser
│  :3001              │
└─────────────────────┘
     │
     ▼
   🎉 DONE!
```

---

This visual guide provides a quick overview. For details, see the specific documentation files in this directory.

**Recommended Reading Order:**
1. INDEX.md (overview - you're reading it!)
2. QUICKSTART.md (5-minute setup)
3. SETUP.md (detailed instructions)
4. API_TESTING.md (test endpoints)
5. TROUBLESHOOTING.md (when stuck)
6. DEPLOYMENT.md (when ready for production)
