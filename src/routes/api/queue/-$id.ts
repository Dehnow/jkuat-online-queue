import { json } from '@tanstack/start'
import { db } from '../../../db/index'
import { queueEntries, studentDebts } from '../../../db/schema'
import { eq, and, lt } from 'drizzle-orm'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id)

    if (isNaN(id)) {
      return json({ error: 'Invalid queue entry ID' }, { status: 400 })
    }

    const entry = await db.query.queueEntries.findFirst({
      where: eq(queueEntries.id, id),
    })

    if (!entry) {
      return json({ error: 'Queue entry not found' }, { status: 404 })
    }

    // Check for pending debts
    const debts = await db.query.studentDebts.findMany({
      where: and(
        eq(studentDebts.studentId, entry.studentId),
        eq(studentDebts.status, 'pending')
      ),
    })

    const aheadCount = await db.query.queueEntries.findMany({
      where: and(
        eq(queueEntries.serviceType, entry.serviceType),
        eq(queueEntries.status, 'waiting'),
        lt(queueEntries.createdAt, entry.createdAt)
      ),
    })

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
      isGolden: entry.isGolden,
      goldenTicketRef: entry.goldenTicketRef,
      mpesaStatus: entry.mpesaStatus,
      mpesaPaidAt: entry.mpesaPaidAt,
      canUpgradeToGolden: entry.canUpgradeToGolden,
      goldenTicketEligible: entry.canUpgradeToGolden && !entry.isGolden,
      claimedAt: entry.claimedAt,
      staffConfirmedAt: entry.staffConfirmedAt,
      // Debt information
      pendingDebts: debts,
      canBeServed: debts.length === 0,
    })
  } catch (error) {
    console.error('Queue GET/:id error:', error)
    return json({ error: 'Failed to fetch queue entry' }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = parseInt(params.id)
    const body = await request.json()
    const { action } = body

    if (isNaN(id)) {
      return json({ error: 'Invalid queue entry ID' }, { status: 400 })
    }

    const entry = await db.query.queueEntries.findFirst({
      where: eq(queueEntries.id, id),
    })

    if (!entry) {
      return json({ error: 'Queue entry not found' }, { status: 404 })
    }

    switch (action) {
      case 'claim': {
        if (!entry.isGolden || entry.mpesaStatus !== 'success') {
          return json({ error: 'Cannot claim non-golden ticket or payment not successful' }, { status: 400 })
        }

        if (entry.status !== 'waiting') {
          return json({ error: 'Ticket must be in waiting status to claim' }, { status: 400 })
        }

        // Count current waiting tickets
        const waitingCount = await db.query.queueEntries.findMany({
          where: and(
            eq(queueEntries.officeId, entry.officeId),
            eq(queueEntries.status, 'waiting'),
            lt(queueEntries.createdAt, new Date())
          ),
        })

        // Claim the ticket
        await db.update(queueEntries)
          .set({ claimedAt: new Date() })
          .where(eq(queueEntries.id, id))

        // Calculate position: should be around 6 (5 people ahead)
        const position = Math.max(6, waitingCount.length + 1)

        return json({
          success: true,
          action: 'claim',
          message: 'Golden ticket claimed successfully',
          position: position,
          estimatedPosition: 6,
          status: 'claimed',
          claimedAt: new Date(),
        })
      }

      default:
        return json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Queue POST/:id error:', error)
    return json({ error: 'Failed to claim ticket' }, { status: 500 })
  }
}
