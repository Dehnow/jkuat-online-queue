import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq, and, or, asc, desc, count as dbCount, sql } from 'drizzle-orm'
import { pgTable, serial, text, timestamp, integer, pgEnum, boolean } from 'drizzle-orm/pg-core'
import path from 'path'
import { fileURLToPath } from 'url'
import { registerMpesaRoutes } from './mpesa.js'

// Load environment variables - prioritize .env.local for development
const NODE_ENV_INITIAL = process.env.NODE_ENV || 'development'
if (NODE_ENV_INITIAL === 'development') {
  dotenv.config({ path: '.env.local' })
} else {
  dotenv.config()
}

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

// M-Pesa Configuration - AUTO-DETECT PRODUCTION vs SANDBOX
// =========================================================
// Environment variables (Render):
// - CONSUMER_KEY, CONSUMER_SECRET, PASSKEY, SHORTCODE (for PRODUCTION)
// If all are provided ? AUTO uses PRODUCTION with real M-Pesa
// If missing ? AUTO falls back to SANDBOX (no real STK prompts)
// NO need to set MPESA_SANDBOX variable anymore!

const SANDBOX_CONSUMER_KEY = '4PvGSK0r7RiNmZkjnEwYlQ2xAzB8sD3qF5gH6tJ9oP1u2v'
const SANDBOX_CONSUMER_SECRET = 'wX3yZ9lM5kJ8nB2vC7pDqRsT4uFgH6jK9oL1mN3pQ4rS5tU'
const SANDBOX_PASSKEY = 'bfb279f9ba9b9d1380007480bbe7f27425e1aa6d4ede3891ec337007a74ff42'

// Load credentials from environment (Render) or use sandbox defaults
const CONSUMER_KEY_ENV = process.env.CONSUMER_KEY || process.env.MPESA_CONSUMER_KEY
const CONSUMER_SECRET_ENV = process.env.CONSUMER_SECRET || process.env.MPESA_CONSUMER_SECRET
const PASSKEY_ENV = process.env.PASSKEY || process.env.MPESA_PASSKEY
const SHORTCODE_ENV = process.env.SHORTCODE || process.env.MPESA_SHORTCODE || process.env.MPESA_TILL_NUMBER

// AUTO-DETECT: Use production if ALL real credentials provided, otherwise sandbox
const HAS_PRODUCTION_CREDENTIALS = !!(CONSUMER_KEY_ENV && CONSUMER_SECRET_ENV && PASSKEY_ENV && SHORTCODE_ENV)
const HAS_REAL_CREDENTIALS = HAS_PRODUCTION_CREDENTIALS && 
  CONSUMER_KEY_ENV !== SANDBOX_CONSUMER_KEY && 
  CONSUMER_SECRET_ENV !== SANDBOX_CONSUMER_SECRET &&
  PASSKEY_ENV !== SANDBOX_PASSKEY

const MPESA_CONFIG = {
  // AUTO-DETECT: Production if real credentials, otherwise sandbox
  isSandbox: !HAS_REAL_CREDENTIALS,
  consumerKey: HAS_REAL_CREDENTIALS ? CONSUMER_KEY_ENV : SANDBOX_CONSUMER_KEY,
  consumerSecret: HAS_REAL_CREDENTIALS ? CONSUMER_SECRET_ENV : SANDBOX_CONSUMER_SECRET,
  passkey: HAS_REAL_CREDENTIALS ? PASSKEY_ENV : SANDBOX_PASSKEY,
  tillNumber: HAS_REAL_CREDENTIALS ? SHORTCODE_ENV : '174379',
  callbackUrl: process.env.CALLBACK_URL || process.env.MPESA_CALLBACK_URL || (NODE_ENV === 'production' 
    ? 'https://jkuat-online-queue.onrender.com/mpesa-express-simulate/'
    : 'http://localhost:3000/mpesa-express-simulate/')
}

// Startup logging - DETAILED CREDENTIAL STATUS
console.log(`\n?? M-PESA CREDENTIAL STATUS`)
console.log(`?????????????????????????????????????????????`)
console.log(`CONSUMER_KEY env var provided: ${CONSUMER_KEY_ENV ? '? YES' : '? NO'}`)
console.log(`CONSUMER_SECRET env var provided: ${CONSUMER_SECRET_ENV ? '? YES' : '? NO'}`)
console.log(`PASSKEY env var provided: ${PASSKEY_ENV ? '? YES' : '? NO'}`)
console.log(`SHORTCODE env var provided: ${SHORTCODE_ENV ? '? YES' : '? NO'}`)
console.log(`\nAuto-detection result:`)
console.log(`  All credentials present: ${HAS_PRODUCTION_CREDENTIALS ? '? YES' : '? NO'}`)
console.log(`  Real credentials (not sandbox): ${HAS_REAL_CREDENTIALS ? '? YES' : '? NO'}`)
console.log(`?????????????????????????????????????????????`)

if (MPESA_CONFIG.isSandbox) {
  console.log(`\n?? SANDBOX MODE (Auto-detected)`)
  console.log(`   Reason: Real credentials not provided`)
  console.log(`   Action: Set CONSUMER_KEY, CONSUMER_SECRET, PASSKEY, SHORTCODE in Render`)
  console.log(`   Result: STK prompts will NOT reach actual phones`)
} else {
  console.log(`\n?? PRODUCTION MODE (Auto-detected)`)
  console.log(`   Reason: Real credentials detected`)
  console.log(`   Result: Real STK prompts WILL be sent to M-Pesa`)
}

console.log(`\n?? M-PESA CONFIGURATION`)
console.log(`?????????????????????????????????????????????`)
console.log(`Mode: ${MPESA_CONFIG.isSandbox ? 'SANDBOX ??' : 'PRODUCTION ??'}`)
console.log(`Environment: ${NODE_ENV === 'production' ? 'PRODUCTION (Render)' : 'DEVELOPMENT'}`)
console.log(`Callback URL: ${MPESA_CONFIG.callbackUrl}`)
console.log(`Till Number: ${MPESA_CONFIG.tillNumber}`)
console.log(`?????????????????????????????????????????????\n`)

// Schema
const statusEnum = pgEnum('queue_status', ['waiting', 'serving', 'served', 'cancelled'])
const serviceEnum = pgEnum('service_type', ['registrar', 'finance', 'ict_helpdesk'])
const officeStatusEnum = pgEnum('office_status', ['open', 'closed'])
const mpesaStatusEnum = pgEnum('mpesa_status', ['pending', 'success', 'failed'])

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
  // Golden ticket fields
  isGolden: boolean('is_golden').notNull().default(false),
  goldenTicketRef: text('golden_ticket_ref'),
  mpesaTransactionId: text('mpesa_transaction_id'),
  mpesaStatus: mpesaStatusEnum('mpesa_status'),
  mpesaPaidAt: timestamp('mpesa_paid_at'),
  canUpgradeToGolden: boolean('can_upgrade_to_golden').notNull().default(true),
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

// Retry helper with exponential backoff
async function retryWithBackoff(fn, maxRetries = 2, context = '') {
  let lastError = null
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      console.log(`  [Attempt ${attempt}/${maxRetries + 1}] ${context}`)
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt <= maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000
        console.warn(`  ??  Failed: ${error.message}. Retrying in ${delay}ms...`)
        await new Promise(r => setTimeout(r, delay))
      }
    }
  }
  throw lastError
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
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    databaseConnected: !!db,
    database: {
      connected: false,
      tables: {},
      error: null
    }
  }

  if (db) {
    try {
      // Test basic connectivity
      await db.select(sql`1`)
      health.database.connected = true

      // Check table existence and row counts
      const tableChecks = [
        { name: 'offices', table: offices },
        { name: 'queue_entries', table: queueEntries },
        { name: 'staff_accounts', table: staffAccounts }
      ]

      for (const { name, table } of tableChecks) {
        try {
          const result = await db.select({ count: dbCount() }).from(table)
          health.database.tables[name] = {
            exists: true,
            rowCount: result[0]?.count ?? 0
          }
        } catch (err) {
          health.database.tables[name] = {
            exists: false,
            error: err.message
          }
        }
      }

      // If we have the offices table, try to get a sample
      if (health.database.tables.offices?.exists && health.database.tables.offices?.rowCount > 0) {
        try {
          const sampleOffice = await db.select().from(offices).limit(1)
          health.database.sampleOfficeData = sampleOffice[0] ? {
            id: sampleOffice[0].id,
            name: sampleOffice[0].name,
            serviceType: sampleOffice[0].serviceType
          } : null
        } catch (err) {
          health.database.sampleOfficeError = err.message
        }
      }
    } catch (err) {
      health.database.connected = false
      health.database.error = err.message
    }
  }

  res.json(health)
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
        isGolden: queueEntries.isGolden,
        goldenTicketRef: queueEntries.goldenTicketRef,
        mpesaStatus: queueEntries.mpesaStatus,
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
    const office = await db.select({
      id: offices.id,
      name: offices.name,
      serviceType: offices.serviceType,
      status: offices.status,
      username: offices.username,
      password: offices.password,
      createdAt: offices.createdAt,
      createdBy: offices.createdBy,
    }).from(offices).where(eq(offices.serviceType, serviceType)).limit(1).then((rows) => rows[0] || null)
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
    console.log(`INFO: Next queue number for ${serviceType}: ${nextQueueNumber}`)

    // GOLDEN TICKET LOGIC: Disable golden upgrade on all previous tickets by this student
    // Golden ticket opportunity only applies to the most recent ticket
    await db
      .update(queueEntries)
      .set({ canUpgradeToGolden: false })
      .where(eq(queueEntries.studentId, studentId))
    
    console.log(`INFO: Disabled golden upgrade for all previous tickets by ${studentId}`)

    // Create new entry with canUpgradeToGolden=true (this is the most recent ticket)
    const newEntry = await db
      .insert(queueEntries)
      .values({
        name,
        studentId,
        serviceType,
        queueNumber: nextQueueNumber,
        status: 'waiting',
        officeId,
        canUpgradeToGolden: true, // New ticket is eligible for golden upgrade
      })
      .returning()

    console.log('SUCCESS: Queue entry created:', newEntry[0])
    console.log('INFO: New ticket is eligible for golden upgrade')
    
    res.status(201).json({
      ...newEntry[0],
      goldenTicketEligible: true,
      message: 'You can upgrade this ticket to a Golden Ticket for priority access!'
    })
  } catch (error) {
    console.error('ERROR: Error creating queue entry:', error.message)
    console.error('STACK:', error.stack)
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

    // Get start and end of today - use ISO strings for database compatibility
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfDay = new Date(startOfDay)
    endOfDay.setDate(endOfDay.getDate() + 1)
    
    const startISO = startOfDay.toISOString()
    const endISO = endOfDay.toISOString()

    const tickets = await db
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
          eq(queueEntries.studentId, studentId),
          sql`${queueEntries.createdAt} >= ${startISO}::timestamp`,
          sql`${queueEntries.createdAt} < ${endISO}::timestamp`
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

    const officesList = await db.select({
      id: offices.id,
      name: offices.name,
      serviceType: offices.serviceType,
      status: offices.status,
      username: offices.username,
      password: offices.password,
      createdAt: offices.createdAt,
      createdBy: offices.createdBy,
    }).from(offices)
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

    const office = await db.select({
      id: offices.id,
      name: offices.name,
      serviceType: offices.serviceType,
      status: offices.status,
      username: offices.username,
      password: offices.password,
      createdAt: offices.createdAt,
      createdBy: offices.createdBy,
    }).from(offices).where(eq(offices.id, officeId)).limit(1).then((rows) => rows[0] || null)
    if (!office) {
      return res.status(404).json({ error: 'Office not found' })
    }

    const defaultCredentialsMatch = username === 'office_staff' && password === '123'
    const officeCredentialsMatch = office.username === username && office.password === password
    const staff = await db.select({
      id: staffAccounts.id,
      officeId: staffAccounts.officeId,
      username: staffAccounts.username,
      password: staffAccounts.password,
      hasAdminPrivilege: staffAccounts.hasAdminPrivilege,
      createdAt: staffAccounts.createdAt,
      createdBy: staffAccounts.createdBy,
    }).from(staffAccounts).where(eq(staffAccounts.username, username)).limit(1).then((rows) => rows[0] || null)
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
    const office = await db.select({
      id: offices.id,
      name: offices.name,
      serviceType: offices.serviceType,
      status: offices.status,
      username: offices.username,
      password: offices.password,
      createdAt: offices.createdAt,
      createdBy: offices.createdBy,
    }).from(offices).where(eq(offices.id, officeId)).limit(1).then((rows) => rows[0] || null)
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
      const office = await db.select({
        id: offices.id,
        name: offices.name,
        serviceType: offices.serviceType,
        status: offices.status,
        username: offices.username,
        password: offices.password,
        createdAt: offices.createdAt,
        createdBy: offices.createdBy,
      }).from(offices).where(eq(offices.id, officeId)).limit(1).then((rows) => rows[0] || null)
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

      // Get next waiting - PRIORITY: Golden tickets with successful payment first
      let waiting = await db
        .select({
          id: queueEntries.id,
          name: queueEntries.name,
          studentId: queueEntries.studentId,
          serviceType: queueEntries.serviceType,
          queueNumber: queueEntries.queueNumber,
          status: queueEntries.status,
          createdAt: queueEntries.createdAt,
          servedAt: queueEntries.servedAt,
          isGolden: queueEntries.isGolden,
          goldenTicketRef: queueEntries.goldenTicketRef,
          mpesaStatus: queueEntries.mpesaStatus,
        })
        .from(queueEntries)
        .where(
          and(
            eq(queueEntries.serviceType, serviceType),
            eq(queueEntries.status, 'waiting'),
            eq(queueEntries.isGolden, true),
            eq(queueEntries.mpesaStatus, 'success'),
          ),
        )
        .orderBy(asc(queueEntries.createdAt))
        .limit(1)

      // If no golden tickets, get regular waiting entry
      if (waiting.length === 0) {
        waiting = await db
          .select({
            id: queueEntries.id,
            name: queueEntries.name,
            studentId: queueEntries.studentId,
            serviceType: queueEntries.serviceType,
            queueNumber: queueEntries.queueNumber,
            status: queueEntries.status,
            createdAt: queueEntries.createdAt,
            servedAt: queueEntries.servedAt,
            isGolden: queueEntries.isGolden,
            goldenTicketRef: queueEntries.goldenTicketRef,
            mpesaStatus: queueEntries.mpesaStatus,
          })
          .from(queueEntries)
          .where(
            and(
              eq(queueEntries.serviceType, serviceType),
              eq(queueEntries.status, 'waiting'),
            ),
          )
          .orderBy(asc(queueEntries.queueNumber))
          .limit(1)
      }

      if (waiting.length === 0) {
        console.log('â¹ï¸  No more entries in queue for service:', serviceType)
        return res.json({ message: 'No more in queue' })
      }

      const updated = await db
        .update(queueEntries)
        .set({ status: 'serving' })
        .where(eq(queueEntries.id, waiting[0].id))
        .returning()

      const ticketLabel = updated[0].isGolden && updated[0].mpesaStatus === 'success' 
        ? `${updated[0].queueNumber}✨ (GOLDEN TICKET)` 
        : updated[0].queueNumber.toString()

      console.log('Serving next ticket:', updated[0], '- Label:', ticketLabel)
      res.json({ ...updated[0], ticketLabel })
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
      .where(eq(queueEntries.status, 'served'))
      .orderBy(desc(queueEntries.servedAt))

    res.json(served)
  } catch (error) {
    console.error('Error fetching report:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ============= GOLDEN TICKET & M-PESA ENDPOINTS =============
// Note: M-Pesa routes are registered from mpesa.js module

// POST /api/queue/golden-ticket - Mark ticket as golden (for track page)
app.post('/api/queue/golden-ticket', async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not ready' })
    
    const { queueId, action } = req.body

    if (!queueId) {
      return res.status(400).json({ error: 'Missing queue ID' })
    }

    if (action !== 'mark-golden') {
      return res.status(400).json({ error: 'Invalid action' })
    }

    // Get queue entry
    const entry = await db
      .select()
      .from(queueEntries)
      .where(eq(queueEntries.id, Number(queueId)))
      .limit(1)
      .then(rows => rows[0] || null)

    if (!entry) {
      return res.status(404).json({ error: 'Queue entry not found' })
    }

    // Check if already golden
    if (entry.isGolden) {
      return res.status(429).json({ 
        error: 'Already a golden ticket',
        message: `This ticket is already marked as golden (${entry.goldenTicketRef})`
      })
    }

    // Generate golden ticket reference
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const sequence = await db
      .select({ count: sql`cast(count(*) as integer)` })
      .from(queueEntries)
      .where(and(
        eq(queueEntries.serviceType, entry.serviceType),
        eq(queueEntries.isGolden, true),
        sql`DATE(${queueEntries.createdAt}) = CURRENT_DATE`
      ))
      .then(rows => (rows[0]?.count ?? 0) + 1)

    const serviceCode = entry.serviceType === 'registrar' ? 'REG' : entry.serviceType === 'finance' ? 'FIN' : 'ICT'
    const goldenRef = `GT-${serviceCode}-${date}-${String(sequence).padStart(3, '0')}`

    // Update entry to mark as golden
    await db.update(queueEntries)
      .set({
        isGolden: true,
        goldenTicketRef: goldenRef,
        mpesaStatus: 'pending',
      })
      .where(eq(queueEntries.id, Number(queueId)))

    console.log(`? Ticket ${queueId} marked as golden: ${goldenRef}`)

    return res.json({
      success: true,
      message: 'Golden ticket activated. Proceed to payment.',
      goldenTicketData: {
        id: entry.id,
        goldenTicketRef: goldenRef,
        queueNumber: entry.queueNumber,
        amount: 50,
      },
    })
  } catch (error) {
    console.error('Error marking golden ticket:', error)
    return res.status(500).json({ error: 'Failed to process golden ticket request', details: error.message })
  }
})

// POST /api/queue/mpesa - Initiate M-Pesa payment (for track page)
app.post('/api/queue/mpesa', async (req, res) => {
  try {
    if (!db) return res.status(503).json({ error: 'Database not ready' })
    
    const { action, queueId, phoneNumber, amount, goldenRef } = req.body

    if (action !== 'initiate-payment') {
      return res.status(400).json({ error: 'Invalid action' })
    }

    if (!queueId || !phoneNumber || !goldenRef) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Validate phone number
    const normalizedPhone = phoneNumber.replace(/\D/g, '')
    if (!normalizedPhone.match(/^254\d{9}$/)) {
      return res.status(400).json({ error: 'Invalid phone number format' })
    }

    // Get queue entry
    const entry = await db
      .select()
      .from(queueEntries)
      .where(eq(queueEntries.id, Number(queueId)))
      .limit(1)
      .then(rows => rows[0] || null)

    if (!entry) {
      return res.status(404).json({ error: 'Queue entry not found' })
    }

    if (!entry.isGolden) {
      return res.status(400).json({ error: 'Ticket is not marked as golden' })
    }

    // Proceed with M-Pesa payment
    const timestamp = new Date().toISOString()
      .replace(/[-:T.]/g, '').substring(0, 14)
    
    const shortCode = MPESA_CONFIG.isSandbox ? '174379' : MPESA_CONFIG.businessShortCode
    const passkey = MPESA_CONFIG.isSandbox ? MPESA_CONFIG.sandboxPasskey : MPESA_CONFIG.passkey
    const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64')
    const baseUrl = MPESA_CONFIG.isSandbox 
      ? 'https://sandbox.safaricom.co.ke'
      : 'https://api.safaricom.co.ke'

    // Get access token
    const auth = Buffer.from(`${MPESA_CONFIG.consumerKey}:${MPESA_CONFIG.consumerSecret}`).toString('base64')
    const tokenRes = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      method: 'GET',
      headers: { Authorization: `Basic ${auth}` },
      timeout: 10000,
    })

    if (!tokenRes.ok) {
      throw new Error('Failed to get M-Pesa access token')
    }

    const tokenData = await tokenRes.json()
    const token = tokenData.access_token

    // Initiate STK push
    const stkRes = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount || 50,
        PartyA: normalizedPhone,
        PartyB: shortCode,
        PhoneNumber: normalizedPhone,
        CallBackURL: MPESA_CONFIG.callbackUrl,
        AccountReference: goldenRef,
        TransactionDesc: `Golden Ticket - ${goldenRef}`,
      }),
      timeout: 10000,
    })

    const stkData = await stkRes.json()

    if (stkData.ResponseCode === '0') {
      // Update transaction ID
      await db.update(queueEntries)
        .set({
          mpesaTransactionId: stkData.CheckoutRequestID,
          mpesaStatus: 'pending',
        })
        .where(eq(queueEntries.id, Number(queueId)))

      console.log(`? STK Push initiated for queue ${queueId}: ${stkData.CheckoutRequestID}`)

      return res.json({
        success: true,
        message: 'M-Pesa prompt sent to your phone',
        checkoutRequestId: stkData.CheckoutRequestID,
      })
    } else {
      return res.status(400).json({
        error: stkData.ResponseDescription || 'Failed to initiate payment',
      })
    }
  } catch (error) {
    console.error('Error initiating M-Pesa payment:', error)
    return res.status(500).json({ error: 'Failed to initiate payment', details: error.message })
  }
})

// GET /api/queue/:id/mpesa-status - Check M-Pesa payment status for a queue entry
app.get('/api/queue/:id/mpesa-status', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not ready' })
    }

    const id = Number(req.params.id)
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid queue entry ID' })
    }

    console.log(`?? Checking M-Pesa status for queue entry ${id}`)

    const entry = await db
      .select({
        id: queueEntries.id,
        isGolden: queueEntries.isGolden,
        mpesaStatus: queueEntries.mpesaStatus,
        mpesaTransactionId: queueEntries.mpesaTransactionId,
        mpesaPaidAt: queueEntries.mpesaPaidAt,
        goldenTicketRef: queueEntries.goldenTicketRef,
        status: queueEntries.status,
      })
      .from(queueEntries)
      .where(eq(queueEntries.id, id))
      .limit(1)
      .then(rows => rows[0] || null)

    if (!entry) {
      return res.status(404).json({ error: 'Queue entry not found' })
    }

    // Log status
    if (entry.mpesaStatus === 'success') {
      console.log(`? M-Pesa Payment SUCCESS for queue ${id}: ${entry.goldenTicketRef}`)
    } else if (entry.mpesaStatus === 'failed') {
      console.log(`? M-Pesa Payment FAILED for queue ${id}`)
    } else {
      console.log(`? M-Pesa Payment PENDING for queue ${id} (waiting for callback)`)
    }

    res.status(200).json(entry)
  } catch (error) {
    console.error('? Error checking M-Pesa status:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/mpesa/callback-status - Fallback endpoint for callback status (by CheckoutRequestID)
app.get('/api/mpesa/callback-status', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not ready' })
    }

    const checkoutRequestId = req.query.checkoutRequestId
    
    if (!checkoutRequestId) {
      return res.status(400).json({ error: 'Missing checkoutRequestId parameter' })
    }

    console.log(`?? Callback status check: ${checkoutRequestId}`)

    // Look up queue entry by checkout request ID (stored as mpesaTransactionId)
    const entry = await db
      .select({
        id: queueEntries.id,
        isGolden: queueEntries.isGolden,
        mpesaStatus: queueEntries.mpesaStatus,
        mpesaTransactionId: queueEntries.mpesaTransactionId,
        mpesaPaidAt: queueEntries.mpesaPaidAt,
        goldenTicketRef: queueEntries.goldenTicketRef,
        status: queueEntries.status,
      })
      .from(queueEntries)
      .where(eq(queueEntries.mpesaTransactionId, checkoutRequestId))
      .limit(1)
      .then(rows => rows[0] || null)

    if (!entry) {
      // Not found yet - callback may still be in flight
      console.log(`? No entry found yet for: ${checkoutRequestId}`)
      return res.status(404).json({ 
        error: 'Transaction not found', 
        checkoutRequestId 
      })
    }

    // Found - return current status
    if (entry.mpesaStatus === 'success') {
      console.log(`? Payment SUCCESS: ${entry.goldenTicketRef}`)
    } else if (entry.mpesaStatus === 'failed') {
      console.log(`? Payment FAILED: ${checkoutRequestId}`)
    } else {
      console.log(`? Payment PENDING: ${checkoutRequestId}`)
    }

    res.status(200).json({
      success: true,
      queueId: entry.id,
      isGolden: entry.isGolden,
      mpesaStatus: entry.mpesaStatus,
      mpesaTransactionId: entry.mpesaTransactionId,
      goldenTicketRef: entry.goldenTicketRef,
      mpesaPaidAt: entry.mpesaPaidAt,
      status: entry.status,
    })
  } catch (error) {
    console.error('? Error checking callback status:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/queue/mpesa-callback - Health check / endpoint verification
app.get('/api/queue/mpesa-callback', (req, res) => {
  console.log('INFO: GET /api/queue/mpesa-callback - Health check')
  res.status(200).json({
    status: 'ok',
    message: 'M-Pesa callback endpoint is live',
    method: 'POST',
    note: 'This endpoint accepts POST requests from M-Pesa with callback data',
  })
})

// POST /api/queue/mpesa-callback - Handle M-Pesa callback
app.post('/api/queue/mpesa-callback', async (req, res) => {
  try {
    if (!db) {
      console.error('🚨 Database not ready for callback')
      return res.status(503).json({ error: 'Service unavailable' })
    }

    const callbackBody = req.body

    console.log('📞 M-Pesa Callback received:', JSON.stringify(callbackBody, null, 2))

    // Extract callback data
    const stkCallback = callbackBody?.Body?.stkCallback || {}
    const { ResultCode, CheckoutRequestID, CallbackMetadata } = stkCallback
    const ResultDesc = stkCallback.ResultDesc || 'Unknown result'

    if (!CheckoutRequestID) {
      console.warn('⚠️ No CheckoutRequestID in callback')
      return res.status(200).json({ success: false }) // Must return 200 to acknowledge
    }

    // Extract metadata
    let transactionDetails = {}
    if (CallbackMetadata?.Item) {
      CallbackMetadata.Item.forEach(item => {
        transactionDetails[item.Name] = item.Value
      })
    }

    // Find queue entry by CheckoutRequestID
    // Method 1: Direct lookup (production M-Pesa format: ws_CO_*)
    let entry = await db
      .select()
      .from(queueEntries)
      .where(eq(queueEntries.mpesaTransactionId, CheckoutRequestID))
      .limit(1)
      .then(rows => rows[0] || null)
    
    // Method 2: Parse SANDBOX format (test format: SANDBOX_{id}_{timestamp})
    if (!entry && CheckoutRequestID.startsWith('SANDBOX_')) {
      const parts = CheckoutRequestID.split('_')
      const id = parseInt(parts[1], 10)
      if (!isNaN(id)) {
        entry = await db
          .select()
          .from(queueEntries)
          .where(eq(queueEntries.id, id))
          .limit(1)
          .then(rows => rows[0] || null)
      }
    }

    if (!entry) {
      console.warn(`No queue entry for: ${CheckoutRequestID}`)
      return res.status(200).json({ success: false })
    }

    // Handle payment result
    if (ResultCode === 0) {
      // Payment successful
      const receiptNumber = transactionDetails['MpesaReceiptNumber'] || 'UNKNOWN'
      const amount = transactionDetails['Amount'] || 0
      
      const date = new Date().toISOString().split('T')[0].replace(/-/g, '')
      const sequence = await db
        .select({ count: sql`cast(count(*) as integer)` })
        .from(queueEntries)
        .where(and(
          eq(queueEntries.serviceType, entry.serviceType),
          eq(queueEntries.isGolden, true),
          sql`DATE(${queueEntries.createdAt}) = CURRENT_DATE`
        ))
        .then(rows => (rows[0]?.count ?? 0) + 1)

      const goldenTicketRef = `GT-${entry.serviceType.toUpperCase().substring(0, 3)}-${date}-${String(sequence).padStart(3, '0')}`

      // Update queue entry
      await db
        .update(queueEntries)
        .set({
          isGolden: true,
          goldenTicketRef,
          mpesaTransactionId: receiptNumber,
          mpesaStatus: 'success',
          mpesaPaidAt: new Date(),
        })
        .where(eq(queueEntries.id, entry.id))

      console.log(`✅ Golden ticket activated: ${goldenTicketRef} (Receipt: ${receiptNumber}, Amount: KES ${amount})`)
    } else {
      // Payment failed
      await db
        .update(queueEntries)
        .set({
          mpesaStatus: 'failed',
        })
        .where(eq(queueEntries.id, entry.id))

      console.log(`Payment failed: ${ResultDesc}`)
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ success: true })
  } catch (error) {
    console.error('Error processing M-Pesa callback:', error)
    res.status(200).json({ success: false }) // Return 200 even on error to prevent M-Pesa retries
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

  // Register M-Pesa routes
  registerMpesaRoutes(app, { db, tickets: queueEntries })

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

// Diagnostic function to check database tables on startup
async function runStartupDiagnostics() {
  if (!db) return
  
  try {
    console.log('\n📊 Database Startup Diagnostics:')
    
    const tables = [
      { name: 'offices', table: offices },
      { name: 'queue_entries', table: queueEntries },
      { name: 'staff_accounts', table: staffAccounts }
    ]
    
    for (const { name, table } of tables) {
      try {
        const result = await db.select({ count: dbCount() }).from(table)
        const rowCount = result[0]?.count ?? 0
        console.log(`  ✓ ${name}: ${rowCount} rows`)
        
        // Extra check: if offices table is empty, warn about it
        if (name === 'offices' && rowCount === 0) {
          console.warn(`  ⚠️  WARNING: offices table is empty! API will fail without office data.`)
        }
      } catch (err) {
        console.error(`  ✗ ${name}: TABLE NOT FOUND or ERROR - ${err.message}`)
      }
    }
    console.log('')
  } catch (err) {
    console.error('⚠️  Could not run startup diagnostics:', err.message)
  }
}

startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})



