import { json } from '@tanstack/start'
import { db } from '../../../db/index'
import { queueEntries } from '../../../db/schema'
import { eq, and, lt } from 'drizzle-orm'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return json({ error: 'Invalid queue entry ID' }, { status: 400 })
    }

    // Get the specific queue entry
    const entry = await db.query.queueEntries.findFirst({
      where: eq(queueEntries.id, id),
    })

    if (!entry) {
      return json({ error: 'Queue entry not found' }, { status: 404 })
    }

    // Count how many are ahead in queue (for non-golden tickets)
    // Golden tickets don't count towards wait time if payment is pending
    const aheadCount = await db.query.queueEntries.findMany({
      where: and(
        eq(queueEntries.serviceType, entry.serviceType),
        eq(queueEntries.status, 'waiting'),
        lt(queueEntries.createdAt, entry.createdAt)
      ),
    })

    // Get currently serving
    const serving = await db.query.queueEntries.findFirst({
      where: and(
        eq(queueEntries.serviceType, entry.serviceType),
        eq(queueEntries.status, 'serving')
      ),
    })

    return json({
      id: entry.id,
      queueNumber: entry.queueNumber,
      status: entry.status,
      name: entry.name,
      studentId: entry.studentId,
      service: entry.serviceType,
      createdAt: entry.createdAt,
      servedAt: entry.servedAt,
      positionInQueue: aheadCount.length + 1,
      aheadOfYou: aheadCount.length,
      nowServing: serving?.queueNumber || null,
      estimatedWaitTime: Math.ceil((aheadCount.length * 5) / 60),
      // Golden ticket info
      isGolden: entry.isGolden,
      goldenTicketRef: entry.goldenTicketRef,
      mpesaStatus: entry.mpesaStatus,
      mpesaPaidAt: entry.mpesaPaidAt,
    })
  } catch (error) {
    console.error('Queue GET/:id error:', error)
    return json({ error: 'Failed to fetch queue entry' }, { status: 500 })
  }
}
