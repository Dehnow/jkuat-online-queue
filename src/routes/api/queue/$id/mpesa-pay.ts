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
const MPESA_CONSUMER_KEY = process.env.CONSUMER_KEY || process.env.MPESA_CONSUMER_KEY || ''
const MPESA_CONSUMER_SECRET = process.env.CONSUMER_SECRET || process.env.MPESA_CONSUMER_SECRET || ''
const MPESA_BUSINESS_SHORTCODE = process.env.SHORTCODE || process.env.MPESA_SHORTCODE || '174379'
const MPESA_PASSKEY = process.env.PASSKEY || process.env.MPESA_PASSKEY || ''
const MPESA_CALLBACK_URL = process.env.CALLBACK_URL || process.env.MPESA_CALLBACK_URL || 'https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback'

// Sandbox credentials for testing
const SANDBOX_MODE = process.env.MPESA_ENVIRONMENT === 'sandbox' || process.env.MPESA_SANDBOX === 'true' || process.env.NODE_ENV !== 'production'
const SANDBOX_SHORTCODE = '174379'
const SANDBOX_PASSKEY = 'bfb279f9ba9b9d1380007480bbe7f27425e1aa6d4ede3891ec337007a74ff42'

// Get M-PESA access token
async function getMpesaAccessToken(): Promise<string> {
  try {
    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64')
    const baseUrl = SANDBOX_MODE 
      ? 'https://sandbox.safaricom.co.ke'
      : 'https://api.safaricom.co.ke'
    
    console.log(`🔐 Requesting M-Pesa access token from ${baseUrl}`)
    const response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
      },
    })

    const data: any = await response.json()
    
    if (!data.access_token) {
      throw new Error(data.error_description || 'Failed to get access token')
    }
    
    console.log(`✅ M-Pesa access token obtained`)
    return data.access_token
  } catch (error) {
    console.error('❌ Failed to get M-PESA access token:', error)
    throw error
  }
}

// Initiate M-PESA STK push
async function initiateMpesaPayment(phoneNumber: string, amount: number, queueId: number, goldenRef: string) {
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

    // Use sandbox credentials in development, production in live
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

    console.log(`📱 Initiating STK Push to ${phoneNumber} for ${goldenRef}`)
    console.log(`   Amount: KES ${amount}`)
    console.log(`   Callback URL: ${MPESA_CALLBACK_URL}`)

    const response = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stkPayload),
    })

    const data: any = await response.json()
    
    console.log(`   Response Status: ${response.status}`)
    console.log(`   Response Code: ${data.ResponseCode}`)
    console.log(`   CheckoutRequestID: ${data.CheckoutRequestID}`)
    console.log(`   Description: ${data.ResponseDescription}`)
    console.log(`   Full Response:`, JSON.stringify(data, null, 2))
    
    if (data.ResponseCode === '0' || data.ResponseCode === 0) {
      return {
        success: true,
        checkoutRequestId: data.CheckoutRequestID,
        responseMessage: data.ResponseDescription,
      }
    } else {
      // Detailed error reporting
      const errorCode = data.ResponseCode || 'UNKNOWN'
      const errorMsg = data.ResponseDescription || 'Failed to initiate payment'
      
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
    console.error('❌ M-PESA payment initiation error:', error)
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
