import postgres from 'postgres'
import { readdir, readFile } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function runMigrations() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL not set')
    process.exit(1)
  }

  const client = postgres(DATABASE_URL)

  try {
    console.log('🔄 Running database migrations...')
    
    // Get all migration folders
    const migrationsDir = path.join(__dirname, '../drizzle')
    const migrationFolders = await readdir(migrationsDir)
    
    let executedCount = 0
    for (const folder of migrationFolders.sort()) {
      const sqlFile = path.join(migrationsDir, folder, 'migration.sql')
      try {
        const sqlContent = await readFile(sqlFile, 'utf-8')
        if (sqlContent.trim()) {
          console.log(`  📝 Running migration: ${folder}`)
          
          // Split by statement-breakpoint comment and execute each statement
          const statements = sqlContent
            .split('--> statement-breakpoint')
            .map(s => s.trim())
            .filter(s => s.length > 0)
          
          for (const statement of statements) {
            try {
              await client.unsafe(statement)
            } catch (err) {
              // Ignore "already exists" errors - they mean migrations already applied
              if (!err.message.includes('already exists') && 
                  !err.message.includes('ENOENT') &&
                  !err.message.includes('duplicate')) {
                throw err
              }
            }
          }
          executedCount++
        }
      } catch (err) {
        console.warn(`  ⚠️  Migration ${folder}:`, err.message)
      }
    }
    
    await client.end()
    console.log(`✓ Migrations completed (${executedCount} migrations processed)`)
  } catch (error) {
    console.error('❌ Migration error:', error.message)
    await client.end()
    process.exit(1)
  }
}

runMigrations()
