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
    console.log('📊 Database URL:', DATABASE_URL.split('@')[1] || 'local')
    
    // Get all migration folders
    const migrationsDir = path.join(__dirname, '../drizzle')
    const migrationFolders = await readdir(migrationsDir)
    
    console.log(`📁 Found ${migrationFolders.length} items in migrations directory`)
    
    let executedCount = 0
    for (const folder of migrationFolders.sort()) {
      if (folder === 'meta' || folder.startsWith('.')) {
        console.log(`  ⊘ Skipping: ${folder}`)
        continue
      }
      
      const sqlFile = path.join(migrationsDir, folder, 'migration.sql')
      try {
        const sqlContent = await readFile(sqlFile, 'utf-8')
        if (sqlContent.trim()) {
          console.log(`  📝 Running migration: ${folder}`)
          
          // Split by statement-breakpoint comment and execute each statement
          const statements = sqlContent
            .split('--> statement-breakpoint')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'))
          
          let statementCount = 0
          for (const statement of statements) {
            try {
              await client.unsafe(statement)
              statementCount++
            } catch (err) {
              // Ignore "already exists" errors - they mean migrations already applied
              if (err.message.includes('already exists') || 
                  err.message.includes('duplicate key') ||
                  err.message.includes('relation') && err.message.includes('already exists')) {
                console.log(`    ℹ️  Statement already applied (skipped)`)
              } else {
                console.error(`    ❌ Statement error: ${err.message}`)
                throw err
              }
            }
          }
          console.log(`    ✓ Executed ${statementCount} statements`)
          executedCount++
        }
      } catch (err) {
        console.error(`  ❌ Migration ${folder} failed:`, err.message)
        throw err
      }
    }
    
    await client.end()
    console.log(`✓ Migrations completed successfully (${executedCount} migrations executed)`)
    process.exit(0)
  } catch (error) {
    console.error('❌ Migration error:', error.message)
    console.error('Stack:', error.stack)
    await client.end()
    process.exit(1)
  }
}

runMigrations()
