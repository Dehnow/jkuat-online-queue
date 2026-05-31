import { json } from '@tanstack/start'
import { db } from '../../../../db/index'
import { queueEntries } from '../../../../db/schema'
import { eq, and, sql } from 'drizzle-orm'

// Helper function to provide troubleshooting suggestions
function getSuggestions(responseCode: string | number | undefined) {
  const suggestions: { [key: string]: string[] } = {
    '01': [
      'Invalid Consumer Key or Consumer Secret',
      'Check CONSUMER_KEY and CONSUMER_SECRET in Render environment variables',
      'Verify credentials in Daraja Dashboard: https://developer.safaricom.co.ke/',
    ],
    '08': [
      'M-Pesa system error',
      'Please try again in a few moments',
      'If problem persists, contact Safaricom support',
    ],
    '14': [
      'Invalid phone number format',
      'Use format: +254712345678 or 0712345678',
      'Phone number must start with 254 (Kenya country code) or 0',
    ],
    '20': [
      'Invalid Passkey',
      'Check PASSKEY in Render environment variables',
      'Verify passkey in M-Pesa Online configuration',
    ],
    '25': [
      'Invalid account (Till Number/Shortcode)',
      'Check SHORTCODE in Render environment variables',
      'Verify till number in M-Pesa Online settings',
    ],
  }
  
  const code = String(responseCode)
  return suggestions[code] || [
    `M-Pesa error code: ${responseCode}`,
    'Check the error message for details',
    'Verify all M-Pesa credentials in Render environment',
  ]
}

// M-PESA Configuration
// M-PESA Configuration - AUTO-DETECT PRODUCTION vs SANDBOX
const SANDBOX_CONSUMER_KEY = '4PvGSK0r7RiNmZkjnEwYlQ2xAzB8sD3qF5gH6tJ9oP1u2v'
const SANDBOX_CONSUMER_SECRET = 'wX3yZ9lM5kJ8nB2vC7pDqRsT4uFgH6jK9oL1mN3pQ4rS5tU'
const SANDBOX_PASSKEY = 'bfb279f9ba9b9d1380007480bbe7f27425e1aa6d4ede3891ec337007a74ff42'

// Load from environment
const MPESA_CONSUMER_KEY = process.env.CONSUMER_KEY || process.env.MPESA_CONSUMER_KEY || ''
const MPESA_CONSUMER_SECRET = process.env.CONSUMER_SECRET || process.env.MPESA_CONSUMER_SECRET || ''
const MPESA_BUSINESS_SHORTCODE = process.env.SHORTCODE || process.env.MPESA_SHORTCODE || ''
const MPESA_PASSKEY = process.env.PASSKEY || process.env.MPESA_PASSKEY || ''
const MPESA_CALLBACK_URL = process.env.CALLBACK_URL || process.env.MPESA_CALLBACK_URL || 'https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback'

// AUTO-DETECT: Use production if ALL real credentials provided
const HAS_PRODUCTION_CREDENTIALS = !!(MPESA_CONSUMER_KEY && MPESA_CONSUMER_SECRET && MPESA_PASSKEY && MPESA_BUSINESS_SHORTCODE)
const HAS_REAL_CREDENTIALS = HAS_PRODUCTION_CREDENTIALS && 
  MPESA_CONSUMER_KEY !== SANDBOX_CONSUMER_KEY && 
  MPESA_CONSUMER_SECRET !== SANDBOX_CONSUMER_SECRET &&
  MPESA_PASSKEY !== SANDBOX_PASSKEY

const SANDBOX_MODE = !HAS_REAL_CREDENTIALS

// VALIDATE CALLBACK URL on startup
function validateCallbackUrl() {
  const errors: string[] = []
  
  // Check HTTPS
  if (!MPESA_CALLBACK_URL.startsWith('https://')) {
    errors.push('❌ CALLBACK URL MUST BE HTTPS (not HTTP)')
  }
  
  // Check localhost
  if (MPESA_CALLBACK_URL.includes('localhost') || MPESA_CALLBACK_URL.includes('127.0.0.1')) {
    errors.push('❌ CALLBACK URL cannot be localhost (M-Pesa cannot reach it)')
  }
  
  if (errors.length > 0) {
    console.error('🔴 CALLBACK URL VALIDATION ERRORS:')
    errors.forEach(e => console.error(e))
    console.error(`   Current: ${MPESA_CALLBACK_URL}`)
    if (!SANDBOX_MODE) {
      console.error('   ⚠️  Production mode - callback URL must be accessible!')
    }
  } else {
    console.log(`✅ Callback URL validated: ${MPESA_CALLBACK_URL}`)
  }
}

validateCallbackUrl()

console.log(`[mpesa-pay.ts] Mode: ${SANDBOX_MODE ? 'SANDBOX 🧪' : 'PRODUCTION 🚀'} | Credentials: ${HAS_REAL_CREDENTIALS ? 'Real' : 'Missing/Sandbox'}`)

// Use production URLs if real credentials, sandbox otherwise
const SANDBOX_SHORTCODE = '174379'

// Get M-PESA access token WITH RETRY LOGIC AND PROPER TIMEOUT HANDLING
async function getMpesaAccessToken(retryCount = 0, maxRetries = 3): Promise<string> {
  try {
    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64')
    const baseUrl = SANDBOX_MODE 
      ? 'https://sandbox.safaricom.co.ke'
      : 'https://api.safaricom.co.ke'
    
    console.log(`🔐 Requesting M-Pesa access token from ${baseUrl}${retryCount > 0 ? ` (Retry ${retryCount}/${maxRetries})` : ''}`)
    
    // Use AbortController for proper timeout handling
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout
    
    let response: Response
    try {
      response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    // Read response as text first to handle empty or malformed responses
    let responseText = ''
    try {
      responseText = await response.text()
    } catch (readError) {
      console.error(`❌ Failed to read M-Pesa response body: ${readError instanceof Error ? readError.message : String(readError)}`)
      throw new Error(`Failed to read response: ${readError instanceof Error ? readError.message : 'Unknown error'}`)
    }
    
    console.log(`📡 M-Pesa response status: ${response.status}, body length: ${responseText.length} bytes`)
    console.log(`📡 Response headers:`, {
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
    })
    
    // Validate response is not empty
    if (!responseText || responseText.length === 0) {
      console.error(`❌ Empty response from M-Pesa token endpoint (status: ${response.status})`)
      throw new Error(`Empty response from M-Pesa (HTTP ${response.status})`)
    }
    
    // Check response status BEFORE parsing JSON
    if (!response.ok) {
      console.error(`❌ M-Pesa HTTP error ${response.status}`)
      console.error(`📄 Response preview: ${responseText.substring(0, 300)}`)
      
      // Try to parse error response if it's JSON
      let errorMsg = `HTTP ${response.status}`
      if (responseText.trim()) {
        try {
          const errorData = JSON.parse(responseText)
          errorMsg = errorData.error_description || errorData.error || errorMsg
          console.error(`📋 M-Pesa error details:`, errorData)
        } catch (e) {
          // Response is not JSON, use the text as-is
          errorMsg = responseText.substring(0, 150) || errorMsg
          console.error(`📝 M-Pesa error (not JSON): ${errorMsg}`)
        }
      }
      throw new Error(`M-Pesa auth failed: ${errorMsg}`)
    }
    
    // Validate content type is JSON before parsing
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json') && !contentType.includes('application/ld+json')) {
      console.error(`❌ Invalid content-type from M-Pesa: ${contentType}`)
      console.error(`📄 Response body: ${responseText.substring(0, 300)}`)
      throw new Error(`Invalid response content-type: ${contentType}. Expected JSON.`)
    }
    
    // Parse JSON response
    let data: any
    try {
      data = JSON.parse(responseText)
      console.log(`✅ Successfully parsed M-Pesa token response`)
    } catch (parseError) {
      console.error(`❌ Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
      console.error(`📄 Response text: ${responseText.substring(0, 500)}`)
      console.error(`📊 Response length: ${responseText.length}, first 50 bytes: ${responseText.substring(0, 50).split('').map(c => `${c.charCodeAt(0)}`).join(',')}`)
      throw new Error(`Invalid JSON from M-Pesa: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
    }
    
    if (!data.access_token) {
      const errorMsg = data.error_description || data.error || 'No access_token field in response'
      console.error(`❌ M-Pesa missing access_token. Response:`, JSON.stringify(data).substring(0, 300))
      throw new Error(`M-Pesa invalid response: ${errorMsg}`)
    }
    
    console.log(`✅ M-Pesa access token obtained successfully (valid for ~3600 seconds)`)
    return data.access_token
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    
    // Retry on transient errors: timeouts, network errors, 5xx errors, JSON parse errors
    const isTransient = errorMsg.includes('timeout') || 
                       errorMsg.includes('Transient') ||
                       errorMsg.includes('5') || 
                       errorMsg.includes('Unexpected') ||
                       errorMsg.includes('Failed to read') ||
                       errorMsg.includes('Empty response') ||
                       errorMsg.includes('ECONNREFUSED') ||
                       errorMsg.includes('ETIMEDOUT') ||
                       errorMsg.includes('AbortError')
    
    if (retryCount < maxRetries && isTransient) {
      const delay = Math.pow(2, retryCount) * 1000 // Exponential backoff: 1s, 2s, 4s, 8s
      console.warn(`⚠️  Token request failed (${errorMsg}). Retrying in ${delay}ms...`)
      await new Promise(r => setTimeout(r, delay))
      return getMpesaAccessToken(retryCount + 1, maxRetries)
    }
    
    console.error(`❌ Failed to get M-PESA access token (attempt ${retryCount + 1}/${maxRetries + 1}):`, errorMsg)
    throw error
  }
}

// Initiate M-PESA STK push WITH RETRY LOGIC AND PROPER TIMEOUT HANDLING
async function initiateMpesaPayment(phoneNumber: string, amount: number, queueId: number, goldenRef: string, retryCount = 0, maxRetries = 3) {
  try {
    const token = await getMpesaAccessToken()
    
    // Generate timestamp in format: YYYYMMDDHHmmss
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')
    const timestamp = `${year}${month}${day}${hour}${minute}${second}`

    // Use production credentials if available, sandbox otherwise
    const shortCode = SANDBOX_MODE ? SANDBOX_SHORTCODE : MPESA_BUSINESS_SHORTCODE
    const passkey = SANDBOX_MODE ? SANDBOX_PASSKEY : MPESA_PASSKEY

    // Generate password: base64(shortcode + passkey + timestamp)
    const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64')

    const baseUrl = SANDBOX_MODE 
      ? 'https://sandbox.safaricom.co.ke'
      : 'https://api.safaricom.co.ke'

    const stkPayload = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: amount,
      PartyA: phoneNumber,
      PartyB: shortCode,
      PhoneNumber: phoneNumber,
      CallBackURL: MPESA_CALLBACK_URL,
      AccountReference: goldenRef,
      TransactionDesc: `Golden Ticket Payment - Ref: ${goldenRef}`,
    }

    console.log(`📱 Initiating STK Push${retryCount > 0 ? ` (Retry ${retryCount}/${maxRetries})` : ''}`)
    console.log(`   Phone: ${phoneNumber}`)
    console.log(`   Amount: KES ${amount}`)
    console.log(`   Reference: ${goldenRef}`)
    console.log(`   Mode: ${SANDBOX_MODE ? 'SANDBOX' : 'PRODUCTION'}`)

    // Use AbortController for proper timeout handling
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000) // 20 second timeout for STK

    let response: Response
    try {
      response = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(stkPayload),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    // Read response as text first to handle empty or malformed responses
    let responseText = ''
    try {
      responseText = await response.text()
    } catch (readError) {
      console.error(`❌ Failed to read STK response body: ${readError instanceof Error ? readError.message : String(readError)}`)
      throw new Error(`Failed to read STK response: ${readError instanceof Error ? readError.message : 'Unknown error'}`)
    }
    
    console.log(`📨 STK Push response status: ${response.status}, body length: ${responseText.length} bytes`)
    console.log(`📨 Response headers:`, {
      contentType: response.headers.get('content-type'),
      contentLength: response.headers.get('content-length'),
    })
    
    // Parse JSON - handle empty or malformed responses
    if (!responseText.trim()) {
      console.error(`❌ Empty response from M-Pesa STK Push endpoint (status: ${response.status})`)
      // Retry on empty responses (likely transient error)
      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s, 8s
        console.warn(`⚠️  Empty STK Push response. Retrying in ${delay}ms...`)
        await new Promise(r => setTimeout(r, delay))
        return initiateMpesaPayment(phoneNumber, amount, queueId, goldenRef, retryCount + 1, maxRetries)
      }
      throw new Error('Empty response from M-Pesa STK Push endpoint')
    }
    
    // Validate content type is JSON before parsing
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json') && !contentType.includes('application/ld+json')) {
      console.error(`❌ Invalid content-type from M-Pesa STK: ${contentType}`)
      console.error(`📄 Response body: ${responseText.substring(0, 300)}`)
      // Retry on non-JSON responses (likely transient)
      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000
        console.warn(`⚠️  Invalid STK content-type (${contentType}). Retrying in ${delay}ms...`)
        await new Promise(r => setTimeout(r, delay))
        return initiateMpesaPayment(phoneNumber, amount, queueId, goldenRef, retryCount + 1, maxRetries)
      }
      throw new Error(`Invalid STK response content-type: ${contentType}. Expected JSON.`)
    }
    
    let data: any
    try {
      data = JSON.parse(responseText)
      console.log(`✅ Successfully parsed STK Push response`)
    } catch (parseError) {
      console.error(`❌ Failed to parse STK Push response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
      console.error(`📄 Response text: ${responseText.substring(0, 500)}`)
      console.error(`📊 Response length: ${responseText.length}, first 50 bytes: ${responseText.substring(0, 50).split('').map(c => `${c.charCodeAt(0)}`).join(',')}`)
      // Retry on JSON parse errors (likely transient)
      if (retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s, 8s
        console.warn(`⚠️  Invalid STK Push response. Retrying in ${delay}ms...`)
        await new Promise(r => setTimeout(r, delay))
        return initiateMpesaPayment(phoneNumber, amount, queueId, goldenRef, retryCount + 1, maxRetries)
      }
      throw new Error(`Invalid JSON response from M-Pesa: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`)
    }
    
    console.log(`   Response Status: ${response.status}`)
    console.log(`   Response Code: ${data.ResponseCode}`)
    console.log(`   CheckoutRequestID: ${data.CheckoutRequestID}`)
    
    if (data.ResponseCode === '0' || data.ResponseCode === 0) {
      console.log(`✅ STK Push successful!`)
      return {
        success: true,
        checkoutRequestId: data.CheckoutRequestID,
        responseMessage: data.ResponseDescription,
      }
    } else {
      // Detailed error reporting
      const errorCode = data.ResponseCode || 'UNKNOWN'
      const errorMsg = data.ResponseDescription || 'Failed to initiate payment'
      
      // Retry on transient errors (8 = system error, 5xx status = server error)
      if ((errorCode === '8' || errorMsg.includes('system') || response.status >= 500) && retryCount < maxRetries) {
        const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s, 8s
        console.warn(`⚠️  STK Push failed with transient error (${errorCode}). Retrying in ${delay}ms...`)
        await new Promise(r => setTimeout(r, delay))
        return initiateMpesaPayment(phoneNumber, amount, queueId, goldenRef, retryCount + 1, maxRetries)
      }
      
      console.error(`❌ STK Push error: ResponseCode=${errorCode}`)
      console.error(`   Message: ${errorMsg}`)
      console.error(`   Full response:`, JSON.stringify(data, null, 2))
      
      return {
        success: false,
        error: errorMsg,
        responseCode: errorCode,
        details: data,
      }
    }
  } catch (error) {
    console.error('❌ M-PESA payment initiation error:', error instanceof Error ? error.message : String(error))
    throw error
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id)
    
    if (isNaN(id)) {
      return json({ error: 'Invalid queue entry ID' }, { status: 400 })
    }

    const body = await request.json()
    const { phoneNumber } = body

    // Validate phone number
    if (!phoneNumber || !/^[\+]?254\d{9}$/.test(phoneNumber.replace(/\s/g, ''))) {
      return json({ 
        error: 'Invalid phone number',
        message: 'Invalid phone number. Use format: +254712345678' 
      }, { status: 400 })
    }

    // Get queue entry
    const entry = await db.query.queueEntries.findFirst({
      where: eq(queueEntries.id, id),
    })

    if (!entry) {
      return json({ error: 'Queue entry not found' }, { status: 404 })
    }

    // Check if already golden
    if (entry.isGolden) {
      return json({ 
        error: 'Already upgraded',
        message: `This ticket is already a Golden Ticket (${entry.goldenTicketRef}). You cannot upgrade it again.`
      }, { status: 429 })
    }

    // Check if already served or cancelled
    if (entry.status === 'served' || entry.status === 'cancelled') {
      return json({ 
        error: 'Cannot upgrade',
        message: `Cannot upgrade a ${entry.status} queue entry`
      }, { status: 400 })
    }

    // Generate golden ticket reference
    const date = new Date().toISOString().split('T')[0].replace(/-/g, '')
    const sequence = await db.query.queueEntries.findMany({
      where: and(
        eq(queueEntries.serviceType, entry.serviceType),
        eq(queueEntries.isGolden, true)
      ),
    })

    const goldenTicketRef = `GT-${entry.serviceType.toUpperCase().substring(0, 3)}-${date}-${String(sequence.length + 1).padStart(3, '0')}`

    // Check sandbox mode
    if (SANDBOX_MODE) {
      // Sandbox: Simulate STK push (DO NOT auto-complete - user must manually trigger callback)
      const checkoutRequestId = `SANDBOX_${id}_${Date.now()}`
      
      // 🔥 CRITICAL: Set as pending - wait for callback
      await db.update(queueEntries)
        .set({
          goldenTicketRef,
          mpesaTransactionId: checkoutRequestId,
          mpesaStatus: 'pending',
        })
        .where(eq(queueEntries.id, id))

      console.log(`✅ SANDBOX: STK Push initiated for ${goldenTicketRef}`)
      console.log(`   Queue ID: ${id}`)
      console.log(`   Checkout Request ID: ${checkoutRequestId}`)
      console.log(`   Status: PENDING (waiting for user PIN entry or callback)`)
      console.log(`📱 User should see M-Pesa prompt on phone`)
      console.log(`⏳ Status remains PENDING until callback is received with ResultCode 0`)
      console.log(`🔗 Testing: POST /api/queue/mpesa-callback with ResultCode 0 to complete payment`)
      
      return json({
        success: true,
        checkoutRequestId,
        responseCode: '0',
        message: 'STK push initiated - Check your phone for M-Pesa prompt. Enter your PIN to complete payment.',
        mpesaStatus: 'pending',
        goldenTicketRef,
        sandbox: true,
        queueId: id,
        testingNote: 'To test completion, POST to /api/queue/mpesa-callback with the callback payload',
      })
    } else {
      // Production: Call actual M-Pesa Daraja API for STK Push
      try {
        // Validate credentials
        if (!MPESA_CONSUMER_KEY || !MPESA_CONSUMER_SECRET) {
          console.error('ERROR M-Pesa credentials not configured')
          return json({
            error: 'M-Pesa credentials not configured',
            message: 'Please set CONSUMER_KEY and CONSUMER_SECRET environment variables',
          }, { status: 500 })
        }

        // Format phone number to 254XXXXXXXXX
        let formattedPhone = phoneNumber.replace(/\D/g, '')
        if (!formattedPhone.startsWith('254')) {
          if (formattedPhone.startsWith('0')) {
            formattedPhone = '254' + formattedPhone.slice(1)
          } else {
            formattedPhone = '254' + formattedPhone.slice(-9)
          }
        }

        const paymentResult = await initiateMpesaPayment(
          formattedPhone,
          50, // KES 50 for golden ticket
          id,
          goldenTicketRef
        )

        if (paymentResult.success) {
          // 🔥 CRITICAL: Store the checkout request ID and set status to PENDING
          // Status will change to 'success' only after M-Pesa callback is received
          await db.update(queueEntries)
            .set({
              mpesaTransactionId: paymentResult.checkoutRequestId,
              mpesaStatus: 'pending',
              goldenTicketRef,
            })
            .where(eq(queueEntries.id, id))

          console.log(`✅ STK Push initiated (PRODUCTION): ${goldenTicketRef}`)
          console.log(`   CheckoutRequestID: ${paymentResult.checkoutRequestId}`)
          console.log(`   Database Status: PENDING`)
          console.log(`   Waiting for M-Pesa callback...`)
          
          return json({
            success: true,
            message: 'Payment prompt sent to your phone',
            checkoutRequestId: paymentResult.checkoutRequestId,
            environment: SANDBOX_MODE ? 'sandbox' : 'production',
            mpesaStatus: 'pending',
            goldenTicketRef,
            queueId: id,
          })
        } else {
          console.error(`❌ STK Push initiation failed: ${paymentResult.error}`)
          console.error(`   Response Code: ${paymentResult.responseCode}`)
          console.error(`   Details:`, JSON.stringify(paymentResult.details, null, 2))
          
          return json({
            error: paymentResult.error,
            message: `Payment initiation failed: ${paymentResult.error}`,
            responseCode: paymentResult.responseCode,
            details: paymentResult.details,
            suggestions: getSuggestions(paymentResult.responseCode),
          }, { status: 400 })
          return json({
            success: false,
            error: paymentResult.error,
          }, { status: 400 })
        }
      } catch (error) {
        console.error('Payment initiation failed:', error)
        return json({
          success: false,
          error: 'Failed to initiate payment',
          message: (error as Error).message || 'Please try again later',
        }, { status: 500 })
      }
    }
  } catch (error) {
    console.error('M-PESA payment endpoint error:', error)
    return json({ 
      error: 'Internal server error',
      message: (error as Error).message 
    }, { status: 500 })
  }
}
