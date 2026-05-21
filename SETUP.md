# JKUAT Queue System - Setup Guide

## Overview
This is a full-stack queue management system with a React frontend and Express.js backend.

- **Frontend**: React 18 + TanStack Router (SPA on Vite)
- **Backend**: Express.js + Drizzle ORM + PostgreSQL
- **Port 3001**: Frontend (React Vite dev server)
- **Port 3000**: Backend API (Express)

## Prerequisites

1. **Node.js** 16+ installed
2. **PostgreSQL** database running
3. **npm** or **yarn** package manager

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

This installs all dependencies for both frontend and backend.

### 2. Configure Environment

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and set your database connection:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/jkuat_queue
PORT=3000
FRONTEND_URL=http://localhost:3001
```

**Example for local PostgreSQL:**
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/jkuat_queue
```

### 3. Create Database

Ensure your PostgreSQL database exists:

```bash
createdb jkuat_queue
```

Or using PostgreSQL client:
```sql
CREATE DATABASE jkuat_queue;
```

### 4. Run Database Migrations

The database schema is defined in `db/schema.ts`. When you first start the backend, it will create the tables.

## Running the Application

### Development Mode (Both Frontend + Backend)

```bash
npm run dev
```

This starts:
- **Frontend**: http://localhost:3001
- **Backend**: http://localhost:3000

### Frontend Only

```bash
npm run dev:client
```

Frontend runs on: http://localhost:3001

### Backend Only

```bash
npm run dev:server
```

Backend runs on: http://localhost:3000

### Production Mode

```bash
npm run build
npm run server
```

## API Endpoints

### Queue Management

**GET /api/queue**
```bash
curl "http://localhost:3000/api/queue?service=registrar"
```
Response:
```json
{
  "waitingCount": 5,
  "serving": {
    "id": 1,
    "queueNumber": 10,
    "name": "John",
    "studentId": "STU001",
    "serviceType": "registrar",
    "status": "serving",
    "createdAt": "2025-05-20T10:30:00Z"
  }
}
```

**POST /api/queue**
```bash
curl -X POST http://localhost:3000/api/queue \
  -H "Content-Type: application/json" \
  -d '{
    "name": "0712345678",
    "studentId": "STU123",
    "serviceType": "registrar"
  }'
```

**GET /api/queue/:id**
```bash
curl "http://localhost:3000/api/queue/1"
```

### Admin Endpoints (Basic Auth Required)

Use `Admin0375` / `group2sysdev` credentials.

**POST /api/admin/serve** - Manage queue
```bash
curl -X POST http://localhost:3000/api/admin/serve \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic QWRtaW4wMzc1Omdyb3VwMnN5c2Rldig=" \
  -d '{
    "serviceType": "registrar",
    "action": "serve_next"
  }'
```

Actions:
- `serve_next` - Serve next person in queue
- `complete` - Mark specific entry as complete (requires `entryId`)
- `cancel` - Cancel specific entry (requires `entryId`)

**GET /api/admin/report** - Get all served entries
```bash
curl http://localhost:3000/api/admin/report \
  -H "Authorization: Basic QWRtaW4wMzc1Omdyb3VwMnN5c2Rldig="
```

### Health Check

**GET /api/health**
```bash
curl http://localhost:3000/api/health
```

## Database Schema

### queue_entries Table

```
id                 INT PRIMARY KEY (auto-increment)
name              TEXT (phone number)
student_id        TEXT 
service_type      ENUM ('registrar', 'finance', 'ict_helpdesk')
queue_number      INT (unique per service)
status            ENUM ('waiting', 'serving', 'served', 'cancelled')
created_at        TIMESTAMP (default: now)
served_at         TIMESTAMP (nullable)
```

## Services Supported

1. **Registrar** (`registrar`) - Academic records & registration
2. **Finance** (`finance`) - Fee payments & financial aid
3. **ICT Helpdesk** (`ict_helpdesk`) - Technical support

## Frontend URLs

- Home: http://localhost:3001/
- Login: http://localhost:3001/login
- Admin Panel: http://localhost:3001/admin
- Track Queue: http://localhost:3001/track/{id}

## Admin Credentials

- **Username**: `Admin0375`
- **Password**: `group2sysdev`

## Troubleshooting

### Backend won't start
1. Check DATABASE_URL is correct
2. Verify PostgreSQL is running
3. Check port 3000 is not in use

### Frontend can't reach API
1. Ensure backend is running on port 3000
2. Check CORS is enabled (should be by default)
3. Check browser console for errors

### Database connection fails
1. Verify PostgreSQL service is running
2. Check credentials in .env
3. Ensure database `jkuat_queue` exists
4. Try connecting directly: `psql postgresql://user:password@localhost:5432/jkuat_queue`

## File Structure

```
├── src/                    # Frontend React code
│   ├── main.tsx           # App entry point
│   ├── router.tsx         # Route configuration
│   ├── styles.css         # Global styles + Tailwind
│   └── routes/            # Page components
├── db/                    # Database config
│   ├── index.ts          # DB client
│   └── schema.ts         # Schema definition
├── api-server.js         # Express API server
├── index.html            # HTML entry
├── package.json          # Dependencies
├── .env                  # Environment variables
├── .env.example          # Example env file
├── vite.config.ts        # Vite config
└── tsconfig.json         # TypeScript config
```

## Next Steps

1. Start backend: `npm run dev:server`
2. Start frontend: `npm run dev:client`
3. Navigate to http://localhost:3001
4. Login with credentials above
5. Test queue management features

## Support

For issues or questions, check the error logs or contact the development team.
