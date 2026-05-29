import postgres from 'postgres'

async function initializeData() {
  const DATABASE_URL = process.env.DATABASE_URL
  if (!DATABASE_URL) {
    console.log('ℹ️  DATABASE_URL not set - skipping data initialization')
    process.exit(0)
  }

  const client = postgres(DATABASE_URL)

  try {
    console.log('🔄 Initializing database with default data...')
    
    // Check if offices already have data
    const officesResult = await client`SELECT COUNT(*) as count FROM offices`
    const officeCount = officesResult[0]?.count ?? 0
    
    if (officeCount === 0) {
      console.log('  📝 Inserting default offices...')
      
      await client`
        INSERT INTO offices (name, service_type, status, username, password, created_by)
        VALUES
          ('Registrar Main Office', 'registrar'::service_type, 'open'::office_status, 'registrar_staff', 'password123', 'Admin0375'),
          ('Finance Office', 'finance'::service_type, 'open'::office_status, 'finance_staff', 'password123', 'Admin0375'),
          ('ICT Helpdesk', 'ict_helpdesk'::service_type, 'open'::office_status, 'ict_staff', 'password123', 'Admin0375')
      `
      console.log('  ✓ Default offices inserted successfully')
    } else {
      console.log(`  ℹ️  Offices already exist (${officeCount} offices found), skipping seed`)
    }
    
    // Verify tables exist and have data
    const totalQueues = await client`SELECT COUNT(*) as count FROM queue_entries`
    const totalStaff = await client`SELECT COUNT(*) as count FROM staff_accounts`
    
    console.log(`\n✓ Database Status:`)
    console.log(`  - Offices: ${officeCount}`)
    console.log(`  - Queue Entries: ${totalQueues[0]?.count ?? 0}`)
    console.log(`  - Staff Accounts: ${totalStaff[0]?.count ?? 0}`)
    
    await client.end()
    console.log('\n✓ Data initialization completed successfully')
    process.exit(0)
  } catch (error) {
    console.error('❌ Initialization error:', error.message)
    console.error('Stack:', error.stack)
    await client.end()
    process.exit(1)
  }
}

initializeData()
