# ✅ Backend Server Setup Complete

## What Was Done

Your backend server has been fully configured to handle all API endpoints your React frontend is calling.

### Files Created/Modified

1. **`api-server.js`** ✅ NEW
   - Express.js server handling all API endpoints
   - Integrated with Drizzle ORM for PostgreSQL
   - Basic Auth for admin endpoints
   - CORS configured for frontend communication

2. **`package.json`** ✅ UPDATED
   - Added: `express`, `cors`, `drizzle-orm`, `postgres`, `dotenv`, `concurrently`
   - Added npm scripts:
     - `npm run dev` - starts both frontend & backend
     - `npm run dev:client` - frontend only
     - `npm run dev:server` - backend only
     - `npm run server` - production backend

3. **`.env.example`** ✅ NEW
   - Template for environment variables
   - Document your database connection here

4. **Documentation Files** ✅ NEW
   - `SETUP.md` - Detailed setup instructions
   - `QUICKSTART.md` - Quick reference guide
   - `DEPLOYMENT.md` - Production deployment options

## API Endpoints Implemented

### Queue Management
- `GET /api/queue?service={service}` - Get queue status
- `POST /api/queue` - Create new queue entry
- `GET /api/queue/:id` - Get specific entry details

### Admin Operations (Basic Auth)
- `POST /api/admin/serve` - Manage queue (serve next, complete, cancel)
- `GET /api/admin/report` - Get all served entries

### Health Check
- `GET /api/health` - Server health check

## Getting Started

### 1. Install All Dependencies
```bash
npm install
```

### 2. Setup Database Connection
```bash
cp .env.example .env
# Edit .env and add your DATABASE_URL
```

Example `.env`:
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/jkuat_queue
PORT=3000
FRONTEND_URL=http://localhost:3001
```

### 3. Create PostgreSQL Database
```bash
createdb jkuat_queue
```

### 4. Start Both Services
```bash
npm run dev
```

This will:
- Start **frontend** on http://localhost:3001 (React/Vite)
- Start **backend** on http://localhost:3000 (Express API)

## Verify It's Working

### Test Backend Health
```bash
curl http://localhost:3000/api/health
```

### Test Queue Endpoint
```bash
curl "http://localhost:3000/api/queue?service=registrar"
```

### Test Create Entry
```bash
curl -X POST http://localhost:3000/api/queue \
  -H "Content-Type: application/json" \
  -d '{"name": "0712345678", "studentId": "STU123", "serviceType": "registrar"}'
```

## Database Schema

The backend automatically uses this schema:

```
table: queue_entries
├── id (integer, primary key)
├── name (text) - phone number
├── student_id (text)
├── service_type (enum: registrar, finance, ict_helpdesk)
├── queue_number (integer)
├── status (enum: waiting, serving, served, cancelled)
├── created_at (timestamp)
└── served_at (timestamp)
```

## Admin Credentials

For testing admin endpoints:
- **Username**: `Admin0375`
- **Password**: `group2sysdev`

## Frontend to Backend Communication

Your React components call `/api/*` endpoints. The backend handles them:

- Frontend calls: `fetch('/api/queue')`
- Backend responds from: `http://localhost:3000/api/queue`
- CORS is configured to allow frontend on ports 3001 & 5173

## Environment Setup

### Required
- `DATABASE_URL` - PostgreSQL connection string (required to start backend)

### Optional
- `PORT` - Backend port (default: 3000)
- `FRONTEND_URL` - Frontend URL for CORS (default: http://localhost:3001)

## Troubleshooting

### "Cannot connect to database"
```bash
# Verify PostgreSQL is running
psql --version

# Test connection
psql "postgresql://user:password@localhost:5432/jkuat_queue"

# Create database if missing
createdb jkuat_queue
```

### Port already in use
```bash
# Check what's using port 3000
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Mac/Linux

# Use different port
PORT=3001 node api-server.js
```

### Frontend can't reach backend
1. Check backend is running on port 3000
2. Verify CORS is enabled (it is by default)
3. Check browser console for errors
4. Check network tab to see API responses

### Database migrations needed?
The backend creates the schema on startup. If you see errors:
```bash
# Manually create table
psql "postgresql://..." << EOF
CREATE TABLE IF NOT EXISTS queue_entries (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  student_id TEXT NOT NULL,
  service_type VARCHAR(20) NOT NULL,
  queue_number INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMP DEFAULT NOW(),
  served_at TIMESTAMP
);
EOF
```

## Production Deployment

See `DEPLOYMENT.md` for:
- Docker setup
- Netlify deployment
- Railway/Render deployment
- Nginx/Apache configuration
- SSL/TLS setup

## Next Steps

1. ✅ Backend server created
2. ⬜ Run `npm install`
3. ⬜ Configure `.env` with DATABASE_URL
4. ⬜ Create PostgreSQL database
5. ⬜ Run `npm run dev`
6. ⬜ Test API endpoints
7. ⬜ Deploy to production

## Quick Reference

```bash
# Development
npm run dev                    # Full stack (frontend + backend)
npm run dev:client            # Frontend only (Vite)
npm run dev:server            # Backend only (Express)

# Production
npm run build                  # Build frontend
npm run server                 # Run backend

# Testing
curl http://localhost:3000/api/health
curl "http://localhost:3000/api/queue?service=registrar"

# Database
createdb jkuat_queue
psql "postgresql://user:password@localhost:5432/jkuat_queue"
```

## Support

For issues:
1. Check SETUP.md for detailed instructions
2. Review api-server.js comments
3. Check browser console (frontend) and terminal (backend) for errors
4. Verify DATABASE_URL connection string format

---

**Status**: ✅ Backend server fully configured and ready to use!
