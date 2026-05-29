import { json } from '@tanstack/start'
import { db } from '../../../db/index'
import { queueEntries } from '../../../db/schema'
import { eq, and } from 'drizzle-orm'

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
        // Get next waiting entry
        const nextEntry = await db.query.queueEntries.findFirst({
          where: and(
            eq(queueEntries.officeId, officeId),
            eq(queueEntries.status, 'waiting')
          ),
        })

        if (nextEntry) {
          // Update to serving
          await db.update(queueEntries)
            .set({ status: 'serving' })
            .where(eq(queueEntries.id, nextEntry.id))

          return json({
            success: true,
            action: 'call_next',
            entry: {
              id: nextEntry.id,
              name: nextEntry.name,
              queueNumber: nextEntry.queueNumber,
              status: 'serving',
            },
            message: 'Calling next customer',
          })
        }
        return json({ error: 'No waiting customers' }, { status: 404 })
      }

      case 'start_service': {
        // Update status to serving
        await db.update(queueEntries)
          .set({ status: 'serving' })
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
        await db.update(queueEntries)
          .set({ status: 'cancelled' })
          .where(eq(queueEntries.id, queueId))

        return json({
          success: true,
          action: 'cancel',
          message: 'Ticket cancelled',
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
