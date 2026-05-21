import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq, and, asc, desc, count as dbCount, sql } from 'drizzle-orm'
import { pgTable, serial, text, timestamp, integer, pgEnum } from 'drizzle-orm/pg-core'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Schema
const statusEnum = pgEnum('queue_status', ['waiting', 'serving', 'served', 'cancelled'])
const serviceEnum = pgEnum('service_type', ['registrar', 'finance', 'ict_helpdesk'])

const queueEntries = pgTable('queue_entries', {
  id: serial().primaryKey(),
  name: text('name').notNull(),
  studentId: text('student_id').notNull(),
  serviceType: serviceEnum('service_type').notNull(),
  queueNumber: integer('queue_number').notNull(),
  status: statusEnum('status').notNull().default('waiting'),
  createdAt: timestamp('created_at').defaultNow(),
  servedAt: timestamp('served_at'),
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
    db = drizzle(client, { schema: { queueEntries, statusEnum, serviceEnum } })
    connectionAttempts = 0
    return true
  } catch (error) {
    connectionAttempts++
    throw new Error(`Database connection failed (attempt ${connectionAttempts}): ${error.message}`)
  }
}

// Express app
const app = express()
const PORT = process.env.PORT || 3000
const NODE_ENV = process.env.NODE_ENV || 'development'

// CORS configuration - handles both local and production
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
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
    ]

    // Add production URLs from environment
    if (process.env.FRONTEND_URL) {
      allowedOrigins.push(process.env.FRONTEND_URL)
    }

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('CORS not allowed'))
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}

app.use(cors(corsOptions))
app.use(express.json())

// Serve static files in production
if (NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')))
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
      .select()
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
      return res.status(503).json({ error: 'Database not ready' })
    }

    const { name, studentId, serviceType } = req.body

    if (!name || !studentId || !serviceType) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    // Validate service type
    const validServices = ['registrar', 'finance', 'ict_helpdesk']
    if (!validServices.includes(serviceType)) {
      return res.status(400).json({ error: 'Invalid service type' })
    }

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

    const newEntry = await db
      .insert(queueEntries)
      .values({
        name,
        studentId,
        serviceType,
        queueNumber: nextQueueNumber,
        status: 'waiting',
      })
      .returning()

    res.status(201).json(newEntry[0])
  } catch (error) {
    console.error('Error creating queue entry:', error)
    res.status(500).json({ error: 'Internal server error' })
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

// GET /api/ticketHistory - Get student's ticket history
app.get('/api/ticketHistory', async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not ready' })
    }

    const { studentId } = req.query

    if (!studentId || typeof studentId !== 'string') {
      return res.status(400).json({ error: 'Student ID is required', tickets: [] })
    }

    const tickets = await db
      .select()
      .from(queueEntries)
      .where(eq(queueEntries.studentId, studentId))
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

// POST /api/admin/serve - Admin actions (serve next, complete, cancel)
app.post('/api/admin/serve', checkAuth, async (req, res) => {
  try {
    if (!db) {
      return res.status(503).json({ error: 'Database not ready' })
    }

    const { serviceType, action, entryId } = req.body

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
        return res.json({ message: 'No more in queue' })
      }

      const updated = await db
        .update(queueEntries)
        .set({ status: 'serving' })
        .where(eq(queueEntries.id, waiting[0].id))
        .returning()

      res.json(updated[0])
    } else if (action === 'complete' && entryId) {
      const updated = await db
        .update(queueEntries)
        .set({ status: 'served', servedAt: new Date() })
        .where(eq(queueEntries.id, entryId))
        .returning()

      res.json(updated[0] || { error: 'Entry not found' })
    } else if (action === 'cancel' && entryId) {
      const updated = await db
        .update(queueEntries)
        .set({ status: 'cancelled' })
        .where(eq(queueEntries.id, entryId))
        .returning()

      res.json(updated[0] || { error: 'Entry not found' })
    } else {
      res.status(400).json({ error: 'Invalid action' })
    }
  } catch (error) {
    console.error('Error serving queue:', error)
    res.status(500).json({ error: 'Internal server error' })
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

// SPA fallback - serve index.html for all unknown routes in production
if (NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'))
  })
}

// Initialize database and start server
async function startServer() {
  // Start the HTTP server immediately - don't block on database
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✓ Backend server running on port ${PORT}`)
    console.log(`✓ Environment: ${NODE_ENV}`)
    console.log(`✓ API endpoints available at /api/*`)
    console.log(`\n`)
  })

  // Try to initialize database in the background with retries
  initializeDatabase()
    .then(() => {
      console.log(`✓ Database: Connected and ready`)
    })
    .catch((error) => {
      console.error('❌ Failed to connect to database:', error.message)
      console.error('⚠️  Server is still running, but database features are unavailable')
      console.error('Retries will continue in the background...')
      
      // Keep trying to reconnect every 30 seconds
      const reconnectInterval = setInterval(async () => {
        console.log('Attempting to reconnect to database...')
        try {
          await initializeDatabase()
          console.log('✓ Database reconnected successfully!')
          clearInterval(reconnectInterval)
        } catch (e) {
          console.error('Reconnection attempt failed:', e.message)
        }
      }, 30000)
    })
}

startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
