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

    // Parse the golden ticket reference from callback metadata
    let goldenTicketRef = ''
    if (CallbackMetadata?.Item) {
      const items = Array.isArray(CallbackMetadata.Item) ? CallbackMetadata.Item : [CallbackMetadata.Item]
      const accountRefItem = items.find((item: any) => item.Name === 'AccountReference')
      if (accountRefItem) {
        goldenTicketRef = accountRefItem.Value
      }
    }

    // Find the queue entry by golden ticket ref
    const entry = await db.query.queueEntries.findFirst({
      where: eq(queueEntries.goldenTicketRef, goldenTicketRef),
    })

    if (!entry) {
      console.error(`No queue entry found for golden ticket ref: ${goldenTicketRef}`)
      return json({
        success: false,
        message: 'Queue entry not found',
      }, { status: 404 })
    }

    // Handle payment result
    if (ResultCode === 0) {
      // Payment successful
      const mpesaAmount = CallbackMetadata?.Item?.find((item: any) => item.Name === 'Amount')?.Value || 0
      const mpesaTransactionId = CallbackMetadata?.Item?.find((item: any) => item.Name === 'MpesaReceiptNumber')?.Value || CheckoutRequestID

      await db.update(queueEntries)
        .set({
          mpesaStatus: 'success',
          mpesaTransactionId: mpesaTransactionId,
          mpesaPaidAt: new Date(),
        })
        .where(eq(queueEntries.id, entry.id))

      console.log(`Golden ticket payment successful: ${goldenTicketRef}`)
      return json({
        success: true,
        message: 'Payment processed successfully',
      })
    } else {
      // Payment failed or was cancelled
      await db.update(queueEntries)
        .set({
          mpesaStatus: 'failed',
          mpesaTransactionId: CheckoutRequestID,
        })
        .where(eq(queueEntries.id, entry.id))

      console.error(`Golden ticket payment failed: ${goldenTicketRef} - ${ResultDesc}`)
      return json({
        success: false,
        message: `Payment failed: ${ResultDesc}`,
      })
    }
  } catch (error) {
    console.error('M-PESA callback error:', error)
    return json({
      success: false,
      error: 'Failed to process callback',
    }, { status: 500 })
  }
}
