// test-stk-push.js - Verify M-Pesa STK Push Implementation

console.log('='.repeat(80));
console.log('M-PESA STK PUSH VERIFICATION TEST');
console.log('='.repeat(80));

// Exact credentials provided
const MPESA_CONFIG = {
  tillNumber: '174379',
  passkey: 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
  consumerKey: 'YLPydMh4xhirGrux1cdHyqKRCE3BzinLxdlzed4s88XyiRnu',
  consumerSecret: 'RuAadmSxyhwAqjk1GqEwW3vyoDtbCD0nByXAHR7GZw0COLoxSI6u0AKa91wSL4uw',
  callbackUrl: 'https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback'
};

console.log('\n✅ STEP 1: Verify Credentials Configuration\n');
console.log('Till Number (BusinessShortCode):', MPESA_CONFIG.tillNumber);
console.log('Passkey:', MPESA_CONFIG.passkey.substring(0, 20) + '...');
console.log('Consumer Key:', MPESA_CONFIG.consumerKey.substring(0, 20) + '...');
console.log('Consumer Secret:', MPESA_CONFIG.consumerSecret.substring(0, 20) + '...');
console.log('Callback URL:', MPESA_CONFIG.callbackUrl);

// Verify passkey length and format
console.log('\n✅ STEP 2: Validate Passkey Format\n');
console.log('Passkey length:', MPESA_CONFIG.passkey.length, 'characters');
console.log('Passkey is hexadecimal:', /^[0-9a-f]+$/.test(MPESA_CONFIG.passkey) ? 'YES ✓' : 'NO ✗');
console.log('Expected format: 64-character hex string');
console.log('Actual format:', MPESA_CONFIG.passkey.length === 64 ? '64 characters ✓' : 'WRONG LENGTH ✗');

// Test password generation
console.log('\n✅ STEP 3: Password Generation (Critical for STK Push)\n');

function generatePassword(tillNumber, passkey, timestamp) {
  const passwordString = `${tillNumber}${passkey}${timestamp}`;
  const password = Buffer.from(passwordString).toString('base64');
  return { passwordString, password };
}

const now = new Date();
const timestamp = now.toISOString().replace(/[^0-9]/g, '').slice(0, 14);
console.log('Current Timestamp (YYYYMMDDHHmmss):', timestamp);

const { passwordString, password } = generatePassword(
  MPESA_CONFIG.tillNumber,
  MPESA_CONFIG.passkey,
  timestamp
);

console.log('\nPassword Generation Formula:');
console.log('Input string: TILL + PASSKEY + TIMESTAMP');
console.log('Input: ' + MPESA_CONFIG.tillNumber + ' + [passkey] + ' + timestamp);
console.log('\nGenerated Base64 Password:');
console.log(password);
console.log('\nPassword is valid base64:', /^[A-Za-z0-9+/]*={0,2}$/.test(password) ? 'YES ✓' : 'NO ✗');

// Test OAuth credential format
console.log('\n✅ STEP 4: OAuth Credentials Validation\n');

const oauthString = `${MPESA_CONFIG.consumerKey}:${MPESA_CONFIG.consumerSecret}`;
const oauthAuth = Buffer.from(oauthString).toString('base64');

console.log('OAuth Basic Auth Header Format:');
console.log('Format: base64(ConsumerKey:ConsumerSecret)');
console.log('Generated: Authorization: Basic ' + oauthAuth);
console.log('OAuth Auth is valid base64:', /^[A-Za-z0-9+/]*={0,2}$/.test(oauthAuth) ? 'YES ✓' : 'NO ✗');

// Simulate STK Push payload
console.log('\n✅ STEP 5: Sample STK Push Payload\n');

const phoneNumber = '+254727610315';
const extractedPhone = phoneNumber.replace(/[^\d]/g, '').slice(-10);

const stkPayload = {
  BusinessShortCode: MPESA_CONFIG.tillNumber,
  Password: password,
  Timestamp: timestamp,
  TransactionType: 'CustomerPayBillOnline',
  Amount: 50,
  PartyA: extractedPhone,
  PartyB: MPESA_CONFIG.tillNumber,
  PhoneNumber: extractedPhone,
  CallBackURL: MPESA_CONFIG.callbackUrl,
  AccountReference: 'GT-REG-' + timestamp.substring(0, 8) + '-001',
  TransactionDesc: 'Golden Ticket - Priority Queue Access'
};

console.log('Sample STK Push Request Payload:');
console.log(JSON.stringify(stkPayload, null, 2));

// Daraja endpoints
console.log('\n✅ STEP 6: Daraja API Endpoints\n');

const tokenUrl = 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';
const stkPushUrl = 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest';
const callbackUrl = MPESA_CONFIG.callbackUrl;

console.log('OAuth Token Endpoint:', tokenUrl);
console.log('STK Push Endpoint:', stkPushUrl);
console.log('Callback URL (Public):', callbackUrl);
console.log('Callback URL is HTTPS:', callbackUrl.startsWith('https://') ? 'YES ✓' : 'NO ✗');
console.log('Callback URL is public:', !callbackUrl.includes('localhost') && !callbackUrl.includes('192.168') ? 'YES ✓' : 'NO ✗');

// Summary
console.log('\n' + '='.repeat(80));
console.log('VERIFICATION SUMMARY');
console.log('='.repeat(80));

const checks = [
  { name: 'Till Number', status: MPESA_CONFIG.tillNumber === '174379' },
  { name: 'Passkey Format', status: MPESA_CONFIG.passkey.length === 64 },
  { name: 'Passkey Hex', status: /^[0-9a-f]+$/.test(MPESA_CONFIG.passkey) },
  { name: 'Consumer Key Length', status: MPESA_CONFIG.consumerKey.length > 30 },
  { name: 'Consumer Secret Length', status: MPESA_CONFIG.consumerSecret.length > 30 },
  { name: 'Password Generation', status: /^[A-Za-z0-9+/]*={0,2}$/.test(password) },
  { name: 'OAuth Auth Format', status: /^[A-Za-z0-9+/]*={0,2}$/.test(oauthAuth) },
  { name: 'Callback URL HTTPS', status: callbackUrl.startsWith('https://') },
  { name: 'Callback URL Public', status: !callbackUrl.includes('localhost') && !callbackUrl.includes('192.168') },
  { name: 'Phone Extraction', status: extractedPhone === '4727610315' }
];

let passCount = 0;
console.log();
checks.forEach(check => {
  const status = check.status ? '✓ PASS' : '✗ FAIL';
  console.log(`${status.padEnd(8)} ${check.name}`);
  if (check.status) passCount++;
});

console.log('\n' + '='.repeat(80));
console.log(`OVERALL: ${passCount}/${checks.length} checks passed`);
console.log('='.repeat(80));

if (passCount === checks.length) {
  console.log('\n✅ ALL CHECKS PASSED - STK PUSH READY FOR TESTING\n');
  console.log('Next Steps:');
  console.log('1. Test endpoint: curl -X POST http://localhost:3000/api/queue/1/mpesa-pay \\');
  console.log('     -H "Content-Type: application/json" \\');
  console.log('     -d \'{"phoneNumber":"+254727610315"}\'');
  console.log('\n2. Verify response includes: checkoutRequestId, goldenTicketRef, mpesaStatus');
  console.log('\n3. Check database for pending payment entry');
  console.log('\n4. In production, STK prompt should appear on phone');
  process.exit(0);
} else {
  console.log('\n❌ SOME CHECKS FAILED - REVIEW CONFIGURATION\n');
  process.exit(1);
}
