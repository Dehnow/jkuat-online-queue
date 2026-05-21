import fetch from 'node-fetch'

const BASE_URL = process.env.API_URL || 'http://localhost:3000'
const ADMIN_CREDENTIALS = Buffer.from('Admin0375:group2sysdev').toString('base64')

// Test results tracking
let passed = 0
let failed = 0
const results = []

function logResult(test, success, message) {
  const status = success ? '✅ PASS' : '❌ FAIL'
  const output = `${status}: ${test} - ${message}`
  console.log(output)
  results.push({ test, success, message })
  if (success) passed++; else failed++
}

async function runTests() {
  console.log('\n🧪 JKUAT Queue System - Resilience Testing Suite')
  console.log('================================================\n')
  console.log(`API Base URL: ${BASE_URL}\n`)

  // Test 1: Health Check
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { timeout: 5000 })
    const data = await res.json()
    logResult('Health Check', res.ok && data.status === 'ok', `Status: ${data.status}`)
  } catch (e) {
    logResult('Health Check', false, e.message)
  }

  // Test 2: Database Health Check
  try {
    const res = await fetch(`${BASE_URL}/api/health/db`, { timeout: 5000 })
    const data = await res.json()
    logResult('DB Health Check', res.ok && data.status !== 'unhealthy', `DB Status: ${data.status}`)
  } catch (e) {
    logResult('DB Health Check', false, e.message)
  }

  // Test 3: Invalid Service Parameter
  try {
    const res = await fetch(`${BASE_URL}/api/queue?service=invalid`, { timeout: 5000 })
    logResult('Invalid Service Validation', res.status === 400, `Status: ${res.status}`)
  } catch (e) {
    logResult('Invalid Service Validation', false, e.message)
  }

  // Test 4: Missing Service Parameter
  try {
    const res = await fetch(`${BASE_URL}/api/queue`, { timeout: 5000 })
    logResult('Missing Service Validation', res.status === 400, `Status: ${res.status}`)
  } catch (e) {
    logResult('Missing Service Validation', false, e.message)
  }

  // Test 5: Get Queue Status - Registrar
  try {
    const res = await fetch(`${BASE_URL}/api/queue?service=registrar`, { timeout: 5000 })
    const data = await res.json()
    logResult('Get Queue Status - Registrar', res.ok && data.waitingCount !== undefined, `Waiting: ${data.waitingCount}`)
  } catch (e) {
    logResult('Get Queue Status - Registrar', false, e.message)
  }

  // Test 6: Get Queue Status - Finance
  try {
    const res = await fetch(`${BASE_URL}/api/queue?service=finance`, { timeout: 5000 })
    const data = await res.json()
    logResult('Get Queue Status - Finance', res.ok && data.waitingCount !== undefined, `Waiting: ${data.waitingCount}`)
  } catch (e) {
    logResult('Get Queue Status - Finance', false, e.message)
  }

  // Test 7: Get Queue Status - ICT
  try {
    const res = await fetch(`${BASE_URL}/api/queue?service=ict_helpdesk`, { timeout: 5000 })
    const data = await res.json()
    logResult('Get Queue Status - ICT', res.ok && data.waitingCount !== undefined, `Waiting: ${data.waitingCount}`)
  } catch (e) {
    logResult('Get Queue Status - ICT', false, e.message)
  }

  // Test 8: Create Ticket - Valid Request
  let createdTicketId = null
  try {
    const res = await fetch(`${BASE_URL}/api/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '+254700000001',
        studentId: 'TEST-001',
        serviceType: 'registrar'
      }),
      timeout: 5000
    })
    const data = await res.json()
    createdTicketId = data.id
    logResult('Create Ticket - Valid Request', res.status === 201 && data.id, `Ticket ID: ${data.id}`)
  } catch (e) {
    logResult('Create Ticket - Valid Request', false, e.message)
  }

  // Test 9: Get Ticket Details
  if (createdTicketId) {
    try {
      const res = await fetch(`${BASE_URL}/api/queue/${createdTicketId}`, { timeout: 5000 })
      const data = await res.json()
      logResult('Get Ticket Details', res.ok && data.id === createdTicketId, `Status: ${data.status}`)
    } catch (e) {
      logResult('Get Ticket Details', false, e.message)
    }
  }

  // Test 10: Create Ticket - Missing Fields
  try {
    const res = await fetch(`${BASE_URL}/api/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '+254700000002'
        // missing studentId and serviceType
      }),
      timeout: 5000
    })
    logResult('Create Ticket - Missing Fields Validation', res.status === 400, `Status: ${res.status}`)
  } catch (e) {
    logResult('Create Ticket - Missing Fields Validation', false, e.message)
  }

  // Test 11: Create Ticket - Invalid Service Type
  try {
    const res = await fetch(`${BASE_URL}/api/queue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '+254700000003',
        studentId: 'TEST-003',
        serviceType: 'invalid_service'
      }),
      timeout: 5000
    })
    logResult('Create Ticket - Invalid Service Validation', res.status === 400, `Status: ${res.status}`)
  } catch (e) {
    logResult('Create Ticket - Invalid Service Validation', false, e.message)
  }

  // Test 12: Get Ticket History
  try {
    const res = await fetch(`${BASE_URL}/api/ticketHistory?studentId=TEST-001`, { timeout: 5000 })
    const data = await res.json()
    logResult('Get Ticket History', res.ok && Array.isArray(data.tickets), `Tickets: ${data.tickets?.length || 0}`)
  } catch (e) {
    logResult('Get Ticket History', false, e.message)
  }

  // Test 13: Get Ticket History - Missing StudentId
  try {
    const res = await fetch(`${BASE_URL}/api/ticketHistory`, { timeout: 5000 })
    const data = await res.json()
    logResult('Get Ticket History - Missing StudentId', res.status === 400, `Status: ${res.status}`)
  } catch (e) {
    logResult('Get Ticket History - Missing StudentId', false, e.message)
  }

  // Test 14: Get Invalid Ticket ID
  try {
    const res = await fetch(`${BASE_URL}/api/queue/invalid-id`, { timeout: 5000 })
    logResult('Get Invalid Ticket ID', res.status === 400, `Status: ${res.status}`)
  } catch (e) {
    logResult('Get Invalid Ticket ID', false, e.message)
  }

  // Test 15: Get Non-Existent Ticket
  try {
    const res = await fetch(`${BASE_URL}/api/queue/999999`, { timeout: 5000 })
    logResult('Get Non-Existent Ticket', res.status === 404, `Status: ${res.status}`)
  } catch (e) {
    logResult('Get Non-Existent Ticket', false, e.message)
  }

  // Test 16: Admin Report - Without Auth
  try {
    const res = await fetch(`${BASE_URL}/api/admin/report`, { timeout: 5000 })
    logResult('Admin Report - Without Auth', res.status === 401, `Status: ${res.status}`)
  } catch (e) {
    logResult('Admin Report - Without Auth', false, e.message)
  }

  // Test 17: Admin Report - With Auth
  try {
    const res = await fetch(`${BASE_URL}/api/admin/report`, {
      headers: { Authorization: `Basic ${ADMIN_CREDENTIALS}` },
      timeout: 5000
    })
    const data = await res.json()
    logResult('Admin Report - With Auth', res.ok && Array.isArray(data.entries || data), `Found ${(data.entries || data)?.length || 0} entries`)
  } catch (e) {
    logResult('Admin Report - With Auth', false, e.message)
  }

  // Test 18: Admin Serve - Invalid Action
  try {
    const res = await fetch(`${BASE_URL}/api/admin/serve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${ADMIN_CREDENTIALS}`
      },
      body: JSON.stringify({
        serviceType: 'registrar',
        action: 'invalid_action'
      }),
      timeout: 5000
    })
    logResult('Admin Serve - Invalid Action', res.status === 400, `Status: ${res.status}`)
  } catch (e) {
    logResult('Admin Serve - Invalid Action', false, e.message)
  }

  // Test 19: Admin Serve - Serve Next
  try {
    const res = await fetch(`${BASE_URL}/api/admin/serve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${ADMIN_CREDENTIALS}`
      },
      body: JSON.stringify({
        serviceType: 'registrar',
        action: 'serve_next'
      }),
      timeout: 5000
    })
    logResult('Admin Serve - Serve Next', res.ok || res.status === 404, `Status: ${res.status}`)
  } catch (e) {
    logResult('Admin Serve - Serve Next', false, e.message)
  }

  // Test 20: Response includes RequestId
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { timeout: 5000 })
    const requestId = res.headers.get('x-request-id')
    logResult('Response includes RequestId', !!requestId, `RequestId: ${requestId}`)
  } catch (e) {
    logResult('Response includes RequestId', false, e.message)
  }

  // Print summary
  console.log('\n================================================')
  console.log(`📊 Test Summary: ${passed}/${passed + failed} tests passed`)
  if (failed > 0) {
    console.log(`⚠️  ${failed} tests failed`)
  } else {
    console.log('✅ All tests passed!')
  }
  console.log('================================================\n')

  process.exit(failed > 0 ? 1 : 0)
}

// Run tests
runTests().catch(err => {
  console.error('Test runner error:', err)
  process.exit(1)
})
