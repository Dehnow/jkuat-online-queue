import { json } from '@tanstack/start'
import { db } from '../../../db/index'
import { offices, queueEntries } from '../../../db/schema'
import { eq, and } from 'drizzle-orm'

// Get queue status for a specific office
export async function GET(request: Request, { params }: { params: { officeId: string } }) {
  try {
    const officeId = parseInt(params.officeId)

    if (isNaN(officeId)) {
      return json({ error: 'Invalid office ID' }, { status: 400 })
    }

    const office = await db.query.offices.findFirst({
      where: eq(offices.id, officeId),
    })

    if (!office) {
      return json({ error: 'Office not found' }, { status: 404 })
    }

    // Get all queue entries for this office
    const allEntries = await db.query.queueEntries.findMany({
      where: eq(queueEntries.officeId, officeId),
    })

    const waitingEntries = allEntries.filter(e => e.status === 'waiting')
    const servingEntry = allEntries.find(e => e.status === 'serving')
    const servedEntries = allEntries.filter(e => e.status === 'served')
    const cancelledEntries = allEntries.filter(e => e.status === 'cancelled')

    return json({
      office: {
        id: office.id,
        name: office.name,
        serviceType: office.serviceType,
        status: office.status,
      },
      queue: {
        waiting: waitingEntries,
        serving: servingEntry || null,
        served: servedEntries,
        cancelled: cancelledEntries,
        waitingCount: waitingEntries.length,
        totalServedToday: servedEntries.filter(e => 
          new Date(e.servedAt!).toDateString() === new Date().toDateString()
        ).length,
      },
    })
  } catch (err) {
    console.error('[Office Queue] Error:', err)
    return json({ error: 'Failed to fetch queue status' }, { status: 500 })
  }
}
