import postgres from 'postgres'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import dotenv from 'dotenv'

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function runMigration() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.error('❌ DATABASE_URL not set')
    process.exit(1)
  }

  const sql = postgres(connectionString)
  
  try {
    console.log('📝 Running migration to add office_id column...')
    
    // Check if column already exists
    const result = await sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'queue_entries' AND column_name = 'office_id'
      )
    `
    
    if (result[0].exists) {
      console.log('✓ Column office_id already exists')
      await sql.end()
      process.exit(0)
    }
    
    // Add the column
    await sql.unsafe(`ALTER TABLE "queue_entries" ADD COLUMN "office_id" integer`)
    console.log('✓ Migration completed: Added office_id column to queue_entries')
    
    await sql.end()
    process.exit(0)
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    await sql.end()
    process.exit(1)
  }
}

runMigration()
