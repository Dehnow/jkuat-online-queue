import { json } from '@tanstack/start'
import { db } from '../../../db/index'
import { queueEntries } from '../../../db/schema'
import { eq, and, desc } from 'drizzle-orm'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, queueId, officeId } = body

    if (!action || !queueId || !officeId) {
      return json({ error: 'Missing required fields' }, { status: 400 })
    }

    const entry = await db.query.queueEntries.findFirst({
      where: eq(queueEntries.id, queueId),
    })

    if (!entry) {
      return json({ error: 'Queue entry not found' }, { status: 404 })
    }

    switch (action) {
      case 'call_next': {
        // Priority: Golden tickets with successful payment first
        let nextEntry = await db.query.queueEntries.findFirst({
          where: and(
            eq(queueEntries.officeId, officeId),
            eq(queueEntries.status, 'waiting'),
            eq(queueEntries.isGolden, true),
            eq(queueEntries.mpesaStatus, 'success')
          ),
          orderBy: (table, { asc }) => [asc(table.queueNumber)],
        })

        // If no golden tickets, get regular waiting entry
        if (!nextEntry) {
          nextEntry = await db.query.queueEntries.findFirst({
            where: and(
              eq(queueEntries.officeId, officeId),
              eq(queueEntries.status, 'waiting'),
              eq(queueEntries.isGolden, false)
            ),
            orderBy: (table, { asc }) => [asc(table.queueNumber)],
          })
        }

        if (nextEntry) {
          // Update to serving and set calledNextAt timestamp
          await db.update(queueEntries)
            .set({ status: 'serving', calledNextAt: new Date() })
            .where(eq(queueEntries.id, nextEntry.id))

          const ticketLabel = nextEntry.isGolden && nextEntry.mpesaStatus === 'success'
            ? `${nextEntry.queueNumber} ✨ (GOLDEN TICKET)`
            : nextEntry.queueNumber.toString()

          return json({
            success: true,
            action: 'call_next',
            entry: {
              id: nextEntry.id,
              name: nextEntry.name,
              queueNumber: nextEntry.queueNumber,
              status: 'serving',
              isGolden: nextEntry.isGolden,
              goldenTicketRef: nextEntry.goldenTicketRef,
            },
            message: nextEntry.isGolden ? 'Calling golden ticket holder 🎫' : 'Calling next customer',
            ticketLabel,
          })
        }
        return json({ error: 'No waiting customers' }, { status: 404 })
      }

      case 'start_service': {
        // Update status to serving and clear calledNextAt
        await db.update(queueEntries)
          .set({ status: 'serving', calledNextAt: null })
          .where(eq(queueEntries.id, queueId))

        return json({
          success: true,
          action: 'start_service',
          message: 'Service started',
        })
      }

      case 'end_service': {
        // Update status to served
        await db.update(queueEntries)
          .set({ status: 'served', servedAt: new Date() })
          .where(eq(queueEntries.id, queueId))

        return json({
          success: true,
          action: 'end_service',
          message: 'Service ended',
        })
      }

      case 'cancel': {
        // Update status to cancelled
        // Note: Cancelled golden tickets should still be tracked for refund/records
        const willCancel = await db.query.queueEntries.findFirst({
          where: eq(queueEntries.id, queueId),
        })

        await db.update(queueEntries)
          .set({ status: 'cancelled' })
          .where(eq(queueEntries.id, queueId))

        return json({
          success: true,
          action: 'cancel',
          message: willCancel?.isGolden ? 'Golden ticket cancelled (may be eligible for refund)' : 'Ticket cancelled',
        })
      }

      default:
        return json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (err) {
    console.error('[Queue Action] Error:', err)
    return json({ error: 'Failed to perform action' }, { status: 500 })
  }
}
