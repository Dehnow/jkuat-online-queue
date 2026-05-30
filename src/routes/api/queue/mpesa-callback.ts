import { json } from '@tanstack/start'
import { db } from '../../../db/index'
import { queueEntries } from '../../../db/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = body.Body?.stkCallback || {}

    const {
      MerchantRequestID,
      CheckoutRequestID,
      ResultCode,
      ResultDesc,
      CallbackMetadata,
    } = result

    console.log('🔔 M-Pesa Callback Received')
    console.log(`   CheckoutRequestID: ${CheckoutRequestID}`)
    console.log(`   ResultCode: ${ResultCode}`)
    console.log(`   ResultDesc: ${ResultDesc}`)

    // Normalize ResultCode to number for comparison
    const resultCodeNum = Number(ResultCode)

    // Parse the golden ticket reference from callback metadata
    let goldenTicketRef = ''
    let mpesaAmount = 0
    let mpesaTransactionId = CheckoutRequestID

    if (CallbackMetadata?.Item) {
      const items = Array.isArray(CallbackMetadata.Item) ? CallbackMetadata.Item : [CallbackMetadata.Item]
      const accountRefItem = items.find((item: any) => item.Name === 'AccountReference')
      if (accountRefItem) {
        goldenTicketRef = accountRefItem.Value
      }
      const amountItem = items.find((item: any) => item.Name === 'Amount')
      if (amountItem) {
        mpesaAmount = amountItem.Value
      }
      const receiptItem = items.find((item: any) => item.Name === 'MpesaReceiptNumber')
      if (receiptItem) {
        mpesaTransactionId = receiptItem.Value
      }
    }

    console.log(`   GoldenTicketRef: ${goldenTicketRef}`)
    console.log(`   Amount: ${mpesaAmount}`)
    console.log(`   ReceiptNumber: ${mpesaTransactionId}`)

    // Find the queue entry by golden ticket ref
    let entry = await db.query.queueEntries.findFirst({
      where: eq(queueEntries.goldenTicketRef, goldenTicketRef),
    })

    // Fallback: if no golden ticket ref found, try to find by CheckoutRequestID
    if (!entry && CheckoutRequestID) {
      entry = await db.query.queueEntries.findFirst({
        where: eq(queueEntries.mpesaTransactionId, CheckoutRequestID),
      })
    }

    if (!entry) {
      console.error(`❌ No queue entry found for golden ticket ref: ${goldenTicketRef} or CheckoutRequestID: ${CheckoutRequestID}`)
      return json({
        success: false,
        message: 'Queue entry not found',
      }, { status: 404 })
    }

    console.log(`✅ Queue entry found: ID=${entry.id}, Status=${entry.mpesaStatus}`)

    // CRITICAL: Prevent double-processing of same transaction
    if (entry.mpesaStatus === 'success' || entry.mpesaStatus === 'failed') {
      console.warn(`⚠️ Transaction already processed. Ignoring duplicate callback. Status: ${entry.mpesaStatus}`)
      return json({
        success: true,
        message: 'Callback already processed',
      })
    }

    // Handle payment result
    if (resultCodeNum === 0) {
      // ✅ Payment successful - CRITICAL: Set isGolden = true here!
      console.log(`✅ Payment successful for queue ${entry.id}`)

      const updateResult = await db.update(queueEntries)
        .set({
          isGolden: true,  // 🔥 CRITICAL FIX: Set golden ticket flag on successful payment
          mpesaStatus: 'success',
          mpesaTransactionId: mpesaTransactionId,
          mpesaPaidAt: new Date(),
        })
        .where(eq(queueEntries.id, entry.id))

      console.log(`✅ Database updated: Queue ${entry.id} now has isGolden=true, mpesaStatus=success`)
      console.log(`✅ Golden ticket payment successful: ${goldenTicketRef} (Amount: KES ${mpesaAmount}, Receipt: ${mpesaTransactionId})`)

      return json({
        success: true,
        message: 'Payment processed successfully',
        queueId: entry.id,
        goldenTicketRef: goldenTicketRef,
      })
    } else if (resultCodeNum === 1 || resultCodeNum === 2) {
      // User cancelled or didn't complete payment
      console.log(`⚠️ Payment cancelled/incomplete for queue ${entry.id}: ${ResultDesc}`)

      await db.update(queueEntries)
        .set({
          mpesaStatus: 'failed',
          mpesaTransactionId: mpesaTransactionId,
        })
        .where(eq(queueEntries.id, entry.id))

      return json({
        success: false,
        message: `Payment cancelled: ${ResultDesc}`,
      })
    } else {
      // Other errors
      console.error(`❌ Payment failed for queue ${entry.id}: ${ResultDesc}`)

      await db.update(queueEntries)
        .set({
          mpesaStatus: 'failed',
          mpesaTransactionId: mpesaTransactionId,
        })
        .where(eq(queueEntries.id, entry.id))

      return json({
        success: false,
        message: `Payment failed: ${ResultDesc}`,
      })
    }
  } catch (error) {
    console.error('❌ M-PESA callback error:', error)
    return json({
      success: false,
      error: 'Failed to process callback',
    }, { status: 500 })
  }
}
