import { json } from '@tanstack/start'
import { db } from '../../../../db/index'
import { queueEntries } from '../../../../db/schema'
import { eq } from 'drizzle-orm'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id)
    
    if (isNaN(id)) {
      return json({ error: 'Invalid queue entry ID' }, { status: 400 })
    }

    const entry = await db.query.queueEntries.findFirst({
      where: eq(queueEntries.id, id),
      columns: {
        id: true,
        isGolden: true,
        mpesaStatus: true,
        mpesaTransactionId: true,
        mpesaPaidAt: true,
        goldenTicketRef: true,
        status: true,
      },
    })

    if (!entry) {
      return json({ error: 'Queue entry not found' }, { status: 404 })
    }

    // Build comprehensive feedback object
    const feedback = {
      isPending: entry.mpesaStatus === 'pending',
      isSuccessful: entry.isGolden && entry.mpesaStatus === 'success',
      isFailed: entry.mpesaStatus === 'failed',
      message: entry.isGolden 
        ? entry.mpesaStatus === 'success'
          ? '✅ Golden ticket activated! You now have priority status.'
          : entry.mpesaStatus === 'failed'
          ? '❌ Payment was cancelled or failed. Please try again.'
          : '⏳ Waiting for M-Pesa response... Complete payment on your phone.'
        : entry.mpesaStatus === 'success'
        ? '✅ Payment successful!'
        : entry.mpesaStatus === 'failed'
        ? '❌ Payment failed. Please try again.'
        : '⏳ Waiting for payment confirmation...'
    }

    return json(
      {
        id: entry.id,
        isGolden: entry.isGolden,
        mpesaStatus: entry.mpesaStatus,
        mpesaTransactionId: entry.mpesaTransactionId,
        mpesaPaidAt: entry.mpesaPaidAt,
        goldenTicketRef: entry.goldenTicketRef,
        status: entry.status,
        feedback, // ← Comprehensive feedback object
        success: true,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error checking M-Pesa status:', error)
    return json({ 
      error: 'Internal server error',
      feedback: {
        isPending: false,
        isSuccessful: false,
        isFailed: true,
        message: '❌ Error checking payment status. Please try again.'
      },
      success: false
    }, { status: 500 })
  }
}
