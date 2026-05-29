import postgres from 'postgres'
import { readdir, readFile, stat } from 'fs/promises'
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
    console.log('📊 Connecting to database...')
    
    // Test connection
    await client`SELECT 1`
    console.log('✓ Database connection successful')
    
    // Get all migration folders and files
    const migrationsDir = path.join(__dirname, '../drizzle')
    const items = await readdir(migrationsDir)
    
    console.log(`📁 Found ${items.length} items in migrations directory`)
    
    let executedCount = 0
    let skippedCount = 0
    
    for (const item of items.sort()) {
      if (item === 'meta' || item.startsWith('.')) {
        console.log(`  ⊘ Skipping: ${item}`)
        skippedCount++
        continue
      }
      
      const itemPath = path.join(migrationsDir, item)
      const itemStat = await stat(itemPath)
      let sqlFile
      
      if (itemStat.isDirectory()) {
        sqlFile = path.join(itemPath, 'migration.sql')
      } else if (item.endsWith('.sql')) {
        sqlFile = itemPath
      } else {
        console.log(`  ⊘ Skipping (not a migration): ${item}`)
        skippedCount++
        continue
      }
      
      try {
        const sqlContent = await readFile(sqlFile, 'utf-8')
        if (sqlContent.trim()) {
          console.log(`  📝 Running migration: ${item}`)
          
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
                  err.message.includes('duplicate') ||
                  (err.message.includes('relation') && err.message.includes('already exists'))) {
                console.log(`    ℹ️  Already exists (skipped)`)
              } else if (err.message.includes('ENOENT') || err.message.includes('no such file')) {
                console.log(`    ℹ️  File not found (skipped)`)
              } else {
                console.error(`    ❌ Error: ${err.message}`)
                throw err
              }
            }
          }
          console.log(`    ✓ Executed ${statementCount} statements`)
          executedCount++
        }
      } catch (err) {
        if (!err.message.includes('ENOENT')) {
          console.error(`  ❌ Migration ${item} failed:`, err.message)
          throw err
        } else {
          console.log(`  ⊘ Skipping ${item} (file not found)`)
          skippedCount++
        }
      }
    }
    
    console.log(`\n✓ Migrations completed successfully`)
    console.log(`  - Executed: ${executedCount}`)
    console.log(`  - Skipped: ${skippedCount}`)
    
    await client.end()
    process.exit(0)
  } catch (error) {
    console.error('❌ Migration error:', error.message)
    await client.end()
    process.exit(1)
  }
}

runMigrations()
