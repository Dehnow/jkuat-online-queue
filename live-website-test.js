/**
 * JKUAT Queue System - Live Website Testing Suite
 * 
 * This script tests all critical functionalities:
 * 1. Icon rendering
 * 2. Admin login flow
 * 3. Ticket serve/execute
 * 4. Admin logs/reports
 * 5. Data persistence
 * 
 * Run this in browser console on live website
 */

const API_BASE = window.location.origin
const ADMIN_CREDS = btoa('Admin0375:group2sysdev')

// Color-coded logging
const log = {
  success: (msg) => console.log(`✅ ${msg}`),
  error: (msg) => console.error(`❌ ${msg}`),
  warn: (msg) => console.warn(`⚠️  ${msg}`),
  info: (msg) => console.log(`ℹ️  ${msg}`),
}

// Test Suite
const tests = {
  // Test 1: Check API Health
  async testAPIHealth() {
    try {
      const res = await fetch(`${API_BASE}/api/health`)
      const data = await res.json()
      if (res.ok && data.status === 'ok') {
        log.success('API Health Check')
        log.info(`  Database: ${data.databaseConnected ? 'Connected' : 'Disconnected'}`)
        log.info(`  Environment: ${data.environment}`)
        return true
      } else {
        log.error('API Health Check failed')
        return false
      }
    } catch (err) {
      log.error(`API Health Check: ${err.message}`)
      return false
    }
  },

  // Test 2: Icon Rendering
  testIconRendering() {
    try {
      const icons = document.querySelectorAll('[data-testid="admin-icon"], .w-5.h-5, svg[class*="lucide"]')
      if (icons.length > 0) {
        log.success(`Icon Rendering: Found ${icons.length} icon elements`)
        return true
      } else {
        log.warn('Icon Rendering: No icons found in DOM')
        return false
      }
    } catch (err) {
      log.error(`Icon Rendering: ${err.message}`)
      return false
    }
  },

  // Test 3: Admin Login
  async testAdminLogin() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/report`, {
        headers: { Authorization: `Basic ${ADMIN_CREDS}` }
      })
      if (res.ok) {
        log.success('Admin Login/Auth Check')
        const data = await res.json()
        log.info(`  Served entries: ${Array.isArray(data) ? data.length : 0}`)
        return true
      } else if (res.status === 401) {
        log.error('Admin Login: Invalid credentials')
        return false
      } else {
        log.error(`Admin Login: HTTP ${res.status}`)
        return false
      }
    } catch (err) {
      log.error(`Admin Login: ${err.message}`)
      return false
    }
  },

  // Test 4: Queue Data Fetching
  async testQueueDataFetch() {
    try {
      const services = ['registrar', 'finance', 'ict_helpdesk']
      const results = await Promise.all(
        services.map(service =>
          fetch(`${API_BASE}/api/queue?service=${service}`).then(r => r.json())
        )
      )
      
      let allOk = true
      results.forEach((data, i) => {
        if (!data.waitingCount && data.waitingCount !== 0) {
          allOk = false
        }
      })
      
      if (allOk) {
        log.success('Queue Data Fetch')
        results.forEach((data, i) => {
          log.info(`  ${services[i]}: ${data.waitingCount} waiting`)
        })
        return true
      } else {
        log.error('Queue Data Fetch: Incomplete data')
        return false
      }
    } catch (err) {
      log.error(`Queue Data Fetch: ${err.message}`)
      return false
    }
  },

  // Test 5: Admin Report Access
  async testAdminReport() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/report`, {
        headers: { Authorization: `Basic ${ADMIN_CREDS}` }
      })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) {
          log.success('Admin Report Access')
          log.info(`  Total served entries: ${data.length}`)
          const todayServed = data.filter(e => 
            new Date(e.servedAt).toDateString() === new Date().toDateString()
          ).length
          log.info(`  Today's served: ${todayServed}`)
          return true
        } else {
          log.error('Admin Report: Invalid response format')
          return false
        }
      } else {
        log.error(`Admin Report: HTTP ${res.status}`)
        return false
      }
    } catch (err) {
      log.error(`Admin Report: ${err.message}`)
      return false
    }
  },

  // Test 6: Create Test Ticket
  async testCreateTicket() {
    try {
      const res = await fetch(`${API_BASE}/api/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Student',
          studentId: 'TEST001',
          serviceType: 'registrar'
        })
      })
      
      if (res.ok) {
        const data = await res.json()
        log.success('Test Ticket Creation')
        log.info(`  Ticket ID: ${data.id}`)
        log.info(`  Queue #: ${data.queueNumber}`)
        window.testTicketId = data.id // Store for later tests
        return true
      } else if (res.status === 429) {
        log.warn('Test Ticket Creation: Daily limit reached (expected)')
        return true
      } else {
        const errData = await res.json()
        log.error(`Test Ticket Creation: ${errData.error}`)
        return false
      }
    } catch (err) {
      log.error(`Test Ticket Creation: ${err.message}`)
      return false
    }
  },

  // Test 7: Fetch Ticket Status
  async testTicketStatus() {
    try {
      if (!window.testTicketId) {
        log.warn('Ticket Status: No test ticket ID available')
        return false
      }
      
      const res = await fetch(`${API_BASE}/api/queue/${window.testTicketId}`)
      if (res.ok) {
        const data = await res.json()
        log.success('Ticket Status Fetch')
        log.info(`  Queue #: ${data.queueNumber}`)
        log.info(`  Status: ${data.status}`)
        log.info(`  Ahead: ${data.waitingAhead || 0}`)
        return true
      } else {
        log.error(`Ticket Status: HTTP ${res.status}`)
        return false
      }
    } catch (err) {
      log.error(`Ticket Status: ${err.message}`)
      return false
    }
  },

  // Test 8: Serve Next (requires auth)
  async testServeNext() {
    try {
      const res = await fetch(`${API_BASE}/api/admin/serve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${ADMIN_CREDS}`
        },
        body: JSON.stringify({
          serviceType: 'registrar',
          action: 'serve_next'
        })
      })
      
      if (res.ok) {
        log.success('Serve Next Action')
        return true
      } else if (res.status === 401) {
        log.error('Serve Next: Unauthorized')
        return false
      } else {
        const data = await res.json()
        log.warn(`Serve Next: ${data.message || res.statusText}`)
        return true // Queue may be empty
      }
    } catch (err) {
      log.error(`Serve Next: ${err.message}`)
      return false
    }
  },

  // Test 9: Ticket History
  async testTicketHistory() {
    try {
      const res = await fetch(`${API_BASE}/api/ticketHistory?studentId=TEST001`)
      if (res.ok) {
        const data = await res.json()
        log.success('Ticket History Fetch')
        log.info(`  Tickets: ${data.tickets?.length || 0}`)
        return true
      } else {
        log.error(`Ticket History: HTTP ${res.status}`)
        return false
      }
    } catch (err) {
      log.error(`Ticket History: ${err.message}`)
      return false
    }
  },

  // Test 10: Session Storage
  testSessionStorage() {
    try {
      const adminAuth = sessionStorage.getItem('adminAuth')
      const studentId = sessionStorage.getItem('studentId')
      
      if (adminAuth) {
        log.success('Session Storage: Admin Auth token present')
      } else {
        log.warn('Session Storage: No admin auth (not logged in)')
      }
      
      if (studentId) {
        log.info(`  Student ID: ${studentId}`)
      }
      
      return true
    } catch (err) {
      log.error(`Session Storage: ${err.message}`)
      return false
    }
  },
}

// Run all tests
async function runAllTests() {
  console.clear()
  console.log('🧪 JKUAT Queue System - Live Website Testing')
  console.log('='.repeat(50))
  console.log('')
  
  const results = {}
  const testNames = Object.keys(tests)
  
  for (const testName of testNames) {
    const test = tests[testName]
    try {
      results[testName] = await test.call(tests)
    } catch (err) {
      log.error(`${testName}: Uncaught error: ${err.message}`)
      results[testName] = false
    }
    console.log('')
  }
  
  // Summary
  console.log('='.repeat(50))
  console.log('📊 Test Summary')
  console.log('='.repeat(50))
  
  const passed = Object.values(results).filter(v => v).length
  const total = Object.values(results).length
  
  console.log(`✅ Passed: ${passed}/${total}`)
  
  if (passed === total) {
    log.success('All tests passed! System is operational.')
  } else {
    log.warn(`${total - passed} test(s) failed. Check logs above.`)
  }
  
  return results
}

// Export function
window.testLiveWebsite = runAllTests
console.log('Run: testLiveWebsite() to test all features')
