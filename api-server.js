import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq, and, or, asc, desc, count as dbCount, sql } from 'drizzle-orm'
import { pgTable, serial, text, timestamp, integer, pgEnum, boolean } from 'drizzle-orm/pg-core'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const NODE_ENV = process.env.NODE_ENV || 'development'
const PORT = process.env.PORT || 3000

// Startup validation
console.log('ðŸš€ JKUAT Queue System - Startup Initialization')
console.log(`ðŸ“‹ Environment: ${NODE_ENV}`)
console.log(`ðŸ”Œ Port: ${PORT}`)
console.log(`ðŸ“¦ Node Version: ${process.version}`)

if (NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  console.error('âŒ FATAL: DATABASE_URL environment variable is not set!')
  console.error('âŒ Cannot start in production without database connection.')
  console.error('Please ensure DATABASE_URL is configured in your environment.')
  process.exit(1)
}

if (NODE_ENV === 'production') {
  console.log('âœ“ DATABASE_URL is configured')
} else {
  console.warn('âš ï¸  Development mode: DATABASE_URL may not be required for local testing')
}

// Schema
const statusEnum = pgEnum('queue_status', ['waiting', 'serving', 'served', 'cancelled'])
const serviceEnum = pgEnum('service_type', ['registrar', 'finance', 'ict_helpdesk'])
const officeStatusEnum = pgEnum('office_status', ['open', 'closed'])

const queueEntries = pgTable('queue_entries', {
  id: serial().primaryKey(),
  name: text('name').notNull(),
  studentId: text('student_id').notNull(),
  serviceType: serviceEnum('service_type').notNull(),
  queueNumber: integer('queue_number').notNull(),
  status: statusEnum('status').notNull().default('waiting'),
  createdAt: timestamp('created_at').defaultNow(),
  servedAt: timestamp('served_at'),
  officeId: integer('office_id'),
})

const offices = pgTable('offices', {
  id: serial().primaryKey(),
  name: text('name').notNull(),
  serviceType: serviceEnum('service_type').notNull(),
  status: officeStatusEnum('status').notNull().default('open'),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: text('created_by'),
})

const staffAccounts = pgTable('staff_accounts', {
  id: serial().primaryKey(),
  officeId: integer('office_id').notNull(),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  hasAdminPrivilege: boolean('has_admin_privilege').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: text('created_by'),
})

// Database Connection with retry logic
let db = null
let connectionAttempts = 0
const maxRetries = 5

async function initializeDatabase() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL not set')
  }

  try {
    const client = postgres(connectionString, {
      max: 10, // Connection pool size
      idle_timeout: 30,
      connect_timeout: 10,
    })

    // Test connection
    await client`SELECT 1`
    db = drizzle(client, { schema: { queueEntries, statusEnum, serviceEnum, officeStatusEnum, offices, staffAccounts } })
    connectionAttempts = 0
    return true
  } catch (error) {
    connectionAttempts++
    throw new Error(`Database connection failed (attempt ${connectionAttempts}): ${error.message}`)
  }
}

// Express app
const app = express()

// CORS configuration - handles both local and production
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      // Local development
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
      'http://localhost:3100',
      'http://localhost:3200',
      'http://localhost:5555',
      'http://localhost:9999',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3002',
      'http://127.0.0.1:3003',
      'http://127.0.0.1:3100',
      'http://127.0.0.1:3200',
      'http://127.0.0.1:5555',
      'http://127.0.0.1:9999',
      'http://127.0.0.1:5173',
      // Production URLs
      'https://jkuat-online-queue.onrender.com',
      'http://jkuat-online-queue.onrender.com',
    ]

    // Add production URLs from environment
    if (process.env.FRONTEND_URL) {
      allowedOrigins.push(process.env.FRONTEND_URL)
    }

    // Allow requests without origin (same-origin requests from server)
    // Or allow if origin is in allowedOrigins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      // Log rejected origins in production for debugging
      if (NODE_ENV === 'production') {
        console.warn(`âš ï¸  CORS request from unauthorized origin: ${origin}`)
      }
      callback(new Error('CORS not allowed'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}

app.use(cors(corsOptions))
app.use(express.json())

// Database status middleware - check if DB is ready for API requests (except health check)
app.use((req, res, next) => {
  // Allow health checks and static files without database
  if (req.path === '/health' || req.path === '/api/health' || req.path === '/api/debug' || !req.path.startsWith('/api')) {
    return next()
  }
  
  // For API requests, require database connection
  if (!db) {
    return res.status(503).json({ 
      error: 'Service Temporarily Unavailable',
      message: 'Database is initializing. Please try again in a few moments.',
      status: 'INITIALIZING'
    })
  }
  
  next()
})

// Serve static files in production
if (NODE_ENV === 'production') {
  const staticPath = path.join(__dirname, 'dist')
  console.log(`ðŸ“ Serving static files from: ${staticPath}`)
  app.use(express.static(staticPath, { 
    maxAge: '1h',
    etag: false
  }))
}

const ADMIN_USERNAME = 'Admin0375'
const ADMIN_PASSWORD = 'group2sysdev'

// Basic Auth middleware
function checkAuth(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const credentials = Buffer.from(authHeader.slice(6), 'base64').toString('utf-8')
    const [username, password] = credentials.split(':')

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      next()
    } else {
      res.status(401).json({ error: 'Unauthorized' })
    }
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized' })
  }
}

// Routes

// Health check - returns immediately, doesn't require database
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(), 
    environment: NODE_ENV,
    databaseConnected: !!db
  })
})

// GET /api/queue - Get queue stats for a service
app.get('/api/queue', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not ready' })
    }

    const { service } = req.query

    if (!service) {
      return res.status(400).json({ error: 'Missing service parameter' })
    }

    const waitingCount = await db
      .select({ count: sql`cast(count(*) as integer)` })
      .from(queueEntries)
      .where(
        and(
          eq(queueEntries.serviceType, service),
          eq(queueEntries.status, 'waiting'),
        ),
      )
      .then((res) => res[0]?.count ?? 0)

    const serving = await db
      .select({
        id: queueEntries.id,
        name: queueEntries.name,
        studentId: queueEntries.studentId,
        serviceType: queueEntries.serviceType,
        queueNumber: queueEntries.queueNumber,
        status: queueEntries.status,
        createdAt: queueEntries.createdAt,
        servedAt: queueEntries.servedAt,
      })
      .from(queueEntries)
      .where(
        and(
          eq(queueEntries.serviceType, service),
          eq(queueEntries.status, 'serving'),
        ),
      )
      .limit(1)
      .then((res) => res[0] || null)

    res.json({ waitingCount, serving })
  } catch (error) {
    console.error('Error fetching queue:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// POST /api/queue - Create new queue entry
app.post('/api/queue', async (req, res) => {
  try {
    if (!db) {
      console.error('âŒ Database not initialized for POST /api/queue')
      return res.status(503).json({ error: 'Database not ready' })
    }

    const { name, studentId, serviceType } = req.body
    console.log('ðŸ“ Creating queue entry:', { name, studentId, serviceType })

    if (!name || !studentId || !serviceType) {
      console.warn('âš ï¸  Missing fields:', { name: !!name, studentId: !!studentId, serviceType: !!serviceType })
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Validate service type
    const validServices = ['registrar', 'finance', 'ict_helpdesk']
    if (!validServices.includes(serviceType)) {
      console.warn('âš ï¸  Invalid service type:', serviceType)
      return res.status(400).json({ error: 'Invalid service type' })
    }

    // Find the office for this service type
    const office = await db.select().from(offices).where(eq(offices.serviceType, serviceType)).limit(1).then((rows) => rows[0] || null)
    const officeId = office?.id || null

    // Server-side validation: Check daily limit (3 active tickets per student)
    const activeCount = await db
      .select({ count: sql`cast(count(*) as integer)` })
      .from(queueEntries)
      .where(
        and(
          eq(queueEntries.studentId, studentId),
          eq(queueEntries.status, 'waiting')
        )
      )
      .then((res) => res[0]?.count ?? 0)

    console.log(`ðŸ“Š Student ${studentId} active tickets: ${activeCount}`)

    if (activeCount >= 3) {
      return res.status(429).json({ 
        error: 'Daily limit reached',
        message: 'You have reached the maximum of 3 active tickets. Wait for one to be served.'
      })
    }

    // Get next queue number
    const lastEntry = await db
      .select({ maxQueue: queueEntries.queueNumber })
      .from(queueEntries)
      .where(eq(queueEntries.serviceType, serviceType))
      .orderBy(desc(queueEntries.queueNumber))
      .limit(1)
      .then((res) => res[0])

    const nextQueueNumber = (lastEntry?.maxQueue ?? 0) + 1
    console.log(`ðŸ”¢ Next queue number for ${serviceType}: ${nextQueueNumber}`)

    const newEntry = await db
      .insert(queueEntries)
      .values({
        name,
        studentId,
        serviceType,
        queueNumber: nextQueueNumber,
        status: 'waiting',
        officeId,
      })
      .returning()

    console.log('âœ… Queue entry created:', newEntry[0])
    res.status(201).json(newEntry[0])
  } catch (error) {
    console.error('âŒ Error creating queue entry:', error.message)
    console.error('ðŸ“‹ Stack trace:', error.stack)
    res.status(500).json({ error: 'Internal server error', details: error.message })
  }
})

// GET /api/queue/:id - Get queue entry details
app.get('/api/queue/:id', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not ready' })
    }

    const { id } = req.params

    const entry = await db
      .select()
      .from(queueEntries)
      .where(eq(queueEntries.id, parseInt(id)))
      .limit(1)
      .then((res) => res[0] || null)

    if (!entry) {
      return res.status(404).json({ error: 'Queue entry not found' })
    }

    // Calculate waiting ahead
    const ahead = await db
      .select({ count: sql`cast(count(*) as integer)` })
      .from(queueEntries)
      .where(
        and(
          eq(queueEntries.serviceType, entry.serviceType),
          eq(queueEntries.status, 'waiting'),
        ),
      )
      .then((res) => res[0]?.count ?? 0)

    const serving = await db
      .select()
      .from(queueEntries)
      .where(
        and(
          eq(queueEntries.serviceType, entry.serviceType),
          eq(queueEntries.status, 'serving'),
        ),
      )
      .limit(1)
      .then((res) => res[0])

    res.json({
      ...entry,
      waitingAhead: ahead,
      currentlyServing: serving?.queueNumber || null,
    })
  } catch (error) {
    console.error('Error fetching queue entry:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/ticketHistory - Get student's ticket history for today
app.get('/api/ticketHistory', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not ready' })
    }

    const { studentId } = req.query

    if (!studentId || typeof studentId !== 'string') {
      return res.status(400).json({ error: 'Student ID is required', tickets: [] })
    }

    // Get start and end of today
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfDay = new Date(startOfDay)
    endOfDay.setDate(endOfDay.getDate() + 1)

    const tickets = await db
      .select()
      .from(queueEntries)
      .where(
        and(
          eq(queueEntries.studentId, studentId),
          sql`${queueEntries.createdAt} >= ${startOfDay}`,
          sql`${queueEntries.createdAt} < ${endOfDay}`
        )
      )
      .orderBy(desc(queueEntries.createdAt))
      .limit(50)

    res.json({
      tickets: tickets.map(t => ({
        id: t.id,
        queueNumber: t.queueNumber,
        serviceType: t.serviceType,
        status: t.status,
        createdAt: t.createdAt,
        servedAt: t.servedAt,
      })),
    })
  } catch (error) {
    console.error('Error fetching ticket history:', error)
    res.status(500).json({ error: 'Failed to fetch history', tickets: [] })
  }
})

// GET /api/staff/auth - List all offices for staff selection
app.get('/api/staff/auth', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not ready' })
    }

    const officesList = await db.select().from(offices)
    res.json({ offices: officesList })
  } catch (error) {
    console.error('Error fetching staff offices:', error)
    res.status(500).json({ error: 'Failed to fetch offices' })
  }
})

// POST /api/staff/auth - Authenticate staff user for a selected office
app.post('/api/staff/auth', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not ready' })
    }

    const { officeId, username, password } = req.body
    if (!officeId || !username || !password) {
      return res.status(400).json({ error: 'officeId, username and password are required' })
    }

    const office = await db.select().from(offices).where(eq(offices.id, officeId)).limit(1).then((rows) => rows[0] || null)
    if (!office) {
      return res.status(404).json({ error: 'Office not found' })
    }

    const defaultCredentialsMatch = username === 'office_staff' && password === '123'
    const officeCredentialsMatch = office.username === username && office.password === password
    const staff = await db.select().from(staffAccounts).where(eq(staffAccounts.username, username)).limit(1).then((rows) => rows[0] || null)
    const staffValid = staff && staff.password === password && staff.officeId === officeId

    if (!defaultCredentialsMatch && !officeCredentialsMatch && !staffValid) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    res.json({
      success: true,
      staff: {
        id: staff?.id ?? 0,
        username,
        officeId,
        hasAdminPrivilege: staff?.hasAdminPrivilege ?? false,
        isDefaultLogin: defaultCredentialsMatch,
      },
      office,
    })
  } catch (error) {
    console.error('Error authenticating staff:', error)
    res.status(500).json({ error: 'Authentication failed' })
  }
})

// GET /api/staff/queue/:officeId - Retrieve queue details for a staff office
app.get('/api/staff/queue/:officeId', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not ready' })
    }

    const officeId = parseInt(req.params.officeId, 10)
    if (Number.isNaN(officeId)) {
      return res.status(400).json({ error: 'Invalid officeId' })
    }

    // Get the office details to find its service type
    const office = await db.select().from(offices).where(eq(offices.id, officeId)).limit(1).then((rows) => rows[0] || null)
    if (!office) {
      return res.status(404).json({ error: 'Office not found' })
    }

    // Query queue entries by BOTH officeId AND serviceType to catch all relevant entries
    const queueRows = await db.select({
      id: queueEntries.id,
      name: queueEntries.name,
      studentId: queueEntries.studentId,
      serviceType: queueEntries.serviceType,
      queueNumber: queueEntries.queueNumber,
      status: queueEntries.status,
      createdAt: queueEntries.createdAt,
      servedAt: queueEntries.servedAt,
    }).from(queueEntries).where(
      or(
        eq(queueEntries.officeId, officeId),
        eq(queueEntries.serviceType, office.serviceType)
      )
    )
    const serving = queueRows.find((entry) => entry.status === 'serving') || null
    res.json({
      queue: {
        waiting: queueRows.filter((entry) => entry.status === 'waiting'),
        serving,
        served: queueRows.filter((entry) => entry.status === 'served'),
        cancelled: queueRows.filter((entry) => entry.status === 'cancelled'),
      },
    })
  } catch (error) {
    console.error('Error fetching staff queue:', error)
    res.status(500).json({ error: 'Failed to fetch staff queue' })
  }
})

// POST /api/staff/queue-action - Perform staff queue actions
app.post('/api/staff/queue-action', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not ready' })
    }

    const { action, queueId, officeId } = req.body
    if (!action || !officeId) {
      return res.status(400).json({ error: 'action and officeId are required' })
    }

    if (action === 'call_next') {
      // Get office to find its service type
      const office = await db.select().from(offices).where(eq(offices.id, officeId)).limit(1).then((rows) => rows[0] || null)
      if (!office) {
        return res.status(404).json({ error: 'Office not found' })
      }

      // First, mark any currently serving entry as served
      await db.update(queueEntries).set({ status: 'served', servedAt: new Date() }).where(
        and(
          or(eq(queueEntries.officeId, officeId), eq(queueEntries.serviceType, office.serviceType)),
          eq(queueEntries.status, 'serving')
        )
      )
      
      // Get next waiting entry using both officeId and serviceType
      const nextWaiting = await db.select({
        id: queueEntries.id,
        name: queueEntries.name,
        studentId: queueEntries.studentId,
        serviceType: queueEntries.serviceType,
        queueNumber: queueEntries.queueNumber,
        status: queueEntries.status,
        createdAt: queueEntries.createdAt,
        servedAt: queueEntries.servedAt,
      }).from(queueEntries).where(
        and(
          or(eq(queueEntries.officeId, officeId), eq(queueEntries.serviceType, office.serviceType)),
          eq(queueEntries.status, 'waiting')
        )
      ).orderBy(asc(queueEntries.queueNumber)).limit(1).then((rows) => rows[0] || null)
      
      if (!nextWaiting) {
        return res.json({ message: 'No one waiting for service' })
      }
      const updated = await db.update(queueEntries).set({ status: 'serving' }).where(eq(queueEntries.id, nextWaiting.id)).returning()
      return res.json(updated[0] || nextWaiting)
    }

    if (action === 'start_service' && queueId) {
      const updated = await db.update(queueEntries).set({ status: 'serving' }).where(eq(queueEntries.id, queueId)).returning()
      return res.json(updated[0] || { error: 'Entry not found' })
    }

    if (action === 'end_service' && queueId) {
      const updated = await db.update(queueEntries).set({ status: 'served', servedAt: new Date() }).where(eq(queueEntries.id, queueId)).returning()
      return res.json(updated[0] || { error: 'Entry not found' })
    }

    if (action === 'cancel' && queueId) {
      const updated = await db.update(queueEntries).set({ status: 'cancelled' }).where(eq(queueEntries.id, queueId)).returning()
      return res.json(updated[0] || { error: 'Entry not found' })
    }

    res.status(400).json({ error: 'Invalid action' })
  } catch (error) {
    console.error('Error handling staff queue action:', error)
    res.status(500).json({ error: 'Failed to perform queue action' })
  }
})

// PATCH /api/staff/office-status - Update the office open/closed state
app.patch('/api/staff/office-status', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not ready' })
    }

    const { officeId, status } = req.body
    if (!officeId || !status) {
      return res.status(400).json({ error: 'officeId and status are required' })
    }

    if (!['open', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' })
    }

    const updated = await db.update(offices).set({ status }).where(eq(offices.id, officeId)).returning()
    res.json(updated[0] || { error: 'Office not found' })
  } catch (error) {
    console.error('Error updating office status:', error)
    res.status(500).json({ error: 'Failed to update office status' })
  }
})

// POST /api/admin/serve - Admin actions (serve next, complete, cancel)
app.post('/api/admin/serve', checkAuth, async (req, res) => {
  try {
    if (!db) {
      console.error('âŒ Database not initialized for POST /api/admin/serve')
      return res.status(503).json({ error: 'Database not ready' })
    }

    const { serviceType, action, entryId } = req.body
    console.log('ðŸ”§ Admin action:', { serviceType, action, entryId })

    if (action === 'serve_next') {
      // Mark currently serving as served
      await db
        .update(queueEntries)
        .set({ status: 'served', servedAt: new Date() })
        .where(
          and(
            eq(queueEntries.serviceType, serviceType),
            eq(queueEntries.status, 'serving'),
          ),
        )

      // Get next waiting
      const waiting = await db
        .select()
        .from(queueEntries)
        .where(
          and(
            eq(queueEntries.serviceType, serviceType),
            eq(queueEntries.status, 'waiting'),
          ),
        )
        .orderBy(asc(queueEntries.queueNumber))
        .limit(1)

      if (waiting.length === 0) {
        console.log('â¹ï¸  No more entries in queue for service:', serviceType)
        return res.json({ message: 'No more in queue' })
      }

      const updated = await db
        .update(queueEntries)
        .set({ status: 'serving' })
        .where(eq(queueEntries.id, waiting[0].id))
        .returning()

      console.log('âœ… Serving next ticket:', updated[0])
      res.json(updated[0])
    } else if (action === 'complete' && entryId) {
      const updated = await db
        .update(queueEntries)
        .set({ status: 'served', servedAt: new Date() })
        .where(eq(queueEntries.id, entryId))
        .returning()

      console.log('âœ… Completed entry:', updated[0])
      res.json(updated[0] || { error: 'Entry not found' })
    } else if (action === 'cancel' && entryId) {
      const updated = await db
        .update(queueEntries)
        .set({ status: 'cancelled' })
        .where(eq(queueEntries.id, entryId))
        .returning()

      console.log('âŒ Cancelled entry:', updated[0])
      res.json(updated[0] || { error: 'Entry not found' })
    } else {
      console.warn('âš ï¸  Invalid admin action:', action)
      res.status(400).json({ error: 'Invalid action' })
    }
  } catch (error) {
    console.error('âŒ Error serving queue:', error.message)
    console.error('ðŸ“‹ Stack trace:', error.stack)
    res.status(500).json({ error: 'Internal server error', details: error.message })
  }
})

// GET /api/admin/report - Get all served entries
app.get('/api/admin/report', checkAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not ready' })
    }

    const served = await db
      .select()
      .from(queueEntries)
      .where(eq(queueEntries.status, 'served'))
      .orderBy(desc(queueEntries.servedAt))

    res.json(served)
  } catch (error) {
    console.error('Error fetching report:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// Health check can be used by both dev and production
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(), 
    environment: NODE_ENV,
    databaseConnected: !!db
  })
})

// Debug endpoint - shows deployment info
app.get('/api/debug', (req, res) => {
  res.json({
    environment: NODE_ENV,
    nodeVersion: process.version,
    databaseConnected: !!db,
    distPath: NODE_ENV === 'production' ? path.join(__dirname, 'dist') : 'N/A',
    distExists: NODE_ENV === 'production' ? require('fs').existsSync(path.join(__dirname, 'dist')) : 'N/A',
    indexHtmlExists: NODE_ENV === 'production' ? require('fs').existsSync(path.join(__dirname, 'dist', 'index.html')) : 'N/A',
    apiEndpointsWorking: true,
  })
})

// SPA fallback - serve index.html for all unknown routes (both dev and production)
app.get('*', (req, res) => {
  if (NODE_ENV === 'production') {
    const indexPath = path.join(__dirname, 'dist', 'index.html')
    console.log(`ðŸ“„ Serving SPA fallback to ${req.path} from dist`)
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('Error serving index.html:', err)
        res.status(500).json({ error: 'Failed to serve application' })
      }
    })
  } else {
    // In development, send 404 to avoid confusion (Vite handles client routing)
    res.status(404).json({ error: 'Not found. In development, Vite handles client routes.' })
  }
})

// Initialize database and start server
async function startServer() {
  console.log('ðŸš€ Starting server...')
  
  // Try to initialize database with timeout (max 30 seconds)
  let dbConnected = false
  try {
    console.log('ðŸ“¡ Attempting initial database connection...')
    const dbPromise = initializeDatabase()
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database connection timeout (30s)')), 30000)
    )
    
    await Promise.race([dbPromise, timeoutPromise])
    dbConnected = true
    console.log(`âœ“ Database: Connected and ready on startup`)
  } catch (error) {
    console.error('âŒ Initial database connection failed:', error.message)
    console.warn('âš ï¸  Server will start but will attempt to reconnect...')
  }

  // Start the HTTP server
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\nâœ“ Backend server running on port ${PORT}`)
    console.log(`âœ“ Environment: ${NODE_ENV}`)
    console.log(`âœ“ API endpoints available at /api/*`)
    console.log(`âœ“ Database Status: ${dbConnected ? 'CONNECTED âœ“' : 'CONNECTING... â³'}`)
    console.log(`\n`)
  })

  // If database not connected on startup, keep trying to reconnect
  if (!dbConnected) {
    const reconnectInterval = setInterval(async () => {
      try {
        console.log('ðŸ”„ Attempting database reconnection...')
        await initializeDatabase()
        console.log('âœ“ Database reconnected successfully!')
        clearInterval(reconnectInterval)
      } catch (e) {
        console.error('â³ Reconnection attempt failed:', e.message, '(will retry in 10 seconds)')
      }
    }, 10000) // Try every 10 seconds instead of 30
  }
}

startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
