import { json } from '@tanstack/start'
import { db } from '../../db/index'
import { queueEntries } from '../../db/schema'
import { eq, desc } from 'drizzle-orm'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const studentId = url.searchParams.get('studentId')

    if (!studentId) {
      return json({ error: 'Missing studentId parameter' }, { status: 400 })
    }

    const tickets = await db.query.queueEntries.findMany({
      where: eq(queueEntries.studentId, studentId),
      orderBy: desc(queueEntries.createdAt),
    })

    return json({
      tickets: tickets.map(t => ({
        id: t.id,
        name: t.name,
        studentId: t.studentId,
        serviceType: t.serviceType,
        queueNumber: t.queueNumber,
        status: t.status,
        createdAt: t.createdAt,
        servedAt: t.servedAt,
        isGolden: t.isGolden,
        goldenTicketRef: t.goldenTicketRef,
        mpesaStatus: t.mpesaStatus,
        mpesaPaidAt: t.mpesaPaidAt,
        calledNextAt: t.calledNextAt,
      })),
    })
  } catch (err) {
    console.error('[TicketHistory] Error:', err)
    return json({ error: 'Failed to fetch ticket history' }, { status: 500 })
  }
}
