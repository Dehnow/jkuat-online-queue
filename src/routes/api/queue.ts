import { json } from '@tanstack/start'
import { db } from '../../db/index'
import { queueEntries } from '../../db/schema'
import { eq, and } from 'drizzle-orm'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const service = url.searchParams.get('service')

    if (!service) {
      return json({ error: 'Service parameter is required' }, { status: 400 })
    }

    // Get waiting queue count
    const waitingQueue = await db.query.queueEntries.findMany({
      where: and(
        eq(queueEntries.serviceType, service as 'registrar' | 'finance' | 'ict_helpdesk'),
        eq(queueEntries.status, 'waiting')
      ),
      orderBy: (entries) => entries.createdAt,
    })

    // Get currently serving entry
    const serving = await db.query.queueEntries.findFirst({
      where: and(
        eq(queueEntries.serviceType, service as 'registrar' | 'finance' | 'ict_helpdesk'),
        eq(queueEntries.status, 'serving')
      ),
    })

    return json({
      service,
      waitingCount: waitingQueue.length,
      serving: serving ? { 
        id: serving.id,
        queueNumber: serving.queueNumber,
        name: serving.name,
        studentId: serving.studentId
      } : null,
      estimatedWaitTime: Math.ceil((waitingQueue.length * 5) / 60), // ~5 min per customer
    })
  } catch (error) {
    console.error('Queue GET error:', error)
    return json({ error: 'Failed to fetch queue' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, studentId, service } = body

    if (!name || !studentId || !service) {
      return json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get next queue number for this service
    const lastEntry = await db.query.queueEntries.findFirst({
      where: eq(queueEntries.serviceType, service as 'registrar' | 'finance' | 'ict_helpdesk'),
      orderBy: (entries) => entries.queueNumber,
    })

    const nextQueueNumber = (lastEntry?.queueNumber || 0) + 1

    // Create queue entry
    const entry = await db
      .insert(queueEntries)
      .values({
        name,
        studentId,
        serviceType: service as 'registrar' | 'finance' | 'ict_helpdesk',
        queueNumber: nextQueueNumber,
        status: 'waiting',
      })
      .returning()

    return json({
      success: true,
      queueNumber: nextQueueNumber,
      id: entry[0]?.id,
      ticketReference: `${service.toUpperCase()}-${nextQueueNumber}`,
    })
  } catch (error) {
    console.error('Queue POST error:', error)
    return json({ error: 'Failed to join queue' }, { status: 500 })
  }
}
