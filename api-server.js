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
const NODE_ENV = process.env.NODE_ENV || 'development'
const PORT = process.env.PORT || 3000

// Startup validation
console.log('🚀 JKUAT Queue System - Startup Initialization')
console.log(`📋 Environment: ${NODE_ENV}`)
console.log(`🔌 Port: ${PORT}`)
console.log(`📦 Node Version: ${process.version}`)

if (NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  console.error('❌ FATAL: DATABASE_URL environment variable is not set!')
  console.error('❌ Cannot start in production without database connection.')
  console.error('Please ensure DATABASE_URL is configured in your environment.')
  process.exit(1)
}

if (NODE_ENV === 'production') {
  console.log('✓ DATABASE_URL is configured')
} else {
  console.warn('⚠️  Development mode: DATABASE_URL may not be required for local testing')
}

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
    console.log('📡 Postgres client connecting...')
    const client = postgres(connectionString, {
      max: 10, // Connection pool size
      idle_timeout: 30,
      connect_timeout: 10,
      onnotice: (notice) => {
        if (notice.severity !== 'NOTICE') {
          console.warn('🔔 Database Notice:', notice.message)
        }
      }
    })

    // Test connection
    console.log('🧪 Testing database connection...')
    const testResult = await client`SELECT 1 as connection_test`
    console.log('✓ Database connection test passed:', testResult)
    
    // Initialize Drizzle with only table schema (enums are defined within tables)
    console.log('🔗 Initializing Drizzle ORM...')
    db = drizzle(client, { schema: { queueEntries } })
    connectionAttempts = 0
    console.log('✓ Drizzle ORM initialized successfully')
    
    // Verify table exists
    console.log('📊 Verifying queue_entries table exists...')
    const tableCheck = await client`SELECT COUNT(*) as count FROM information_schema.tables WHERE table_name='queue_entries'`
    console.log('✓ Table verification:', tableCheck)
    
    return true
  } catch (error) {
    connectionAttempts++
    console.error(`❌ Database connection error (attempt ${connectionAttempts}):`, error)
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
        console.warn(`⚠️  CORS request from unauthorized origin: ${origin}`)
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

// Global error handling middleware for JSON parsing
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('JSON parse error:', err)
    return res.status(400).json({ error: 'Invalid JSON in request body' })
  }
  next()
})

// Request validation middleware
function validateRequest(schema) {
  return (req, res, next) => {
    try {
      const errors = []
      
      for (const [field, rules] of Object.entries(schema)) {
        const value = req.body[field] || req.query[field]
        
        if (rules.required && (value === undefined || value === null || value === '')) {
          errors.push(`${field} is required`)
        }
        
        if (value && rules.type === 'string' && typeof value !== 'string') {
          errors.push(`${field} must be a string`)
        }
        
        if (value && rules.type === 'number' && isNaN(value)) {
          errors.push(`${field} must be a number`)
        }
        
        if (rules.enum && value && !rules.enum.includes(value)) {
          errors.push(`${field} must be one of: ${rules.enum.join(', ')}`)
        }
        
        if (rules.minLength && value && value.length < rules.minLength) {
          errors.push(`${field} must be at least ${rules.minLength} characters`)
        }
        
        if (rules.maxLength && value && value.length > rules.maxLength) {
          errors.push(`${field} must be at most ${rules.maxLength} characters`)
        }
      }
      
      if (errors.length > 0) {
        return res.status(400).json({ error: 'Validation failed', details: errors })
      }
      
      next()
    } catch (err) {
      console.error('Validation middleware error:', err)
      res.status(500).json({ error: 'Validation error' })
    }
  }
}

// Request correlation ID middleware for logging
app.use((req, res, next) => {
  req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  res.setHeader('X-Request-ID', req.id)
  next()
})

// Rate limiting map (in-memory, resets on server restart)
const rateLimitMap = new Map()
const RATE_LIMIT_WINDOW = 60000 // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30 // max 30 requests per minute per IP

function checkRateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress
  const now = Date.now()
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, { count: 1, window: now })
    return next()
  }
  
  const record = rateLimitMap.get(ip)
  if (now - record.window > RATE_LIMIT_WINDOW) {
    record.count = 1
    record.window = now
    return next()
  }
  
  record.count++
  if (record.count > RATE_LIMIT_MAX_REQUESTS) {
    return res.status(429).json({ 
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: Math.ceil((record.window + RATE_LIMIT_WINDOW - now) / 1000)
    })
  }
  
  next()
}

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
      status: 'INITIALIZING',
      requestId: req.id
    })
  }
  
  next()
})

// Apply rate limiting to queue creation endpoint
app.use('/api/queue', checkRateLimit)

// Serve static files in production
if (NODE_ENV === 'production') {
  const staticPath = path.join(__dirname, 'dist')
  console.log(`📁 Serving static files from: ${staticPath}`)
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

// Database operation wrapper with comprehensive error logging
async function safeDbQuery(requestId, operation, description) {
  try {
    console.log(`[${requestId}] 🔍 Executing: ${description}`)
    const result = await operation()
    console.log(`[${requestId}] ✓ Query successful: ${description}`)
    return result
  } catch (error) {
    console.error(`[${requestId}] ❌ Database query failed: ${description}`)
    console.error(`[${requestId}] Error type:`, error.constructor.name)
    console.error(`[${requestId}] Error message:`, error.message)
    console.error(`[${requestId}] Error code:`, error.code)
    if (error.detail) console.error(`[${requestId}] Error detail:`, error.detail)
    if (error.hint) console.error(`[${requestId}] Error hint:`, error.hint)
    throw error
  }
}

// Routes

// Health check - returns immediately, doesn't require database
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(), 
    environment: NODE_ENV,
    databaseConnected: !!db,
    uptime: process.uptime()
  })
})

// Connection health check endpoint (checks DB connectivity)
app.get('/api/health/db', async (req, res) => {
  const requestId = req.id
  try {
    if (!db) {
      return res.status(503).json({ 
        status: 'disconnected',
        databaseConnected: false,
        requestId
      })
    }

    // Try a simple query to verify connection
    await db.select({ count: sql`cast(count(*) as integer)` })
      .from(queueEntries)
      .limit(1)
      .catch(err => {
        console.error(`[${requestId}] Health check query failed:`, err)
        throw err
      })

    res.json({ 
      status: 'healthy',
      databaseConnected: true,
      requestId
    })
  } catch (error) {
    console.error(`[${requestId}] Database health check failed:`, error.message)
    res.status(503).json({ 
      status: 'unhealthy',
      databaseConnected: false,
      error: error.message,
      requestId
    })
  }
})

// GET /api/queue - Get queue stats for a service
app.get('/api/queue', async (req, res) => {
  const requestId = req.id
  try {
    if (!db) {
      console.warn(`[${requestId}] ⚠️  Database not initialized`)
      return res.status(503).json({ 
        error: 'Database not ready',
        requestId
      })
    }

    const { service } = req.query

    if (!service) {
      console.warn(`[${requestId}] ⚠️  Missing service parameter`)
      return res.status(400).json({ 
        error: 'Missing service parameter',
        requestId
      })
    }

    // Validate service
    const validServices = ['registrar', 'finance', 'ict_helpdesk']
    if (!validServices.includes(service)) {
      console.warn(`[${requestId}] ⚠️  Invalid service: ${service}`)
      return res.status(400).json({ 
        error: 'Invalid service parameter',
        validServices,
        requestId
      })
    }

    try {
      const waitingCount = await safeDbQuery(
        requestId,
        () => db
          .select({ count: sql`cast(count(*) as integer)` })
          .from(queueEntries)
          .where(
            and(
              eq(queueEntries.serviceType, service),
              eq(queueEntries.status, 'waiting'),
            ),
          )
          .then((res) => res[0]?.count ?? 0),
        `Count waiting entries for ${service}`
      )

      const serving = await safeDbQuery(
        requestId,
        () => db
          .select()
          .from(queueEntries)
          .where(
            and(
              eq(queueEntries.serviceType, service),
              eq(queueEntries.status, 'serving'),
            ),
          )
          .limit(1)
          .then((res) => res[0] || null),
        `Fetch serving entry for ${service}`
      )

      console.log(`[${requestId}] ✓ Queue stats - waiting: ${waitingCount}, serving: ${serving?.queueNumber || 'none'}`)
      res.json({ waitingCount, serving, requestId })
    } catch (dbError) {
      console.error(`[${requestId}] Database query failed:`, dbError.message)
      res.status(500).json({ 
        error: 'Failed to fetch queue',
        message: 'Could not retrieve queue information. Please try again.',
        requestId
      })
    }
  } catch (error) {
    console.error(`[${requestId}] Unhandled error in GET /api/queue:`, error.message)
    res.status(500).json({ 
      error: 'Internal server error',
      requestId
    })
  }
})

// POST /api/queue - Create new queue entry
app.post('/api/queue', async (req, res) => {
  const requestId = req.id
  try {
    if (!db) {
      console.error(`[${requestId}] ❌ Database not initialized for POST /api/queue`)
      return res.status(503).json({ 
        error: 'Database not ready',
        requestId,
        retryAfter: 5
      })
    }

    const { name, studentId, serviceType } = req.body
    
    // Validate inputs
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Invalid name provided', requestId })
    }
    
    if (!studentId || typeof studentId !== 'string' || studentId.trim().length === 0) {
      return res.status(400).json({ error: 'Invalid student ID provided', requestId })
    }
    
    if (!serviceType || typeof serviceType !== 'string') {
      return res.status(400).json({ error: 'Invalid service type provided', requestId })
    }

    // Validate service type
    const validServices = ['registrar', 'finance', 'ict_helpdesk']
    if (!validServices.includes(serviceType)) {
      console.warn(`[${requestId}] ⚠️  Invalid service type: ${serviceType}`)
      return res.status(400).json({ 
        error: 'Invalid service type',
        validServices,
        requestId
      })
    }

    const trimmedName = name.trim()
    const trimmedStudentId = studentId.trim()
    
    console.log(`[${requestId}] 📝 Creating queue entry:`, { trimmedName, trimmedStudentId, serviceType })

    try {
      // Server-side validation: Check daily limit (3 active tickets per student)
      const activeCount = await db
        .select({ count: sql`cast(count(*) as integer)` })
        .from(queueEntries)
        .where(
          and(
            eq(queueEntries.studentId, trimmedStudentId),
            eq(queueEntries.status, 'waiting')
          )
        )
        .then((res) => res[0]?.count ?? 0)
        .catch(err => {
          console.error(`[${requestId}] Error checking active count:`, err)
          throw err
        })

      console.log(`[${requestId}] 📊 Student ${trimmedStudentId} active tickets: ${activeCount}`)

      if (activeCount >= 3) {
        return res.status(429).json({ 
          error: 'Daily limit reached',
          message: 'You have reached the maximum of 3 active tickets. Wait for one to be served.',
          requestId
        })
      }

      // Get next queue number with error handling
      const lastEntry = await db
        .select({ maxQueue: queueEntries.queueNumber })
        .from(queueEntries)
        .where(eq(queueEntries.serviceType, serviceType))
        .orderBy(desc(queueEntries.queueNumber))
        .limit(1)
        .then((res) => res[0])
        .catch(err => {
          console.error(`[${requestId}] Error fetching last entry:`, err)
          throw err
        })

      const nextQueueNumber = (lastEntry?.maxQueue ?? 0) + 1
      console.log(`[${requestId}] 🔢 Next queue number for ${serviceType}: ${nextQueueNumber}`)

      // Create the entry with comprehensive error handling
      const newEntry = await db
        .insert(queueEntries)
        .values({
          name: trimmedName,
          studentId: trimmedStudentId,
          serviceType,
          queueNumber: nextQueueNumber,
          status: 'waiting',
        })
        .returning()
        .catch(err => {
          console.error(`[${requestId}] Error inserting queue entry:`, err)
          throw err
        })

      if (!newEntry || newEntry.length === 0) {
        console.error(`[${requestId}] ❌ Failed to create queue entry - no returned data`)
        return res.status(500).json({ 
          error: 'Failed to create ticket',
          message: 'Could not create queue entry. Please try again.',
          requestId
        })
      }

      console.log(`[${requestId}] ✅ Queue entry created:`, newEntry[0])
      res.status(201).json({
        ...newEntry[0],
        requestId
      })
    } catch (dbError) {
      console.error(`[${requestId}] ❌ Database operation failed:`, dbError.message)
      console.error(`[${requestId}] 📋 Stack trace:`, dbError.stack)
      
      // Check if it's a connection error vs other error
      if (dbError.message.includes('connection') || dbError.message.includes('pool')) {
        return res.status(503).json({ 
          error: 'Database connection issue',
          message: 'Service is temporarily unavailable. Please try again in a few moments.',
          requestId,
          retryAfter: 10
        })
      }
      
      return res.status(500).json({ 
        error: 'Failed to create ticket',
        message: 'An error occurred while creating your ticket. Please try again.',
        requestId
      })
    }
  } catch (error) {
    console.error(`[${requestId}] ❌ Unhandled error in POST /api/queue:`, error.message)
    console.error(`[${requestId}] 📋 Stack trace:`, error.stack)
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.',
      requestId
    })
  }
})

// GET /api/queue/:id - Get queue entry details
app.get('/api/queue/:id', async (req, res) => {
  const requestId = req.id
  try {
    if (!db) {
      return res.status(503).json({ 
        error: 'Database not ready',
        requestId
      })
    }

    const { id } = req.params

    // Validate ID is a number
    const entryId = parseInt(id)
    if (isNaN(entryId)) {
      return res.status(400).json({ 
        error: 'Invalid queue entry ID',
        requestId
      })
    }

    try {
      const entry = await db
        .select()
        .from(queueEntries)
        .where(eq(queueEntries.id, entryId))
        .limit(1)
        .then((res) => res[0] || null)
        .catch(err => {
          console.error(`[${requestId}] Error fetching entry:`, err)
          throw err
        })

      if (!entry) {
        return res.status(404).json({ 
          error: 'Queue entry not found',
          requestId
        })
      }

      // Calculate waiting ahead with error handling
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
        .catch(err => {
          console.error(`[${requestId}] Error counting ahead:`, err)
          // Return 0 as fallback to avoid complete failure
          return 0
        })

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
        .catch(err => {
          console.error(`[${requestId}] Error fetching serving entry:`, err)
          // Continue without serving info if error
          return null
        })

      res.json({
        ...entry,
        waitingAhead: ahead,
        currentlyServing: serving?.queueNumber || null,
        requestId
      })
    } catch (dbError) {
      console.error(`[${requestId}] Database query failed:`, dbError.message)
      res.status(500).json({ 
        error: 'Failed to fetch queue entry',
        requestId
      })
    }
  } catch (error) {
    console.error(`[${requestId}] Unhandled error in GET /api/queue/:id:`, error.message)
    res.status(500).json({ 
      error: 'Internal server error',
      requestId
    })
  }
})

// GET /api/ticketHistory - Get student's ticket history
app.get('/api/ticketHistory', async (req, res) => {
  const requestId = req.id
  try {
    if (!db) {
      return res.status(503).json({ 
        error: 'Database not ready',
        tickets: [],
        requestId
      })
    }

    const { studentId } = req.query

    if (!studentId || typeof studentId !== 'string' || studentId.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Student ID is required',
        tickets: [],
        requestId
      })
    }

    try {
      const trimmedStudentId = studentId.trim()
      
      const tickets = await db
        .select()
        .from(queueEntries)
        .where(eq(queueEntries.studentId, trimmedStudentId))
        .orderBy(desc(queueEntries.createdAt))
        .limit(50)
        .catch(err => {
          console.error(`[${requestId}] Error fetching ticket history:`, err)
          throw err
        })

      res.json({
        tickets: (tickets || []).map(t => ({
          id: t.id,
          queueNumber: t.queueNumber,
          serviceType: t.serviceType,
          status: t.status,
          createdAt: t.createdAt,
          servedAt: t.servedAt,
        })),
        requestId
      })
    } catch (dbError) {
      console.error(`[${requestId}] Database query failed:`, dbError.message)
      res.status(500).json({ 
        error: 'Failed to fetch history',
        tickets: [],
        requestId
      })
    }
  } catch (error) {
    console.error(`[${requestId}] Unhandled error in GET /api/ticketHistory:`, error.message)
    res.status(500).json({ 
      error: 'Failed to fetch history',
      tickets: [],
      requestId
    })
  }
})

// POST /api/admin/serve - Admin actions (serve next, complete, cancel)
app.post('/api/admin/serve', checkAuth, async (req, res) => {
  const requestId = req.id
  try {
    if (!db) {
      console.error(`[${requestId}] ❌ Database not initialized for POST /api/admin/serve`)
      return res.status(503).json({ 
        error: 'Database not ready',
        requestId
      })
    }

    const { serviceType, action, entryId } = req.body
    
    // Validate inputs
    if (!serviceType || typeof serviceType !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid service type',
        requestId
      })
    }
    
    if (!action || typeof action !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid action',
        requestId
      })
    }
    
    const validActions = ['serve_next', 'complete', 'cancel']
    if (!validActions.includes(action)) {
      return res.status(400).json({ 
        error: `Invalid action. Must be one of: ${validActions.join(', ')}`,
        requestId
      })
    }
    
    if (action !== 'serve_next' && !entryId) {
      return res.status(400).json({ 
        error: 'Entry ID is required for this action',
        requestId
      })
    }

    console.log(`[${requestId}] 🔧 Admin action:`, { serviceType, action, entryId })

    try {
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
          .catch(err => {
            console.error(`[${requestId}] Error updating serving entry:`, err)
            throw err
          })

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
          .catch(err => {
            console.error(`[${requestId}] Error fetching waiting entries:`, err)
            throw err
          })

        if (waiting.length === 0) {
          console.log(`[${requestId}] ⏹️  No more entries in queue for service:`, serviceType)
          return res.json({ 
            message: 'No more in queue',
            requestId
          })
        }

        const updated = await db
          .update(queueEntries)
          .set({ status: 'serving' })
          .where(eq(queueEntries.id, waiting[0].id))
          .returning()
          .catch(err => {
            console.error(`[${requestId}] Error updating to serving:`, err)
            throw err
          })

        console.log(`[${requestId}] ✅ Serving next ticket:`, updated[0])
        res.json({
          ...updated[0],
          requestId
        })
      } else if (action === 'complete' && entryId) {
        const updated = await db
          .update(queueEntries)
          .set({ status: 'served', servedAt: new Date() })
          .where(eq(queueEntries.id, entryId))
          .returning()
          .catch(err => {
            console.error(`[${requestId}] Error completing entry:`, err)
            throw err
          })

        if (!updated || updated.length === 0) {
          return res.status(404).json({ 
            error: 'Entry not found',
            requestId
          })
        }

        console.log(`[${requestId}] ✅ Completed entry:`, updated[0])
        res.json({
          ...updated[0],
          requestId
        })
      } else if (action === 'cancel' && entryId) {
        const updated = await db
          .update(queueEntries)
          .set({ status: 'cancelled' })
          .where(eq(queueEntries.id, entryId))
          .returning()
          .catch(err => {
            console.error(`[${requestId}] Error cancelling entry:`, err)
            throw err
          })

        if (!updated || updated.length === 0) {
          return res.status(404).json({ 
            error: 'Entry not found',
            requestId
          })
        }

        console.log(`[${requestId}] ❌ Cancelled entry:`, updated[0])
        res.json({
          ...updated[0],
          requestId
        })
      } else {
        console.warn(`[${requestId}] ⚠️  Invalid admin action:`, action)
        res.status(400).json({ 
          error: 'Invalid action',
          requestId
        })
      }
    } catch (dbError) {
      console.error(`[${requestId}] Database operation failed:`, dbError.message)
      res.status(500).json({ 
        error: 'Failed to complete admin action',
        requestId
      })
    }
  } catch (error) {
    console.error(`[${requestId}] ❌ Unhandled error in POST /api/admin/serve:`, error.message)
    console.error(`[${requestId}] 📋 Stack trace:`, error.stack)
    res.status(500).json({ 
      error: 'Internal server error',
      requestId
    })
  }
})

// GET /api/admin/report - Get all served entries
app.get('/api/admin/report', checkAuth, async (req, res) => {
  const requestId = req.id
  try {
    if (!db) {
      return res.status(503).json({ 
        error: 'Database not ready',
        requestId
      })
    }

    try {
      const served = await db
        .select()
        .from(queueEntries)
        .where(eq(queueEntries.status, 'served'))
        .orderBy(desc(queueEntries.servedAt))
        .catch(err => {
          console.error(`[${requestId}] Error fetching report:`, err)
          throw err
        })

      res.json({
        entries: served || [],
        requestId
      })
    } catch (dbError) {
      console.error(`[${requestId}] Database query failed:`, dbError.message)
      res.status(500).json({ 
        error: 'Failed to fetch report',
        requestId
      })
    }
  } catch (error) {
    console.error(`[${requestId}] Unhandled error in GET /api/admin/report:`, error.message)
    res.status(500).json({ 
      error: 'Internal server error',
      requestId
    })
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
    console.log(`📄 Serving SPA fallback to ${req.path} from dist`)
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
  console.log('🚀 Starting server...')
  
  // Try to initialize database with timeout (max 30 seconds)
  let dbConnected = false
  try {
    console.log('📡 Attempting initial database connection...')
    const dbPromise = initializeDatabase()
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database connection timeout (30s)')), 30000)
    )
    
    await Promise.race([dbPromise, timeoutPromise])
    dbConnected = true
    console.log(`✓ Database: Connected and ready on startup`)
  } catch (error) {
    console.error('❌ Initial database connection failed:', error.message)
    console.warn('⚠️  Server will start but will attempt to reconnect...')
  }

  // Start the HTTP server
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✓ Backend server running on port ${PORT}`)
    console.log(`✓ Environment: ${NODE_ENV}`)
    console.log(`✓ API endpoints available at /api/*`)
    console.log(`✓ Database Status: ${dbConnected ? 'CONNECTED ✓' : 'CONNECTING... ⏳'}`)
    console.log(`\n`)
  })

  // If database not connected on startup, keep trying to reconnect
  if (!dbConnected) {
    const reconnectInterval = setInterval(async () => {
      try {
        console.log('🔄 Attempting database reconnection...')
        await initializeDatabase()
        console.log('✓ Database reconnected successfully!')
        clearInterval(reconnectInterval)
      } catch (e) {
        console.error('⏳ Reconnection attempt failed:', e.message, '(will retry in 10 seconds)')
      }
    }, 10000) // Try every 10 seconds instead of 30
  }
}

startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
