# Production Deployment - Ticket System Quick Checklist

**Status:** ✅ READY FOR PRODUCTION  
**Last Updated:** May 30, 2026

---

## Pre-Deployment Verification

### ✅ Ticket API Endpoints - All Active
```
POST   /api/queue                    ✅ Create ticket
GET    /api/queue?service=registrar  ✅ Get queue stats
GET    /api/queue/:id                ✅ Get ticket details
GET    /api/ticketHistory            ✅ Get student history
POST   /api/admin/serve              ✅ Serve next ticket (with golden priority)
GET    /api/admin/report             ✅ Get served tickets
```

### ✅ Database Tables - All Migrated
```
queue_entries          ✅ Base table created
office_id              ✅ Added to queue_entries
is_golden              ✅ Added to queue_entries
golden_ticket_ref      ✅ Added to queue_entries
mpesa_status           ✅ Added to queue_entries
mpesa_transaction_id   ✅ Added to queue_entries
mpesa_paid_at          ✅ Added to queue_entries
```

### ✅ Error Handling - All Configured
```
✅ 400 - Missing/invalid fields
✅ 429 - Daily limit exceeded (3 tickets)
✅ 500 - Internal server error (with details)
✅ 503 - Database not ready
✅ Database connection retry logic enabled
✅ Comprehensive error logging enabled
```

---

## Deployment Commands

### Step 1: Set Environment Variables
```bash
# Create/update .env file with:
DATABASE_URL=postgresql://postgres:password@localhost:5432/queue_app
PORT=3000
NODE_ENV=production

# M-PESA (if not already set)
MPESA_CONSUMER_KEY=YLPydMh4xhirGrux1cdHyqKRCE3BzinLxdlzed4s88XyiRnu
MPESA_CONSUMER_SECRET=RuAadmSxyhwAqjk1GqEwW3vyoDtbCD0nByXAHR7GZw0COLoxSI6u0AKa91wSL4uw
MPESA_SHORTCODE=174379
MPESA_SANDBOX=true
```

### Step 2: Run Migrations
```bash
npm run migrate

# Expected Output:
# ✓ DATABASE_URL found in environment
# 🔄 Running database migrations...
# 📝 Running migration: 0000_fearless_landau.sql
# ✓ Successfully executed 2 statements
# 📝 Running migration: 20260519080407_perfect_blindfold/migration.sql
# ✓ Successfully executed 1 statement
# 📝 Running migration: 20260529164500_add_office_id_to_queue_entries/migration.sql
# ✓ Successfully executed 1 statement
# 📝 Running migration: 0001_furry_star_brand.sql
# ✓ Successfully executed 7 statements
```

### Step 3: Initialize Data
```bash
npm run init-data

# Expected Output:
# 🔄 Initializing database with default data...
# 📝 Inserting default offices...
# ✓ Successfully inserted 3 default offices
# 📊 Database Status After Initialization:
#   - Offices: 3
#   - Queue Entries: 0
#   - Staff Accounts: 0
# ✓ Data initialization completed successfully
```

### Step 4: Start Server
```bash
# Option A: Direct start
npm run server

# Option B: With build (recommended)
npm run start

# Expected Output:
# 🚀 JKUAT Queue System - Startup Initialization
# 🏢 Environment: production
# 🔌 Port: 3000
# ✓ DATABASE_URL is configured
# 🔄 Attempting initial database connection...
# ✓ Database: Connected and ready on startup
# ✓ Backend server running on port 3000
# ✓ Environment: production
# ✓ API endpoints available at /api/*
# ✓ Database Status: CONNECTED ✓
```

---

## Post-Deployment Verification

### Check 1: System Health
```bash
curl http://localhost:3000/api/health

# Should return:
{
  "status": "ok",
  "timestamp": "2026-05-30T10:30:45.123Z",
  "environment": "production",
  "databaseConnected": true,
  "database": {
    "connected": true,
    "tables": {
      "queue_entries": { "exists": true, "rowCount": 0 },
      "offices": { "exists": true, "rowCount": 3 },
      "staff_accounts": { "exists": true, "rowCount": 0 }
    }
  }
}
```

### Check 2: Create Test Ticket
```bash
curl -X POST http://localhost:3000/api/queue \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Student",
    "studentId": "TEST001",
    "serviceType": "registrar"
  }'

# Should return (201):
{
  "id": 1,
  "name": "Test Student",
  "student_id": "TEST001",
  "service_type": "registrar",
  "queue_number": 1,
  "status": "waiting",
  "office_id": 1,
  "is_golden": false,
  "created_at": "2026-05-30T10:30:45.123Z"
}
```

### Check 3: Retrieve Ticket
```bash
curl http://localhost:3000/api/queue/1

# Should return (200):
{
  "id": 1,
  "queueNumber": 1,
  "status": "waiting",
  "name": "Test Student",
  "studentId": "TEST001",
  "service": "registrar",
  "positionInQueue": 1,
  "aheadOfYou": 0,
  "nowServing": null,
  "estimatedWaitTime": 0,
  "isGolden": false
}
```

### Check 4: Get Queue Stats
```bash
curl "http://localhost:3000/api/queue?service=registrar"

# Should return (200):
{
  "waitingCount": 1,
  "serving": null
}
```

---

## Common Issues & Fixes

### Issue: "Database not ready" (503)
**Cause:** Database connection failed  
**Fix:**
```bash
# 1. Check DATABASE_URL
echo $DATABASE_URL

# 2. Verify database is running
psql -c "SELECT 1"

# 3. Check connection string format
# Format: postgresql://user:password@host:port/database

# 4. Restart server
npm run server
```

### Issue: "Missing required fields" (400)
**Cause:** Form data incomplete  
**Fix:** Ensure request body includes:
```json
{
  "name": "Student Name",
  "studentId": "STU001",
  "serviceType": "registrar" | "finance" | "ict_helpdesk"
}
```

### Issue: "Daily limit reached" (429)
**Cause:** Student has 3 active tickets  
**Fix:** Show user message to wait for a ticket to be served  
**Note:** This is intentional - works as designed

### Issue: Migration Error
**Cause:** Database tables already exist  
**Fix:**
```bash
# Migrations handle duplicates automatically
# Just run again if it fails:
npm run migrate

# If still issues, check:
# 1. DATABASE_URL is correct
# 2. Database is accessible
# 3. User has permissions
```

---

## Performance Monitoring

### Monitor Ticket Creation Success Rate
```bash
# Check database for tickets created
psql -c "SELECT COUNT(*) FROM queue_entries WHERE status = 'waiting'"

# Should show: count
#              -----
#                 1
```

### Monitor Error Rates
```bash
# Check server logs for errors
# Look for: "❌ Error creating queue entry"
# Should be rare or zero

# Check database connection status
# Look for: "✓ Database: Connected and ready"
```

### Monitor Wait Times
```bash
# Calculate average wait time
psql -c "SELECT AVG(EXTRACT(EPOCH FROM (served_at - created_at))/60) as avg_wait_minutes FROM queue_entries WHERE status = 'served'"
```

---

## Backup & Recovery

### Backup Database
```bash
pg_dump -U postgres queue_app > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Database
```bash
psql -U postgres queue_app < backup_20260530_103045.sql
```

---

## Monitoring Checklist (Daily)

- [ ] API health endpoint responds (200)
- [ ] Ticket creation works (201)
- [ ] Queue stats load (200)
- [ ] Error logs clean (no 500 errors)
- [ ] Database backup completed
- [ ] Average wait time acceptable
- [ ] No duplicate queue numbers
- [ ] Golden tickets prioritizing correctly

---

## Scaling Considerations

**Current Setup:**
- Connection pool: 10 max
- Idle timeout: 30s
- Max concurrent requests: Limited by pool

**If Performance Issues:**
1. Increase connection pool (api-server.js line 95):
   ```javascript
   max: 20, // Increase from 10
   ```

2. Add database indexes (if needed):
   ```sql
   CREATE INDEX idx_queue_entries_service_status ON queue_entries(service_type, status);
   CREATE INDEX idx_queue_entries_student ON queue_entries(student_id);
   ```

3. Archive old tickets:
   ```sql
   DELETE FROM queue_entries WHERE status = 'served' AND served_at < NOW() - INTERVAL '30 days';
   ```

---

## Production URLs

- **API Base:** `https://your-domain.com/api`
- **Ticket Create:** `POST /api/queue`
- **Ticket Fetch:** `GET /api/queue/:id`
- **Health Check:** `GET /api/health`
- **Admin Panel:** `https://your-domain.com/admin`
- **Tracking Page:** `https://your-domain.com/track/:id`

---

## Support & Troubleshooting

**Critical Issues:**
- Database connection failed → Check DATABASE_URL
- Tickets not saving → Check database permissions
- API not responding → Check PORT and firewall
- High error rate → Check server logs

**Contact:** Admin0375 / group2sysdev (credentials)

---

## Final Checklist Before Go-Live

- [x] All migrations applied
- [x] Test data initialized
- [x] Health check passes
- [x] Ticket creation works
- [x] Queue stats load
- [x] Error handling verified
- [x] No disabled endpoints
- [x] Logging configured
- [x] Backup procedure ready
- [x] Monitoring setup complete

✅ **READY FOR PRODUCTION DEPLOYMENT**

---

**Last Verified:** May 30, 2026  
**Verified By:** System Audit  
**Status:** Ready to Deploy 🚀
