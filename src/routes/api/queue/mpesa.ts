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

    const response = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
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
    })

    const data: any = await response.json()
    
    if (data.ResponseCode === '0') {
      return {
        success: true,
        checkoutRequestId: data.CheckoutRequestID,
        responseMessage: data.ResponseDescription,
      }
    } else {
      return {
        success: false,
        error: data.ResponseDescription || 'Failed to initiate payment',
      }
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
          // 🔥 CRITICAL: Validate CheckoutRequestID before storing
          if (!paymentResult.checkoutRequestId || paymentResult.checkoutRequestId.trim() === '') {
            console.error(`❌ CRITICAL: M-Pesa returned empty CheckoutRequestID`)
            return json({
              error: 'Invalid M-Pesa response',
              message: 'M-Pesa did not return a valid CheckoutRequestID. Please try again.'
            }, { status: 500 })
          }

          try {
            // 🔥 CRITICAL: Set status to PENDING immediately after STK push initiation
            // Status will only change to 'success' after M-Pesa callback
            const updateResult = await db.update(queueEntries)
              .set({
                mpesaTransactionId: paymentResult.checkoutRequestId,
                mpesaStatus: 'pending',  // 🔥 MUST be pending until callback
              })
              .where(eq(queueEntries.id, queueId))
              .returning()

            // VALIDATION: Ensure database update succeeded
            if (!updateResult || updateResult.length === 0) {
              console.error(`❌ CRITICAL: Database update failed for queue ${queueId}`)
              return json({
                error: 'Database error',
                message: 'Failed to store transaction ID in database'
              }, { status: 500 })
            }

            // VERIFICATION: Confirm the CheckoutRequestID was actually stored
            const storedEntry = updateResult[0]
            if (storedEntry.mpesaTransactionId !== paymentResult.checkoutRequestId) {
              console.error(`❌ CRITICAL: CheckoutRequestID not stored correctly`)
              console.error(`   Expected: ${paymentResult.checkoutRequestId}`)
              console.error(`   Stored: ${storedEntry.mpesaTransactionId}`)
              return json({
                error: 'Data verification failed',
                message: 'Transaction ID was not stored correctly'
              }, { status: 500 })
            }

            console.log(`✅ STK Push initiated. Status set to PENDING: ${paymentResult.checkoutRequestId}`)
            console.log(`   ✓ Verified in database`)
            return json({
              success: true,
              message: 'Payment prompt sent to your phone',
              checkoutRequestId: paymentResult.checkoutRequestId,
              verified: true,
              mpesaStatus: 'pending',
              environment: SANDBOX_MODE ? 'sandbox' : 'production',
            })
          } catch (dbError) {
            console.error(`❌ Database error while storing CheckoutRequestID:`, dbError)
            return json({
              error: 'Database error',
              message: 'Failed to store transaction ID in database. Please contact support.',
              details: (dbError as Error).message,
            }, { status: 500 })
          }
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
