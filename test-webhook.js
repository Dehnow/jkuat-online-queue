#!/usr/bin/env node
/**
 * WEBHOOK TESTING & VERIFICATION UTILITY
 * 
 * This script helps test and verify that your M-Pesa webhook is correctly
 * configured and receiving callbacks from Safaricom.
 * 
 * USAGE:
 *   node test-webhook.js [command] [options]
 * 
 * COMMANDS:
 *   list           - List all pending M-Pesa transactions
 *   test-success   - Send a test success callback
 *   test-failed    - Send a test failed callback
 *   check-status   - Check callback status endpoint
 *   verify-endpoint - Verify webhook endpoint is accessible
 *   health         - Check backend health
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const DEPLOY_URL = process.env.DEPLOY_URL || 'https://jkuat-online-queue.onrender.com';

// Parse command line args
const command = process.argv[2] || 'help';
const arg1 = process.argv[3] || '';
const arg2 = process.argv[4] || '';

// Color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
};

function log(color, ...args) {
  console.log(`${colors[color]}${args.join(' ')}${colors.reset}`);
}

// Helper function to make HTTP requests
function makeRequest(targetUrl, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(targetUrl);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Add timeout
    options.timeout = 10000;

    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed, raw: data });
        } catch {
          resolve({ status: res.statusCode, body: data, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

// Command: Check backend health
async function cmdHealth() {
  log('cyan', '\n🏥 CHECKING BACKEND HEALTH...\n');

  try {
    // Try local first
    try {
      const res = await makeRequest(`${BACKEND_URL}/health`);
      log('green', '✅ LOCAL BACKEND HEALTH:');
      log('green', `   Status: ${res.status}`);
      log('green', `   Response:`, JSON.stringify(res.body, null, 2));
    } catch (e) {
      log('yellow', '⚠️  Local backend not responding');
    }

    // Try deployed
    try {
      const res = await makeRequest(`${DEPLOY_URL}/health`);
      log('green', '\n✅ DEPLOYED BACKEND HEALTH:');
      log('green', `   Status: ${res.status}`);
      log('green', `   Response:`, JSON.stringify(res.body, null, 2));
    } catch (e) {
      log('yellow', '⚠️  Deployed backend not responding');
    }
  } catch (error) {
    log('red', '❌ Error:', error.message);
  }
}

// Command: Verify webhook endpoint
async function cmdVerifyEndpoint() {
  log('cyan', '\n🌐 VERIFYING WEBHOOK ENDPOINT...\n');

  const endpoints = [
    `${BACKEND_URL}/api/queue/mpesa-callback`,
    `${DEPLOY_URL}/api/queue/mpesa-callback`,
  ];

  for (const endpoint of endpoints) {
    try {
      log('blue', `Testing: ${endpoint}`);
      const res = await makeRequest(endpoint, 'GET');
      
      if (res.status === 200 || res.status === 405) {
        log('green', `✅ ENDPOINT ACCESSIBLE`);
        log('green', `   Status: ${res.status}`);
        if (res.body && typeof res.body === 'object') {
          log('green', `   Response:`, JSON.stringify(res.body, null, 2));
        }
      } else {
        log('yellow', `⚠️  Status: ${res.status}`);
      }
    } catch (error) {
      log('red', `❌ Error: ${error.message}`);
    }
  }
}

// Command: Send test callback
async function cmdTestCallback(resultCode = '0') {
  log('cyan', '\n📤 SENDING TEST M-PESA CALLBACK...\n');

  // Generate test data
  const checkoutId = `SANDBOX_1_${Date.now()}`;
  const merchantId = `MERCHANT_${Date.now()}`;
  
  const testPayload = {
    Body: {
      stkCallback: {
        MerchantRequestID: merchantId,
        CheckoutRequestID: checkoutId,
        ResultCode: Number(resultCode),
        ResultDesc: resultCode === '0' ? 'The service request has been processed successfully.' : 'User cancelled the transaction.',
        CallbackMetadata: {
          Item: [
            { Name: 'Amount', Value: 50 },
            { Name: 'MpesaReceiptNumber', Value: `LHL719S1C1X` },
            { Name: 'PhoneNumber', Value: '254712345678' },
            { Name: 'AccountReference', Value: 'QUEUE_001' },
            { Name: 'TransactionDate', Value: '20260531123045' },
          ],
        },
      },
    },
  };

  log('blue', 'Test Payload:');
  log('blue', JSON.stringify(testPayload, null, 2));

  const endpoints = [
    `${BACKEND_URL}/api/queue/mpesa-callback`,
    `${DEPLOY_URL}/api/queue/mpesa-callback`,
  ];

  for (const endpoint of endpoints) {
    try {
      log('blue', `\nSending to: ${endpoint}`);
      const res = await makeRequest(endpoint, 'POST', testPayload);
      
      log('green', `✅ RESPONSE: Status ${res.status}`);
      log('green', `   Response:`, JSON.stringify(res.body, null, 2));
    } catch (error) {
      log('red', `❌ Error: ${error.message}`);
    }
  }

  log('cyan', `\nTest CheckoutRequestID: ${checkoutId}`);
  log('cyan', 'Use this ID to check callback status');
}

// Command: Check callback status
async function cmdCheckStatus(checkoutId) {
  if (!checkoutId) {
    log('yellow', '⚠️  Please provide CheckoutRequestID');
    log('yellow', 'Usage: node test-webhook.js check-status <checkoutId>');
    return;
  }

  log('cyan', `\n📊 CHECKING CALLBACK STATUS: ${checkoutId}\n`);

  const endpoints = [
    `${BACKEND_URL}/api/mpesa/callback-status?checkoutRequestId=${checkoutId}`,
    `${DEPLOY_URL}/api/mpesa/callback-status?checkoutRequestId=${checkoutId}`,
  ];

  for (const endpoint of endpoints) {
    try {
      log('blue', `Checking: ${endpoint.split('?')[0]}`);
      const res = await makeRequest(endpoint, 'GET');
      
      if (res.status === 200) {
        log('green', `✅ FOUND`);
        log('green', JSON.stringify(res.body, null, 2));
      } else if (res.status === 404) {
        log('yellow', `⚠️  NOT FOUND (status: ${res.status})`);
        log('yellow', 'Transaction may still be in flight or not yet created');
      } else {
        log('red', `❌ Error (status: ${res.status})`);
      }
    } catch (error) {
      log('red', `❌ Error: ${error.message}`);
    }
  }
}

// Print help
function printHelp() {
  log('cyan', `
╔════════════════════════════════════════════════════════════════╗
║          M-PESA WEBHOOK TESTING & VERIFICATION                ║
╚════════════════════════════════════════════════════════════════╝

USAGE:
  node test-webhook.js [command] [options]

COMMANDS:
  health               Check backend health status
  verify-endpoint      Verify webhook endpoint is accessible
  test-success         Send test success callback (ResultCode=0)
  test-failed          Send test failed callback (ResultCode=1)
  check-status <id>    Check status of a callback (by CheckoutRequestID)
  help                 Show this help message

EXAMPLES:
  # Check if backend is running
  node test-webhook.js health

  # Verify webhook endpoint is accessible
  node test-webhook.js verify-endpoint

  # Send a test success callback
  node test-webhook.js test-success
  
  # Send a test failed callback
  node test-webhook.js test-failed
  
  # Check status of a specific transaction
  node test-webhook.js check-status SANDBOX_1_1234567890

ENVIRONMENT VARIABLES:
  BACKEND_URL   Local backend URL (default: http://localhost:3000)
  DEPLOY_URL    Deployed backend URL (default: https://jkuat-online-queue.onrender.com)

WEBHOOK ENDPOINTS:
  - /api/queue/mpesa-callback (POST)  - Receives callbacks from M-Pesa
  - /api/mpesa/callback-status (GET)  - Check if callback has arrived

TESTING WORKFLOW:
  1. Run: node test-webhook.js health
     → Verify backend is running
  
  2. Run: node test-webhook.js verify-endpoint
     → Ensure webhook is accessible
  
  3. Run: node test-webhook.js test-success
     → Send a test success callback
     → Note the CheckoutRequestID from output
  
  4. Run: node test-webhook.js check-status <id>
     → Verify callback was processed
     → Check database was updated

  5. In Production:
     → M-Pesa sends POST to /api/queue/mpesa-callback
     → Backend logs callback and updates database
     → Frontend polls /api/queue/{id}/mpesa-status (or /api/mpesa/callback-status as fallback)
     → Frontend detects payment success/failure
`);
}

// Main
async function main() {
  log('cyan', '\n╔════════════════════════════════════════════════════════════════╗');
  log('cyan', '║          M-PESA WEBHOOK TESTING & VERIFICATION                ║');
  log('cyan', '╚════════════════════════════════════════════════════════════════╝\n');

  try {
    switch (command.toLowerCase()) {
      case 'health':
        await cmdHealth();
        break;
      case 'verify-endpoint':
      case 'verify':
        await cmdVerifyEndpoint();
        break;
      case 'test-success':
        await cmdTestCallback('0');
        break;
      case 'test-failed':
        await cmdTestCallback('1');
        break;
      case 'check-status':
      case 'check':
        await cmdCheckStatus(arg1);
        break;
      case 'help':
      case '--help':
      case '-h':
      case '':
        printHelp();
        break;
      default:
        log('red', `❌ Unknown command: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    log('red', '❌ Fatal error:', error);
    process.exit(1);
  }

  log('cyan', '');
}

main();
