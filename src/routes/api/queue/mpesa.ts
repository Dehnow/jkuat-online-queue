import { json } from '@tanstack/start'
import { db } from '../../../db/index'
import { queueEntries } from '../../../db/schema'
import { eq } from 'drizzle-orm'

// M-PESA Configuration
// NOTE: Environment variables use these exact names in Render:
// - CONSUMER_KEY (not MPESA_CONSUMER_KEY)
// - CONSUMER_SECRET (not MPESA_CONSUMER_SECRET)
// - PASSKEY (not MPESA_PASSKEY)
// - SHORTCODE (not MPESA_SHORTCODE)
// - CALLBACK_URL (not MPESA_CALLBACK_URL)
const MPESA_CONSUMER_KEY = process.env.CONSUMER_KEY || process.env.MPESA_CONSUMER_KEY || ''
const MPESA_CONSUMER_SECRET = process.env.CONSUMER_SECRET || process.env.MPESA_CONSUMER_SECRET || ''
const MPESA_BUSINESS_SHORTCODE = process.env.SHORTCODE || process.env.MPESA_SHORTCODE || '174379'
const MPESA_PASSKEY = process.env.PASSKEY || process.env.MPESA_PASSKEY || ''
const MPESA_CALLBACK_URL = process.env.CALLBACK_URL || process.env.MPESA_CALLBACK_URL || 'https://jkuat-online-queue.onrender.com/api/queue/mpesa-callback'

// Sandbox credentials for testing (optional)
const SANDBOX_MODE = process.env.NODE_ENV !== 'production' || process.env.MPESA_SANDBOX === 'true'
const SANDBOX_SHORTCODE = '174379'
const SANDBOX_PASSKEY = 'bfb279f9ba9b9d1380007480bbe7f27425e1aa6d4ede3891ec337007a74ff42'

// Get M-PESA access token
async function getMpesaAccessToken(): Promise<string> {
  try {
    const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64')
    const baseUrl = SANDBOX_MODE 
      ? 'https://sandbox.safaricom.co.ke'
      : 'https://api.safaricom.co.ke'
    
    console.log(`🔐 Requesting M-Pesa access token from ${baseUrl}/oauth/v1/generate`)
    
    // Use AbortController for timeout handling
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000) // 20 second timeout
    
    try {
      const response = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        method: 'GET',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: controller.signal
      })

      // Read response as text first to handle empty or malformed responses
      let responseText = ''
      try {
        responseText = await response.text()
      } catch (readError) {
        console.error(`❌ Failed to read M-Pesa token response stream: ${readError}`)
        throw new Error(`Failed to read token response: ${readError}`)
      }

      console.log(`📡 M-Pesa token response status: ${response.status}, body length: ${responseText.length}`)
      console.log(`📡 Response headers: content-type=${response.headers.get('content-type')}, content-length=${response.headers.get('content-length')}`)
      
      // Validate response is not empty BEFORE checking status
      if (!responseText || responseText.trim().length === 0) {
        console.error(`❌ Empty response from M-Pesa token endpoint (status: ${response.status})`)
        throw new Error(`Empty response from M-Pesa token endpoint (HTTP ${response.status})`)
      }
      
      // Check response status BEFORE parsing JSON
      if (!response.ok) {
        console.error(`❌ M-Pesa HTTP error ${response.status}`)
        console.error(`📄 Error response: ${responseText.substring(0, 300)}`)
        
        let errorMsg = `HTTP ${response.status}`
        if (responseText.trim()) {
          try {
            const errorData = JSON.parse(responseText)
            errorMsg = errorData.error_description || errorData.error || errorMsg
            console.error(`📋 M-Pesa error details:`, errorData)
          } catch (e) {
            errorMsg = responseText.substring(0, 200).trim() || errorMsg
            console.error(`📝 M-Pesa error (non-JSON): ${errorMsg}`)
          }
        }
        throw new Error(`M-Pesa auth failed: ${errorMsg}`)
      }
      
      // Validate content-type
      const contentType = (response.headers.get('content-type') || '').toLowerCase()
      const isJsonLike = contentType.includes('application/json') || 
                        contentType.includes('text/plain') ||
                        !contentType // If no content-type, assume JSON
      
      if (!isJsonLike) {
        console.error(`❌ Invalid content-type from M-Pesa: ${contentType}`)
        throw new Error(`Invalid response content-type: ${contentType}. Expected JSON.`)
      }
      
      // Parse JSON response
      let data: any
      try {
        const trimmedResponse = responseText.trim()
        if (!trimmedResponse) {
          console.error(`❌ Response is only whitespace`)
          throw new Error(`Response is only whitespace`)
        }
        data = JSON.parse(trimmedResponse)
        console.log(`✅ M-Pesa token response successfully parsed`)
      } catch (parseError) {
        console.error(`❌ Failed to parse M-Pesa token response as JSON: ${parseError}`)
        console.error(`📊 Raw response length: ${responseText.length} bytes`)
        console.error(`📄 Response text (first 500 chars): ${responseText.substring(0, 500)}`)
        throw new Error(`Invalid JSON from M-Pesa: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
      }
      
      // Validate access_token exists
      if (!data || typeof data !== 'object') {
        console.error(`❌ M-Pesa response is not an object`)
        throw new Error(`Invalid response structure from M-Pesa`)
      }

      if (!data.access_token) {
        const errorMsg = data.error_description || data.error || 'No access_token field in response'
        console.error(`❌ M-Pesa response missing access_token: ${JSON.stringify(data).substring(0, 300)}`)
        throw new Error(errorMsg)
      }
      
      console.log(`✅ M-Pesa access token obtained successfully`)
      return data.access_token
    } catch (error) {
      // Enhance error for network issues
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`M-Pesa token request timeout (20s) - network may be slow`)
        } else if (error.message?.includes('ECONNREFUSED')) {
          throw new Error(`M-Pesa endpoint connection refused`)
        } else if (error.message?.includes('ETIMEDOUT')) {
          throw new Error(`M-Pesa endpoint connection timeout`)
        }
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
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

    console.log(`📱 Initiating STK Push to ${phoneNumber}...`)
    
    // Use AbortController for timeout handling
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000) // 25 second timeout

    try {
      const response = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          BusinessShortCode: shortCode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: amount,
          PartyA: phoneNumber, // Phone number with country code (254...)
          PartyB: shortCode,
          PhoneNumber: phoneNumber,
          CallBackURL: MPESA_CALLBACK_URL,
          AccountReference: goldenRef,
          TransactionDesc: `Golden Ticket Payment - Ref: ${goldenRef}`,
        }),
        signal: controller.signal
      })

      // Read response as text first to handle empty or malformed responses
      let responseText = ''
      try {
        responseText = await response.text()
      } catch (readError) {
        console.error(`❌ Failed to read STK Push response stream: ${readError}`)
        throw new Error(`Failed to read STK response: ${readError}`)
      }

      console.log(`📨 STK Push response status: ${response.status}, body length: ${responseText.length}`)
      console.log(`📨 Response headers: content-type=${response.headers.get('content-type')}, content-length=${response.headers.get('content-length')}`)
      
      // Validate response is not empty BEFORE checking status
      if (!responseText || responseText.trim().length === 0) {
        console.error(`❌ Empty response from M-Pesa STK Push endpoint (status: ${response.status})`)
        throw new Error(`Empty response from M-Pesa STK Push endpoint (HTTP ${response.status})`)
      }
      
      // Validate content-type BEFORE parsing
      const contentType = (response.headers.get('content-type') || '').toLowerCase()
      const isJsonLike = contentType.includes('application/json') || 
                        contentType.includes('text/plain') ||
                        !contentType // If no content-type, assume JSON

      if (!isJsonLike) {
        console.error(`❌ Invalid content-type from M-Pesa STK: ${contentType}`)
        console.error(`📄 Response body: ${responseText.substring(0, 300)}`)
        throw new Error(`Invalid STK response content-type: ${contentType}. Expected JSON.`)
      }
      
      // Parse JSON response
      let data: any
      try {
        const trimmedResponse = responseText.trim()
        if (!trimmedResponse) {
          console.error(`❌ STK Response is only whitespace`)
          throw new Error(`STK Response is only whitespace`)
        }
        data = JSON.parse(trimmedResponse)
        console.log(`✅ M-Pesa STK response successfully parsed`)
        console.log(`📋 Response keys:`, Object.keys(data).join(', '))
      } catch (parseError) {
        console.error(`❌ Failed to parse STK Push response as JSON: ${parseError}`)
        console.error(`📊 Raw response length: ${responseText.length} bytes`)
        console.error(`📄 Response text (first 500 chars): ${responseText.substring(0, 500)}`)
        throw new Error(`Invalid JSON from M-Pesa STK: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
      }

      // Validate response structure
      if (!data || typeof data !== 'object') {
        console.error(`❌ STK response is not an object`)
        throw new Error(`Invalid STK response structure from M-Pesa`)
      }

      // Check HTTP status after validating response body exists
      if (!response.ok && response.status >= 400) {
        console.error(`❌ M-Pesa STK returned HTTP error: ${response.status}`)
        const errorMsg = data.ResponseDescription || data.error || `HTTP ${response.status}`
        throw new Error(`M-Pesa STK failed: ${errorMsg}`)
      }

      const responseCode = data.ResponseCode || data.errorCode
      console.log(`📋 STK Response Code: ${responseCode}`)
      console.log(`📋 STK Response Description: ${data.ResponseDescription || data.errorMessage || 'N/A'}`)

      if (responseCode === '0' || responseCode === 0) {
        console.log(`✅ STK Push success (ResponseCode: 0)`)
        console.log(`📋 CheckoutRequestID: ${data.CheckoutRequestID}`)
        return {
          success: true,
          checkoutRequestId: data.CheckoutRequestID,
          responseMessage: data.ResponseDescription,
        }
      } else {
        console.error(`❌ STK Push failed (ResponseCode: ${responseCode}): ${data.ResponseDescription}`)
        return {
          success: false,
          error: data.ResponseDescription || 'Failed to initiate payment',
        }
      }
    } catch (error) {
      // Enhance error for network issues
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`M-Pesa STK Push request timeout (25s) - network may be slow`)
        } else if (error.message?.includes('ECONNREFUSED')) {
          throw new Error(`M-Pesa STK endpoint connection refused`)
        } else if (error.message?.includes('ETIMEDOUT')) {
          throw new Error(`M-Pesa STK endpoint connection timeout`)
        }
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  } catch (error) {
    console.error('M-PESA payment initiation error:', error)
    throw error
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, queueId, phoneNumber, amount, goldenRef } = body

    if (!action) {
      return json({ error: 'Missing action' }, { status: 400 })
    }

    if (action === 'initiate-payment') {
      if (!queueId || !phoneNumber || !goldenRef) {
        return json({ 
          error: 'Missing required fields: queueId, phoneNumber, goldenRef' 
        }, { status: 400 })
      }

      // Get the queue entry to verify it's golden
      const entry = await db.query.queueEntries.findFirst({
        where: eq(queueEntries.id, queueId),
      })

      if (!entry || !entry.isGolden) {
        return json({ 
          error: 'Invalid queue entry or not marked as golden' 
        }, { status: 404 })
      }

      // Normalize phone number (ensure it starts with 254)
      let formattedPhone = phoneNumber.replace(/\D/g, '')
      if (!formattedPhone.startsWith('254')) {
        if (formattedPhone.startsWith('0')) {
          formattedPhone = '254' + formattedPhone.slice(1)
        } else {
          formattedPhone = '254' + formattedPhone
        }
      }

      try {
        const paymentResult = await initiateMpesaPayment(
          formattedPhone,
          amount || 50,
          queueId,
          goldenRef
        )

        if (paymentResult.success) {
          // 🔥 CRITICAL: Set status to PENDING immediately after STK push initiation
          // Status will only change to 'success' after M-Pesa callback
          await db.update(queueEntries)
            .set({
              mpesaTransactionId: paymentResult.checkoutRequestId,
              mpesaStatus: 'pending',  // 🔥 MUST be pending until callback
            })
            .where(eq(queueEntries.id, queueId))

          console.log(`✅ STK Push initiated. Status set to PENDING: ${paymentResult.checkoutRequestId}`)
          return json({
            success: true,
            message: 'Payment prompt sent to your phone',
            checkoutRequestId: paymentResult.checkoutRequestId,
            mpesaStatus: 'pending',
            environment: SANDBOX_MODE ? 'sandbox' : 'production',
          })
        } else {
          console.error(`❌ STK Push initiation failed: ${paymentResult.error}`)
          return json({
            success: false,
            error: paymentResult.error,
          }, { status: 400 })
        }
      } catch (error) {
        console.error('Payment initiation failed:', error)
        return json({
          success: false,
          error: 'Failed to initiate payment. Please try again.',
        }, { status: 500 })
      }
    }

    return json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('M-PESA endpoint error:', error)
    return json({ error: 'Failed to process payment request' }, { status: 500 })
  }
}
