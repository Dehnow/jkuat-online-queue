# JKUAT Queue System - Architecture Documentation

**Last Updated:** May 21, 2026  
**Status:** Production Ready

---

## 🏗 System Architecture

### Current Production Stack

```
┌─────────────────────────────────────────────────────────────┐
│                     RENDER DEPLOYMENT (Port 3000)           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         Express Server (api-server.js)              │    │
│  │  • Serves React SPA from dist/ folder               │    │
│  │  • Routes all /api/* requests                       │    │
│  │  • Connects to PostgreSQL database                  │    │
│  │  • Implements Basic Auth for admin endpoints        │    │
│  └─────────────────────────────────────────────────────┘    │
│                          ↑         ↑                          │
│          Static Files    │         │  API Requests            │
│          (HTML, CSS, JS) │         │                          │
│                          │         │                          │
│  ┌──────────────────┐    │    ┌────────────────────┐         │
│  │ React SPA (dist) │←───┘    │ API Routes Handler │         │
│  │  • React Router  │         │  • Queue ops       │         │
│  │  • TanStack Query│         │  • Admin ops       │         │
│  │  • UI Components │         │  • Notifications   │         │
│  └──────────────────┘         └────────────────────┘         │
│                                        ↓                      │
│                              ┌──────────────────┐             │
│                              │ PostgreSQL DB    │             │
│                              │ • queue_entries  │             │
│                              │ • Status tracking│             │
│                              └──────────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

### Development Stack

During `npm run dev`:

```
Frontend Server (Vite, Port 3001)
  ↓ (proxies /api calls to)
  ↓
Backend Server (Express, Port 3000)
  ↓
PostgreSQL Database
```

The proxy is configured in `vite.config.ts`:
```javascript
proxy: {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
    secure: false,
  },
}
```

### Production Stack

In production (Render):

```
Express Server (Port 3000)
  • Serves static files (dist/)
  • Handles /api/* routes directly
  • No need for proxy (everything on same server)
```

---

## 📁 Project Structure

### Files Actually Used in Production

```
api-server.js                          ← MAIN: All API routes & DB setup
dist/                                  ← Built React SPA
  ├── index.html
  ├── assets/
  │   ├── index-*.js                  (Main React bundle)
  │   ├── tanstack-*.js               (Router + Query)
  │   ├── charts-*.js                 (Recharts)
  │   ├── react-vendor-*.js           (React)
  │   └── index-*.css                 (Tailwind CSS)
  └── [images, favicon, etc]

src/
  ├── routes/
  │   ├── __root.tsx                  ← Root layout
  │   ├── index.tsx                   ← Student dashboard
  │   ├── admin.tsx                   ← Admin portal
  │   ├── login.tsx                   ← Login page
  │   ├── track.$id.tsx               ← Queue tracker page
  │   └── api/                        ← ⚠️ NOT USED (see below)
  ├── main.tsx                        ← React entry point
  ├── router.tsx                      ← React Router config
  └── styles.css                      ← Tailwind CSS

vite.config.ts                         ← Build configuration
tsconfig.json                          ← TypeScript configuration
package.json                           ← Dependencies & scripts
```

### Files NOT Used in Production (Reference Only)

These files exist from an abandoned TanStack Start migration:

```
db/index.ts                            ⚠️ DEPRECATED
├── Contains: TypeScript database client
├── Status: Not imported in production
├── Note: Kept for reference only

db/schema.ts                           ⚠️ DEPRECATED  
├── Contains: Drizzle schema definitions
├── Status: Not used (schema duplicated in api-server.js)
├── Note: Kept for reference only

src/routes/api/                        ⚠️ DEPRECATED
├── queue.ts                           (Not used - see api-server.js lines 150-250)
├── ticketHistory.ts                  (Not used - see api-server.js lines 308-330)
├── queue/$id.ts                       (Not used - see api-server.js lines 261-305)
└── README.md                          (Documentation of deprecation)

src/routes/admin/                      ⚠️ DEPRECATED
├── serve.ts                           (Not used - see api-server.js lines 357-405)
└── report.ts                          (Not used - see api-server.js lines 407-425)
```

---

## 🔄 API Routes

All API routes are defined in `api-server.js`:

| Method | Route | Handler | Location |
|--------|-------|---------|----------|
| GET | `/health` | Health check | Line 428 |
| GET | `/api/health` | Health check | Line 140 |
| GET | `/api/queue?service=X` | Get queue status | Line 150 |
| POST | `/api/queue` | Join queue | Line 198 |
| GET | `/api/queue/:id` | Get queue entry | Line 261 |
| GET | `/api/ticketHistory?studentId=X` | Get ticket history | Line 308 |
| POST | `/api/admin/serve` | Admin serve next/complete/cancel | Line 357 |
| GET | `/api/admin/report` | Admin get all served | Line 407 |
| GET | `/api/debug` | Debug info | Line 428 |
| `*` | `/*` | SPA fallback to index.html | Line 437 |

---

## 🗄 Database

### Schema

Single table: `queue_entries`

```sql
CREATE TABLE queue_entries (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  service_type TEXT NOT NULL, -- enum: registrar, finance, ict_helpdesk
  queue_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting', -- enum: waiting, serving, served, cancelled
  created_at TIMESTAMP DEFAULT NOW(),
  served_at TIMESTAMP
);
```

### Enums

```sql
CREATE TYPE queue_status AS ENUM ('waiting', 'serving', 'served', 'cancelled');
CREATE TYPE service_type AS ENUM ('registrar', 'finance', 'ict_helpdesk');
```

### Initialization

- Schema defined inline in `api-server.js` (lines 20-28)
- Connection initialized on server startup (lines 532-555)
- Migrations managed via Drizzle ORM (in `drizzle/` folder)

---

## 🔐 Authentication

### Admin Authentication

- **Method:** HTTP Basic Authentication
- **Endpoint:** `/api/admin/serve` and `/api/admin/report`
- **Credentials:** 
  - Username: `Admin0375`
  - Password: `group2sysdev`
- **Implementation:** Lines 120-135 in `api-server.js`

### Student Authentication

- **Method:** Session storage (browser localStorage)
- **Endpoint:** Student dashboard is public, but tracks tickets via localStorage
- **No backend validation required for student actions

---

## 🚀 Deployment

### Build Process

```bash
npm ci                  # Install dependencies
npm run build          # Run Vite build
                       # Output: dist/ folder with compiled SPA
```

### Start Process

```bash
npm run production     # Run: node api-server.js
                       # 1. Validate DATABASE_URL
                       # 2. Initialize Express app
                       # 3. Connect to database (with retry logic)
                       # 4. Serve static files from dist/
                       # 5. Start HTTP server on port 3000
```

### Environment Variables

| Variable | Required | Value |
|----------|----------|-------|
| `NODE_ENV` | Yes (prod) | `production` |
| `DATABASE_URL` | Yes (prod) | PostgreSQL connection string |
| `PORT` | No | `3000` (default) |

---

## 🛠 Development

### Running Locally

```bash
# Terminal 1 - Frontend dev server (port 3001)
npm run dev:client    # Runs Vite dev server with HMR

# Terminal 2 - Backend dev server (port 3000)
npm run dev:server    # Runs Express with --watch mode

# OR combined
npm run dev           # Runs both concurrently
```

When running in dev:
- Frontend served from Vite (http://localhost:3001)
- Vite proxies `/api/*` to backend (http://localhost:3000)
- Backend connects to production database (via DATABASE_URL env var)

### Why TanStack Start Files Were Created

The `src/routes/api/` and `src/routes/admin/` files were created with TanStack Start patterns because there was an initial plan to migrate to a full-stack TanStack Start application. However, the project continued with:
- Vite for frontend bundling
- Express for backend
- React Router for frontend routing

This hybrid approach works well and is production-ready, but the old TanStack Start files remain as remnants of that abandoned migration.

---

## ⚠️ Important Notes

### Database Schema Location

- **Schema definition:** `api-server.js` lines 20-28 (inline)
- **Schema reference:** `db/schema.ts` (not used in production)
- **Migrations:** `drizzle/` folder (applied by Drizzle on startup)

If you modify the schema:
1. Update the inline definition in `api-server.js`
2. Generate migration: `npx drizzle-kit generate`
3. Migrations applied automatically on next deploy

### Unused Files

The following files are NOT used in production but kept for reference:
- `db/index.ts` - TypeScript database client
- `db/schema.ts` - Schema definitions
- `src/routes/api/*.ts` - TanStack Start handlers
- `src/routes/admin/*.ts` - TanStack Start handlers

They contain commented-out code showing the intended TanStack Start implementation. Remove them if code cleanliness is important.

### SPA Architecture

This is a **Single Page Application (SPA)** architecture:
- All HTML served from `dist/index.html`
- Unknown routes return `dist/index.html` (SPA fallback, line 437)
- React Router handles all page navigation client-side
- API calls go to `/api/*` endpoints

This means:
- Direct URL navigation works: `/admin`, `/track/123`, etc.
- Refresh works: React Router restores the page state
- No server-side page rendering

---

## 📊 Data Flow

### Student Joins Queue

```
1. Student fills form in React UI (frontend)
   ↓
2. Frontend calls POST /api/queue with name, studentId, service
   ↓
3. api-server.js receives request
   ↓
4. Checks database for active tickets (limit: 3)
   ↓
5. Gets next queue number for service
   ↓
6. Creates queue entry in database
   ↓
7. Returns queue number and entry ID
   ↓
8. Frontend displays confirmation with queue number
```

### Student Tracks Queue

```
1. Student navigates to /track/:id page
   ↓
2. React Router matches route and loads TrackPage component
   ↓
3. Component fetches GET /api/queue/:id every 5 seconds
   ↓
4. api-server.js queries database for entry details
   ↓
5. Calculates position and people ahead
   ↓
6. Returns status: waiting, serving, or served
   ↓
7. Frontend updates UI and shows notification when status changes to "serving"
```

---

## 🔧 Troubleshooting

### Blank Page in Production

**Check:**
1. Render logs show "Database: Connected and ready"
2. Render logs show "Backend server running on port 3000"
3. Browser DevTools shows CSS/JS files loading from `/assets/`
4. Status code of `/` is 200 (not 404 or 500)

### API 503 Errors

**Check:**
1. Database connection in logs
2. Try `/api/health` endpoint
3. Look for "Database: Connected" in startup logs

### Build Fails

**Check:**
1. All dependencies installed: `npm ci`
2. No TypeScript errors: `npm run build`
3. dist/ folder created with all assets

---

**Architecture Status:** ✅ Production Ready  
**Last Reviewed:** May 21, 2026  
**Next Review:** As needed after feature changes
