import { json } from '@tanstack/start'
import { db } from '../../db/index'
import { queueEntries } from '../../db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * GET /api/getQueueStatus?service={serviceType}
 * 
 * Returns current queue statistics for a specific service
 * - Number of people waiting
 * - Currently serving customer details
 * - Real-time queue state
 */
export async function GET(request: Request) {
  try {
    // Get service type from query parameters
    const url = new URL(request.url)
    const service = url.searchParams.get('service')

    if (!service) {
      return json(
        { error: 'Missing service parameter', code: 'MISSING_SERVICE' },
        { status: 400 }
      )
    }

    // Validate service type
    const validServices = ['registrar', 'finance', 'ict_helpdesk']
    if (!validServices.includes(service)) {
      return json(
        { error: `Invalid service type. Must be one of: ${validServices.join(', ')}`, code: 'INVALID_SERVICE' },
        { status: 400 }
      )
    }

    // Check if database is initialized
    if (!db) {
      return json(
        { error: 'Database not initialized', code: 'DB_NOT_READY' },
        { status: 503 }
      )
    }

    // Get count of people waiting
    const waitingResult = await db.query.queueEntries.findMany({
      where: and(
        eq(queueEntries.serviceType, service),
        eq(queueEntries.status, 'waiting')
      ),
      columns: { id: true }
    })
    const waitingCount = waitingResult.length

    // Get currently serving customer
    const serving = await db.query.queueEntries.findFirst({
      where: and(
        eq(queueEntries.serviceType, service),
        eq(queueEntries.status, 'serving')
      )
    })

    // Return queue status
    return json({
      success: true,
      service,
      timestamp: new Date().toISOString(),
      queue: {
        waitingCount,
        serving: serving ? {
          id: serving.id,
          queueNumber: serving.queueNumber,
          studentId: serving.studentId,
          name: serving.name,
          serviceType: serving.serviceType,
          status: serving.status,
          createdAt: serving.createdAt,
          isGolden: serving.isGolden,
        } : null,
        totalServed: (
          await db.query.queueEntries.findMany({
            where: and(
              eq(queueEntries.serviceType, service),
              eq(queueEntries.status, 'served')
            ),
            columns: { id: true }
          })
        ).length,
        cancelled: (
          await db.query.queueEntries.findMany({
            where: and(
              eq(queueEntries.serviceType, service),
              eq(queueEntries.status, 'cancelled')
            ),
            columns: { id: true }
          })
        ).length,
      }
    })
  } catch (error) {
    console.error('[getQueueStatus] Error:', error)
    return json(
      {
        error: 'Failed to fetch queue status',
        code: 'QUEUE_FETCH_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    )
  }
}
