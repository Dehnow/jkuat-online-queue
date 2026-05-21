# API Testing Guide

This guide shows how to test all backend endpoints.

## Prerequisites

Ensure backend is running:
```bash
npm run dev:server
# or
npm run dev  # runs both frontend + backend
```

Backend should be available at: `http://localhost:3000`

## Testing Tools

You can test using:
- **curl** (command line)
- **Postman** (GUI)
- **Thunder Client** (VS Code extension)
- **REST Client** (VS Code extension)

## Endpoints

### 1. Health Check

```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "Server is running"
}
```

---

### 2. Get Queue Status

Get current queue statistics for a service.

```bash
curl "http://localhost:3000/api/queue?service=registrar"
```

Query parameters:
- `service` (required): `registrar`, `finance`, or `ict_helpdesk`

Expected response:
```json
{
  "waitingCount": 5,
  "serving": {
    "id": 1,
    "queueNumber": 10,
    "name": "0712345678",
    "studentId": "STU001",
    "serviceType": "registrar",
    "status": "serving",
    "createdAt": "2025-05-20T10:30:00.000Z"
  }
}
```

---

### 3. Create Queue Entry

Add a student to the queue.

```bash
curl -X POST http://localhost:3000/api/queue \
  -H "Content-Type: application/json" \
  -d '{
    "name": "0712345678",
    "studentId": "STU123",
    "serviceType": "registrar"
  }'
```

Request body:
- `name` (required): Phone number
- `studentId` (required): Student ID
- `serviceType` (required): `registrar`, `finance`, or `ict_helpdesk`

Expected response:
```json
{
  "id": 5,
  "name": "0712345678",
  "studentId": "STU123",
  "serviceType": "registrar",
  "queueNumber": 15,
  "status": "waiting",
  "createdAt": "2025-05-20T11:45:00.000Z",
  "servedAt": null
}
```

---

### 4. Get Queue Entry Details

Get specific entry with position and count of people ahead.

```bash
curl "http://localhost:3000/api/queue/5"
```

Path parameter:
- `id` (required): Queue entry ID

Expected response:
```json
{
  "entry": {
    "id": 5,
    "name": "0712345678",
    "studentId": "STU123",
    "serviceType": "registrar",
    "queueNumber": 15,
    "status": "waiting",
    "createdAt": "2025-05-20T11:45:00.000Z",
    "servedAt": null
  },
  "position": 3,
  "aheadCount": 2
}
```

---

### 5. Admin: Serve Next

Mark the next person in queue as being served (admin only).

```bash
curl -X POST http://localhost:3000/api/admin/serve \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic QWRtaW4wMzc1Omdyb3VwMnN5c2Rldig=" \
  -d '{"serviceType": "registrar", "action": "serve_next"}'
```

Headers:
- `Authorization: Basic <credentials>` (required)
  - Username: `Admin0375`
  - Password: `group2sysdev`
  - Base64: `QWRtaW4wMzc1Omdyb3VwMnN5c2Rldig=`

Request body:
- `serviceType` (required): Service to serve from
- `action` (required): `serve_next`, `complete`, or `cancel`
- `entryId` (required for complete/cancel): Entry ID to complete/cancel

### Action: serve_next
Serve the next person in queue:
```bash
curl -X POST http://localhost:3000/api/admin/serve \
  -H "Authorization: Basic QWRtaW4wMzc1Omdyb3VwMnN5c2Rldig=" \
  -H "Content-Type: application/json" \
  -d '{"serviceType": "registrar", "action": "serve_next"}'
```

Response: Serves first waiting entry, changes status to `serving`

### Action: complete
Mark specific entry as served:
```bash
curl -X POST http://localhost:3000/api/admin/serve \
  -H "Authorization: Basic QWRtaW4wMzc1Omdyb3VwMnN5c2Rldig=" \
  -H "Content-Type: application/json" \
  -d '{"serviceType": "registrar", "action": "complete", "entryId": 5}'
```

Response: Changes status to `served`, sets `servedAt` timestamp

### Action: cancel
Cancel a queue entry:
```bash
curl -X POST http://localhost:3000/api/admin/serve \
  -H "Authorization: Basic QWRtaW4wMzc1Omdyb3VwMnN5c2Rldig=" \
  -H "Content-Type: application/json" \
  -d '{"serviceType": "registrar", "action": "cancel", "entryId": 5}'
```

Response: Changes status to `cancelled`

---

### 6. Admin: Get Report

Get all served entries (admin only).

```bash
curl http://localhost:3000/api/admin/report \
  -H "Authorization: Basic QWRtaW4wMzc1Omdyb3VwMnN5c2Rldig="
```

Expected response:
```json
{
  "entries": [
    {
      "id": 1,
      "name": "0712345678",
      "studentId": "STU001",
      "serviceType": "registrar",
      "queueNumber": 10,
      "status": "served",
      "createdAt": "2025-05-20T10:00:00.000Z",
      "servedAt": "2025-05-20T10:15:00.000Z"
    },
    {
      "id": 2,
      "name": "0723456789",
      "studentId": "STU002",
      "serviceType": "registrar",
      "queueNumber": 11,
      "status": "served",
      "createdAt": "2025-05-20T10:05:00.000Z",
      "servedAt": "2025-05-20T10:25:00.000Z"
    }
  ],
  "total": 2
}
```

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid input",
  "message": "serviceType must be one of: registrar, finance, ict_helpdesk"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid credentials"
}
```

### 404 Not Found
```json
{
  "error": "Not found",
  "message": "Queue entry 999 not found"
}
```

### 500 Server Error
```json
{
  "error": "Server error",
  "message": "Database connection failed"
}
```

---

## Testing Workflow

### 1. Create multiple queue entries
```bash
# Entry 1
curl -X POST http://localhost:3000/api/queue \
  -H "Content-Type: application/json" \
  -d '{"name": "0712345678", "studentId": "STU001", "serviceType": "registrar"}'

# Entry 2
curl -X POST http://localhost:3000/api/queue \
  -H "Content-Type: application/json" \
  -d '{"name": "0723456789", "studentId": "STU002", "serviceType": "registrar"}'

# Entry 3
curl -X POST http://localhost:3000/api/queue \
  -H "Content-Type: application/json" \
  -d '{"name": "0734567890", "studentId": "STU003", "serviceType": "registrar"}'
```

### 2. Check queue status
```bash
curl "http://localhost:3000/api/queue?service=registrar"
```

Should show 3 waiting entries

### 3. Serve next person
```bash
curl -X POST http://localhost:3000/api/admin/serve \
  -H "Authorization: Basic QWRtaW4wMzc1Omdyb3VwMnN5c2Rldig=" \
  -H "Content-Type: application/json" \
  -d '{"serviceType": "registrar", "action": "serve_next"}'
```

### 4. Check specific entry
```bash
curl "http://localhost:3000/api/queue/1"
```

Entry 1 should now have status `serving` and position 0

### 5. Complete entry
```bash
curl -X POST http://localhost:3000/api/admin/serve \
  -H "Authorization: Basic QWRtaW4wMzc1Omdyb3VwMnN5c2Rldig=" \
  -H "Content-Type: application/json" \
  -d '{"serviceType": "registrar", "action": "complete", "entryId": 1}'
```

### 6. Get admin report
```bash
curl http://localhost:3000/api/admin/report \
  -H "Authorization: Basic QWRtaW4wMzc1Omdyb3VwMnN5c2Rldig="
```

Should show entry 1 with status `served`

---

## Using Postman

1. Open Postman
2. Create a new collection: "JKUAT Queue API"
3. Add requests for each endpoint (see examples above)
4. For auth requests:
   - Select "Authorization" tab
   - Choose "Basic Auth"
   - Username: `Admin0375`
   - Password: `group2sysdev`
   - Postman will auto-encode and add header

---

## Using REST Client (VS Code)

Create file `requests.rest`:

```rest
### Health check
GET http://localhost:3000/api/health

### Get queue status
GET http://localhost:3000/api/queue?service=registrar

### Create entry
POST http://localhost:3000/api/queue
Content-Type: application/json

{
  "name": "0712345678",
  "studentId": "STU123",
  "serviceType": "registrar"
}

### Get entry details
GET http://localhost:3000/api/queue/1

### Serve next (admin)
POST http://localhost:3000/api/admin/serve
Authorization: Basic QWRtaW4wMzc1Omdyb3VwMnN5c2Rldig=
Content-Type: application/json

{
  "serviceType": "registrar",
  "action": "serve_next"
}

### Get report (admin)
GET http://localhost:3000/api/admin/report
Authorization: Basic QWRtaW4wMzc1Omdyb3VwMnN5c2Rldig=
```

Then click "Send Request" above each request.

---

## Troubleshooting

### "Connection refused"
- Backend not running: `npm run dev:server`

### "Cannot GET /api/health"
- Check backend is listening on port 3000
- Check URL is correct (no trailing slash for most endpoints)

### "Unauthorized"
- Check Authorization header
- Verify credentials: `Admin0375` / `group2sysdev`
- Base64 encode if needed: `echo -n "Admin0375:group2sysdev" | base64`

### "Invalid input"
- Check required fields in request body
- Verify serviceType is one of: `registrar`, `finance`, `ict_helpdesk`

### "Database error"
- Check DATABASE_URL in .env
- Verify PostgreSQL is running
- Check database `jkuat_queue` exists
