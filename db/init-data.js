import 'dotenv/config'
import postgres from 'postgres'

async function initializeData() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) {
    console.log('ℹ️  DATABASE_URL not set - skipping data initialization')
    console.log('    (This is normal in development without .env)')
    process.exit(0)
  }

  console.log('✓ DATABASE_URL found in environment')
  const client = postgres(DATABASE_URL)

  try {
    console.log('\n🔄 Initializing database with default data...')
    
    // Check if offices already have data
    let officesCount = 0
    try {
      const officesResult = await client`SELECT COUNT(*) as count FROM offices`
      officesCount = officesResult[0]?.count ?? 0
    } catch (err) {
      console.error('⚠️  Could not query offices table:', err.message)
      console.error('    Table may not exist yet (migrations must run first)')
      throw err
    }
    
    if (officesCount === 0) {
      console.log('  📝 Inserting default offices (none found in database)...')
      
      try {
        await client`
          INSERT INTO offices (name, service_type, status, username, password, created_by)
          VALUES
            ('Registrar Main Office', 'registrar'::service_type, 'open'::office_status, 'registrar_staff', 'password123', 'Admin0375'),
            ('Finance Office', 'finance'::service_type, 'open'::office_status, 'finance_staff', 'password123', 'Admin0375'),
            ('ICT Helpdesk', 'ict_helpdesk'::service_type, 'open'::office_status, 'ict_staff', 'password123', 'Admin0375')
        `
        console.log('  ✓ Successfully inserted 3 default offices')
      } catch (err) {
        console.error('  ❌ Failed to insert default offices:', err.message)
        throw err
      }
    } else {
      console.log(`  ℹ️  Offices already exist (${officesCount} found), skipping seed`)
    }
    
    // Verify all tables and show statistics
    console.log('\n📊 Database Status After Initialization:')
    
    try {
      const queueCount = await client`SELECT COUNT(*) as count FROM queue_entries`
      const staffCount = await client`SELECT COUNT(*) as count FROM staff_accounts`
      const newOfficeCount = await client`SELECT COUNT(*) as count FROM offices`
      
      console.log(`  - Offices: ${newOfficeCount[0]?.count ?? 0}`)
      console.log(`  - Queue Entries: ${queueCount[0]?.count ?? 0}`)
      console.log(`  - Staff Accounts: ${staffCount[0]?.count ?? 0}`)
    } catch (err) {
      console.error('⚠️  Could not verify data:', err.message)
    }
    
    await client.end()
    console.log('\n✓ Data initialization completed successfully\n')
    process.exit(0)
  } catch (error) {
    console.error('\n❌ FATAL Initialization Error:', error.message)
    console.error('Stack:', error.stack)
    await client.end()
    process.exit(1)
  }
}

console.log('\n=== Data Initialization Script Started ===')
console.log(`Environment: ${process.env.NODE_ENV || 'not set'}`)
console.log(`Time: ${new Date().toISOString()}`)

initializeData()
