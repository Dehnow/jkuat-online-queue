import postgres from 'postgres'

const DATABASE_URL = 'postgresql://jkuat_online_queue_app_db_user:mRByUmadRQfoiizgW6tsYSEgJ35kisXK@dpg-d86dlln7f7vs7394snr0-a.singapore-postgres.render.com/jkuat_online_queue_app_db?sslmode=require'

const client = postgres(DATABASE_URL)

async function insertOffices() {
  try {
    console.log('Connecting to database...')
    
    // First, check if offices already exist
    const existing = await client`SELECT COUNT(*) as count FROM offices`
    console.log('Query result:', existing[0])
    const officeCount = Number(existing[0].count || 0)
    console.log('Current offices count:', officeCount)
    
    if (officeCount === 0) {
      console.log('Inserting default offices...')
      
      const result = await client`
        INSERT INTO offices (name, service_type, status, username, password, created_by)
        VALUES
          ('Registrar Main Office', 'registrar'::service_type, 'open'::office_status, 'registrar_staff', 'password123', 'Admin0375'),
          ('Finance Office', 'finance'::service_type, 'open'::office_status, 'finance_staff', 'password123', 'Admin0375'),
          ('ICT Helpdesk', 'ict_helpdesk'::service_type, 'open'::office_status, 'ict_staff', 'password123', 'Admin0375')
        RETURNING id, name, service_type, status
      `
      
      console.log('✓ Successfully inserted offices:')
      result.forEach(office => {
        console.log(`  - ${office.name} (${office.service_type}) - Status: ${office.status}`)
      })
    } else {
      console.log(`✓ Offices already exist (${officeCount} found)`)
    }
    
    // Verify the offices
    const offices = await client`SELECT id, name, service_type, status FROM offices`
    console.log(`\n✓ Total offices in database: ${offices.length}`)
    offices.forEach(office => {
      console.log(`  [${office.id}] ${office.name} - ${office.service_type} (${office.status})`)
    })
    
    await client.end()
    process.exit(0)
  } catch (error) {
    console.error('❌ Error:', error.message)
    await client.end()
    process.exit(1)
  }
}

insertOffices()
