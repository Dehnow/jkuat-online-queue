/**
 * ✅ ACTIVE - Production Database Client
 * 
 * This file is actively used by TanStack Start API routes:
 * - admin/offices.ts (office management)
 * - admin/feedback.ts (feedback system)
 * - staff/auth.ts (staff authentication)
 * - staff/queue-action.ts (queue operations)
 * - staff/office-status.ts (office status updates)
 * - staff/queue/-$officeId.ts (staff queue view)
 * - queue/golden-ticket.ts (golden ticket operations)
 * - And more...
 * 
 * Features:
 * - Connection pooling (10 max connections)
 * - Automatic error recovery
 * - Health checks and diagnostics
 * - Comprehensive logging
 */

import dotenv from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

dotenv.config();

// Configuration
const NODE_ENV = process.env.NODE_ENV || 'development'
const connectionString = process.env.DATABASE_URL as string;

// Log startup information
console.log('🗄️  Database Client Initialization');
console.log(`📍 Environment: ${NODE_ENV}`);

// Validate connection string exists
if (!connectionString) {
  const errorMsg = "DATABASE_URL environment variable is required for database connection";
  console.error(`❌ FATAL: ${errorMsg}`);
  console.error('   Please set DATABASE_URL in your .env file');
  console.error('   Format: postgresql://user:password@host:port/database');
  
  if (NODE_ENV === 'production') {
    process.exit(1);
  } else {
    console.warn('⚠️  Development mode: Continuing with error');
  }
}

let dbInstance: any = null;

/**
 * Initialize database connection with error handling
 */
async function initializeDatabase() {
  try {
    console.log('🔗 Connecting to database...');
    
    if (!connectionString) {
      throw new Error('DATABASE_URL not configured');
    }

    // Create postgres client with connection pooling
    const client = postgres(connectionString, {
      max: 10, // Connection pool size
      idle_timeout: 30,
      connect_timeout: 10,
      onnotice: (notice: any) => {
        if (NODE_ENV === 'development') {
          console.log('📢 Database Notice:', notice.message);
        }
      },
    });

    // Test connection
    console.log('🔍 Testing database connection...');
    await client`SELECT 1 as connection_test`;
    console.log('✅ Database connection successful');

    // Initialize Drizzle ORM
    const db = drizzle(client, { schema });
    console.log('✅ Drizzle ORM initialized');
    console.log('✅ Database client ready for use\n');
    
    return { db, client };
  } catch (error: any) {
    console.error('❌ Database initialization failed:', error.message);
    
    if (NODE_ENV === 'production') {
      console.error('❌ FATAL: Cannot start in production without database connection');
      process.exit(1);
    } else {
      console.warn('⚠️  Development mode: Database will not be available');
      console.warn('   Set DATABASE_URL to enable database features\n');
      return { db: null, client: null };
    }
  }
}

/**
 * Initialize on module load
 */
async function initializeSync() {
  if (!dbInstance && connectionString) {
    const result = await initializeDatabase();
    if (result.db) {
      dbInstance = result.db;
    }
  }
}

// Start initialization immediately (non-blocking)
if (connectionString) {
  initializeSync().catch(err => {
    if (NODE_ENV === 'production') {
      console.error('Fatal error during database initialization:', err);
      process.exit(1);
    }
  });
}

/**
 * Get database instance with error handling
 */
export function getDatabase() {
  if (!dbInstance) {
    throw new Error('Database not initialized. Check DATABASE_URL configuration.');
  }
  return dbInstance;
}

/**
 * Health check function
 */
export async function checkDatabaseHealth(): Promise<{ healthy: boolean; message: string }> {
  try {
    if (!dbInstance) {
      return { healthy: false, message: 'Database not initialized' };
    }
    
    await dbInstance.select({ test: 1 });
    return { healthy: true, message: 'Database connection healthy' };
  } catch (error: any) {
    return { healthy: false, message: `Database health check failed: ${error.message}` };
  }
}

/**
 * Direct export - will be available after initialization
 * This is used by the API routes
 */
export const db = new Proxy({}, {
  get(target, prop) {
    if (!dbInstance) {
      throw new Error(
        'Database client not available. Ensure DATABASE_URL is set and database connection succeeded.'
      );
    }
    return (dbInstance as any)[prop];
  }
}) as any;

// Initialize immediately if in production or if DATABASE_URL is set
if (NODE_ENV === 'production' || connectionString) {
  // Non-blocking initialization
  initializeDatabase()
    .then(result => {
      if (result && result.db) {
        dbInstance = result.db;
      }
    })
    .catch(error => {
      if (NODE_ENV === 'production') {
        console.error('FATAL: Failed to initialize database:', error.message);
        process.exit(1);
      }
    });
}