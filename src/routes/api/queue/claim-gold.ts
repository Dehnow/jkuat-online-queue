import { json } from '@tanstack/start'
import { db } from '../../../db/index'
import { queueEntries } from '../../../db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { queueId, serviceType } = body

    if (!queueId || !serviceType) {
      return json({ error: 'Missing queueId or serviceType' }, { status: 400 })
    }

    // Get the golden ticket entry
    const goldenTicket = await db.query.queueEntries.findFirst({
      where: eq(queueEntries.id, queueId),
    })

    if (!goldenTicket) {
      return json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Verify it's a golden ticket
    if (!goldenTicket.isGolden || goldenTicket.mpesaStatus !== 'success') {
      return json({ error: 'This is not a valid golden ticket' }, { status: 400 })
    }

    // Get all waiting tickets for this service, ordered by queue number
    const waitingTickets = await db.query.queueEntries.findMany({
      where: and(
        eq(queueEntries.serviceType, serviceType),
        eq(queueEntries.status, 'waiting')
      ),
      orderBy: (table, { asc }) => [asc(table.queueNumber)],
    })

    // Implement 65/35 split logic
    // 65% normal priority - tickets can't go past 65% of the queue
    // 35% golden priority - golden tickets move to ~35% position
    const cutoffIndex = Math.max(2, Math.ceil(waitingTickets.length * 0.65))
    
    // Find the highest queue number in the top 35% (priority zone)
    let newQueueNumber = goldenTicket.queueNumber
    
    if (waitingTickets.length > 0) {
      const priorityTickets = waitingTickets.slice(0, cutoffIndex)
      if (priorityTickets.length > 0) {
        // Get the highest queue number in the priority zone
        const maxInPriority = Math.max(...priorityTickets.map(t => t.queueNumber))
        // Place the golden ticket right after the priority zone
        newQueueNumber = maxInPriority + 1
      }
    }

    // Update the golden ticket's queue number to reflect its new position
    await db.update(queueEntries)
      .set({
        queueNumber: newQueueNumber,
      })
      .where(eq(queueEntries.id, queueId))

    return json({
      success: true,
      message: '✅ Golden ticket claimed! Ticket has been moved up in queue with priority access.',
      goldenTicketData: {
        id: goldenTicket.id,
        goldenTicketRef: goldenTicket.goldenTicketRef,
        oldQueueNumber: goldenTicket.queueNumber,
        newQueueNumber: newQueueNumber,
        newPosition: `Approximately ${cutoffIndex} positions from start`,
        serviceType: serviceType,
      }
    })
  } catch (error) {
    console.error('Error claiming golden ticket:', error)
    return json({ error: 'Failed to claim golden ticket' }, { status: 500 })
  }
}
