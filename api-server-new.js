import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Database Connection with retry logic
let db = null
let connectionAttempts = 0
const maxRetries = 5

async function initializeDatabase() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.warn('⚠️  DATABASE_URL not set - database features will be unavailable')
    return false
  }

  try {
    const client = postgres(connectionString, {
      max: 10,
      idle_timeout: 30,
      connect_timeout: 10,
    })

    // Test connection
    await client`SELECT 1`
    db = drizzle(client)
    connectionAttempts = 0
    console.log(`✓ Database: Connected and ready`)
    return true
  } catch (error) {
    connectionAttempts++
    console.error(`❌ Database connection failed (attempt ${connectionAttempts}/${maxRetries}): ${error.message}`)
    
    if (connectionAttempts < maxRetries) {
      await new Promise(r => setTimeout(r, 2000))
      return initializeDatabase()
    }
    return false
  }
}

// Express app setup
const app = express()
const PORT = process.env.PORT || 3000
const NODE_ENV = process.env.NODE_ENV || 'development'

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
    ]

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
  const staticPath = path.join(__dirname, 'dist')
  console.log(`📁 Serving static files from: ${staticPath}`)
  app.use(express.static(staticPath, { 
    maxAge: '1h',
    etag: false
  }))
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(), 
    environment: NODE_ENV,
    databaseConnected: !!db
  })
})

// Dynamic route handler for TanStack Start routes
// This loads route handlers from src/routes/api/* and src/routes/admin/*
async function loadRoutes() {
  try {
    // Import route handlers
    // For development, these need to be compiled TypeScript
    // In production, they come from dist/
    
    // Import queue routes
    const queueModule = await import('./src/routes/api/queue.ts')
    const queueIdModule = await import('./src/routes/api/queue/$id.ts')
    const ticketHistoryModule = await import('./src/routes/api/ticketHistory.ts')
    const serveModule = await import('./src/routes/admin/serve.ts')
    const reportModule = await import('./src/routes/admin/report.ts')

    // Wrap route handlers to work with Express
    const wrapHandler = (handler) => async (req, res) => {
      try {
        const response = await handler(new Request(
          new URL(`http://localhost${req.originalUrl}`),
          {
            method: req.method,
            headers: new Headers(req.headers),
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
          }
        ))
        
        const contentType = response.headers.get('content-type')
        const data = contentType?.includes('application/json') 
          ? await response.json() 
          : await response.text()
        
        res.status(response.status)
        response.headers.forEach((value, name) => {
          if (name !== 'content-length') res.set(name, value)
        })
        
        if (contentType?.includes('application/json')) {
          res.json(data)
        } else {
          res.send(data)
        }
      } catch (error) {
        console.error('Route handler error:', error)
        res.status(500).json({ error: 'Internal server error' })
      }
    }

    // Mount queue routes
    app.get('/api/queue', wrapHandler(queueModule.GET))
    app.post('/api/queue', wrapHandler(queueModule.POST))
    app.get('/api/queue/:id', wrapHandler(queueIdModule.GET))
    
    // Mount ticket history route
    app.get('/api/ticketHistory', wrapHandler(ticketHistoryModule.GET))
    
    // Mount admin routes
    app.post('/api/admin/serve', wrapHandler(serveModule.POST))
    app.get('/api/admin/report', wrapHandler(reportModule.GET))

    console.log('✓ All route handlers loaded')
  } catch (error) {
    console.warn('⚠️  Could not dynamically load routes:', error.message)
    console.warn('Routes will need to be served from built dist/ folder')
  }
}

// SPA fallback - serve index.html for all unknown routes
app.get('*', (req, res) => {
  // Skip non-GET requests (they're API calls that didn't match above)
  if (req.method !== 'GET') {
    return res.status(404).json({ error: 'Not found' })
  }

  if (NODE_ENV === 'production') {
    const indexPath = path.join(__dirname, 'dist', 'index.html')
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('Error serving index.html:', err)
        res.status(500).json({ error: 'Failed to serve application' })
      }
    })
  } else {
    res.status(404).json({ error: 'Not found' })
  }
})

// Error handler
app.use((err, req, res, next) => {
  console.error('Express error:', err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

// Start server
async function startServer() {
  // Initialize database (non-blocking)
  initializeDatabase().catch(err => {
    console.error('Fatal database error:', err)
  })

  // Load route handlers
  await loadRoutes()

  // Start HTTP server
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✓ Backend server running on port ${PORT}`)
    console.log(`✓ Environment: ${NODE_ENV}`)
    console.log(`✓ API endpoints available at http://localhost:${PORT}/api/*`)
    console.log(`\n`)
  })
}

startServer().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})
