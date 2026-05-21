# Quick Start

## 1. Install Dependencies
```bash
npm install
```

## 2. Setup Environment
```bash
cp .env.example .env
# Edit .env and set DATABASE_URL to your PostgreSQL connection
```

## 3. Create Database
```bash
createdb jkuat_queue
```

## 4. Start Both Frontend & Backend
```bash
npm run dev
```

This will start:
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000

## 5. Login
Navigate to http://localhost:3001/login
- Student: Any credentials work
- Admin: `Admin0375` / `group2sysdev`

## Available Commands

```bash
npm run dev              # Start frontend + backend concurrently
npm run dev:client      # Frontend only (http://localhost:3001)
npm run dev:server      # Backend only (http://localhost:3000)
npm run build           # Build frontend for production
npm run server          # Run backend (production mode)
```

## Testing the API

```bash
# Health check
curl http://localhost:3000/api/health

# Get queue status
curl "http://localhost:3000/api/queue?service=registrar"

# Create queue entry
curl -X POST http://localhost:3000/api/queue \
  -H "Content-Type: application/json" \
  -d '{"name": "0712345678", "studentId": "STU123", "serviceType": "registrar"}'
```

## Database Connection Issues?

If backend fails to connect:
1. Verify PostgreSQL is running: `psql --version`
2. Test connection: `psql "postgresql://user:password@localhost:5432/jkuat_queue"`
3. Create database if missing: `createdb jkuat_queue`
4. Check .env DATABASE_URL is correct

For more details, see SETUP.md
