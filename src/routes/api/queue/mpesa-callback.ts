import { json } from '@tanstack/start'
import { db } from '../../../db/index'
import { queueEntries } from '../../../db/schema'
import { eq } from 'drizzle-orm'

// Helper: Extract callback metadata safely
function extractCallbackMetadata(metadata: any) {
  const result = {
    accountReference: '',
    amount: 0,
    mpesaReceiptNumber: '',
    phoneNumber: '',
  }
  
  try {
    if (!metadata?.Item) return result
    const items = Array.isArray(metadata.Item) ? metadata.Item : [metadata.Item]
    
    items.forEach((item: any) => {
      const name = String(item?.Name || '').toLowerCase()
      const value = item?.Value
      
      if (name.includes('account') || name.includes('reference')) {
        result.accountReference = String(value || '')
      }
      if (name.includes('amount')) {
        result.amount = Number(value || 0)
      }
      if (name.includes('receipt') || name.includes('transactionid')) {
        result.mpesaReceiptNumber = String(value || '')
      }
      if (name.includes('phone')) {
        result.phoneNumber = String(value || '')
      }
    })
  } catch (error) {
    console.warn('⚠️  Error parsing callback metadata:', error)
  }
  
  return result
}

// Handle GET requests (health checks, browser visits)
export async function GET(request: Request) {
  console.log('ℹ️  GET /api/queue/mpesa-callback - Health check')
  return json({
    status: 'ok',
    message: 'M-Pesa callback endpoint is live',
    method: 'POST',
    note: 'This endpoint accepts POST requests from M-Pesa with callback data',
  }, { status: 200 })
}

export async function POST(request: Request) {
  try {
    // Safely parse JSON body
    let body: any = {}
    try {
      body = await request.json()
    } catch (parseError) {
      console.warn('⚠️  Failed to parse JSON body:', parseError)
      // Return 200 OK anyway - don't want M-Pesa retrying forever
      return json({
        success: true,
        message: 'Callback received',
      }, { status: 200 })
    }

    // Safely extract callback data
    const result = body?.Body?.stkCallback

    // If no callback data found, still return 200 OK
    if (!result) {
      console.warn('⚠️  No stkCallback data in request body')
      return json({
        success: true,
        message: 'Callback received',
      }, { status: 200 })
    }

    // Safely extract callback fields (all optional)
    const MerchantRequestID = result?.MerchantRequestID || ''
    const CheckoutRequestID = result?.CheckoutRequestID || ''
    const ResultCode = result?.ResultCode
    const ResultDesc = result?.ResultDesc || 'Unknown'
    const CallbackMetadata = result?.CallbackMetadata

    console.log('🔔 M-Pesa Callback Received')
    console.log(`   CheckoutRequestID: ${CheckoutRequestID}`)
    console.log(`   ResultCode: ${ResultCode}`)
    console.log(`   ResultDesc: ${ResultDesc}`)

    // Normalize ResultCode
    const resultCodeNum = Number(ResultCode)

    // Extract metadata safely
    const metadata = extractCallbackMetadata(CallbackMetadata)
    const goldenTicketRef = metadata.accountReference
    const mpesaAmount = metadata.amount
    const mpesaTransactionId = metadata.mpesaReceiptNumber || CheckoutRequestID

    console.log(`   GoldenTicketRef: ${goldenTicketRef}`)
    console.log(`   Amount: ${mpesaAmount}`)
    console.log(`   ReceiptNumber: ${mpesaTransactionId}`)

    // STRATEGY: Try multiple lookup methods
    let entry = null

    // Method 1: By golden ticket ref
    if (goldenTicketRef) {
      entry = await db.query.queueEntries.findFirst({
        where: eq(queueEntries.goldenTicketRef, goldenTicketRef),
      })
      if (entry) console.log(`✅ Found entry by goldenTicketRef: ${goldenTicketRef}`)
    }

    // Method 2: By CheckoutRequestID
    if (!entry && CheckoutRequestID) {
      entry = await db.query.queueEntries.findFirst({
        where: eq(queueEntries.mpesaTransactionId, CheckoutRequestID),
      })
      if (entry) console.log(`✅ Found entry by CheckoutRequestID: ${CheckoutRequestID}`)
    }

    // Method 3: By MpesaReceiptNumber
    if (!entry && mpesaTransactionId && mpesaTransactionId !== CheckoutRequestID) {
      entry = await db.query.queueEntries.findFirst({
        where: eq(queueEntries.mpesaTransactionId, mpesaTransactionId),
      })
      if (entry) console.log(`✅ Found entry by ReceiptNumber: ${mpesaTransactionId}`)
    }

    if (!entry) {
      console.warn(`⚠️  No queue entry found`)
      console.warn(`   Searched: goldenTicketRef="${goldenTicketRef}", CheckoutID="${CheckoutRequestID}", Receipt="${mpesaTransactionId}"`)
      console.warn(`   Will not be able to update database, but returning 200 OK to M-Pesa`)
      
      // ✅ ALWAYS return 200 OK - M-Pesa must complete its request
      return json({
        success: true,
        message: 'Callback received',
      }, { status: 200 })
    }

    console.log(`✅ Queue entry found: ID=${entry.id}, Status=${entry.mpesaStatus}`)

    // CRITICAL: Prevent double-processing
    if (entry.mpesaStatus === 'success' || entry.mpesaStatus === 'failed') {
      console.warn(`⚠️  Transaction already processed with status: ${entry.mpesaStatus}`)
      return json({
        success: true,
        message: 'Callback already processed',
      }, { status: 200 })
    }

    // Handle payment result
    if (resultCodeNum === 0) {
      // ✅ PAYMENT SUCCESSFUL
      console.log(`✅ Payment successful for queue ${entry.id}`)

      const updateResult = await db.update(queueEntries)
        .set({
          isGolden: true,  // 🔥 CRITICAL: Mark as golden ticket
          mpesaStatus: 'success',
          mpesaTransactionId: mpesaTransactionId,
          mpesaPaidAt: new Date(),
        })
        .where(eq(queueEntries.id, entry.id))

      console.log(`✅ Database updated: Queue ${entry.id} is now a GOLDEN TICKET`)
      console.log(`   Reference: ${goldenTicketRef}`)
      console.log(`   Amount: KES ${mpesaAmount}`)
      console.log(`   Receipt: ${mpesaTransactionId}`)

      // ✅ ALWAYS return 200 OK
      return json({
        success: true,
        message: 'Payment processed successfully',
        queueId: entry.id,
        goldenTicketRef: goldenTicketRef,
      }, { status: 200 })
    } else if (resultCodeNum === 1 || resultCodeNum === 2) {
      // ❌ USER CANCELLED or INCOMPLETE
      console.log(`⚠️  Payment cancelled/incomplete for queue ${entry.id}: ${ResultDesc}`)

      await db.update(queueEntries)
        .set({
          mpesaStatus: 'failed',
          mpesaTransactionId: mpesaTransactionId,
        })
        .where(eq(queueEntries.id, entry.id))

      // ✅ ALWAYS return 200 OK
      return json({
        success: true,
        message: 'Callback received',
      }, { status: 200 })
    } else {
      // ❌ OTHER ERROR
      console.error(`❌ Payment failed for queue ${entry.id}: ResultCode=${resultCodeNum}`)

      await db.update(queueEntries)
        .set({
          mpesaStatus: 'failed',
          mpesaTransactionId: mpesaTransactionId,
        })
        .where(eq(queueEntries.id, entry.id))

      // ✅ ALWAYS return 200 OK
      return json({
        success: true,
        message: 'Callback received',
      }, { status: 200 })
    }
  } catch (error) {
    console.error('❌ M-PESA callback error:', error)
    
    // ✅ ALWAYS return 200 OK even on error
    // This prevents M-Pesa from retrying forever
    return json({
      success: true,
      message: 'Callback received',
    }, { status: 200 })
  }
}
