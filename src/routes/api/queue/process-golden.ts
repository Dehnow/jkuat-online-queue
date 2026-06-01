import { json } from '@tanstack/start'
import { db } from '../../../db/index'
import { queueEntries } from '../../../db/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { queueId, action, phoneNumber } = body

    if (!queueId || !action) {
      return json({ error: 'Missing required fields' }, { status: 400 })
    }

    const entry = await db.query.queueEntries.findFirst({
      where: eq(queueEntries.id, queueId),
    })

    if (!entry) {
      return json({ error: 'Queue entry not found' }, { status: 404 })
    }

    if (!entry.isGolden) {
      return json({ error: 'Not a golden ticket' }, { status: 400 })
    }

    switch (action) {
      case 'confirm': {
        // Validate phone number for M-Pesa
        if (!phoneNumber || phoneNumber.length < 9) {
          return json({
            success: false,
            status: 'failed',
            message: 'Invalid phone number',
          }, { status: 400 })
        }

        // Mark as confirmed and ready for payment
        await db.update(queueEntries)
          .set({
            mpesaStatus: 'pending',
          })
          .where(eq(queueEntries.id, queueId))

        return json({
          success: true,
          status: 'successful',
          message: 'Golden ticket confirmed. Proceeding with payment...',
          nextStep: 'initiate_mpesa',
          ticketRef: entry.goldenTicketRef,
          phoneNumber: phoneNumber,
        })
      }

      case 'cancel': {
        // Reset golden status on cancel
        await db.update(queueEntries)
          .set({
            isGolden: false,
            goldenTicketRef: null,
            mpesaStatus: null,
          })
          .where(eq(queueEntries.id, queueId))

        return json({
          success: true,
          status: 'cancelled',
          message: 'Golden ticket registration cancelled',
          allowRetry: true,
          newPhoneNumberAllowed: true,
        })
      }

      case 'retry': {
        // Retry with potentially different phone number
        if (!phoneNumber) {
          return json({ error: 'Phone number required for retry' }, { status: 400 })
        }

        return json({
          success: true,
          status: 'retry_initiated',
          message: 'Retrying payment with provided phone number',
          phoneNumber: phoneNumber,
          nextStep: 'initiate_mpesa',
          ticketRef: entry.goldenTicketRef,
        })
      }

      default:
        return json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Process golden error:', error)
    return json({ error: 'Failed to process golden ticket' }, { status: 500 })
  }
}
