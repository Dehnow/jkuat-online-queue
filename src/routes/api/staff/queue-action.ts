import { json } from '@tanstack/start'
import { db } from '../../../db/index'
import { queueEntries, studentDebts, serviceLog } from '../../../db/schema'
import { eq, and, desc, asc, lt } from 'drizzle-orm'

async function getPatternSequence(officeId: number) {
  const recentServed = await db.query.queueEntries.findMany({
    where: and(
      eq(queueEntries.officeId, officeId),
      eq(queueEntries.status, 'served'),
      lt(queueEntries.servedAt, new Date(Date.now() - 3600000)) // Last hour
    ),
    orderBy: desc(queueEntries.servedAt),
    limit: 3,
  })

  const goldenCount = recentServed.filter(e => e.isGolden).length
  return goldenCount < 2 ? 'golden' : 'normal'
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, queueId, officeId, staffId } = body

    if (!action || !officeId) {
      return json({ error: 'Missing required fields' }, { status: 400 })
    }

    // For actions that need queueId, validate it
    if (['start_service', 'end_service', 'cancel', 'confirm_gold'].includes(action) && !queueId) {
      return json({ error: 'Missing queueId' }, { status: 400 })
    }

    const entry = queueId ? await db.query.queueEntries.findFirst({
      where: eq(queueEntries.id, queueId),
    }) : null

    if (queueId && !entry) {
      return json({ error: 'Queue entry not found' }, { status: 404 })
    }

    switch (action) {
      case 'call_next': {
        const requiredType = await getPatternSequence(officeId)

        let nextEntry
        if (requiredType === 'golden') {
          nextEntry = await db.query.queueEntries.findFirst({
            where: and(
              eq(queueEntries.officeId, officeId),
              eq(queueEntries.status, 'waiting'),
              eq(queueEntries.isGolden, true),
              eq(queueEntries.mpesaStatus, 'success')
            ),
            orderBy: asc(queueEntries.createdAt),
          })
        }

        // Fallback: if required type not available or not found, serve next available
        if (!nextEntry) {
          nextEntry = await db.query.queueEntries.findFirst({
            where: and(
              eq(queueEntries.officeId, officeId),
              eq(queueEntries.status, 'waiting'),
              eq(queueEntries.isGolden, requiredType === 'normal')
            ),
            orderBy: asc(queueEntries.createdAt),
          })
        }

        if (nextEntry) {
          await db.update(queueEntries)
            .set({ status: 'serving' })
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
              studentId: nextEntry.studentId,
            },
            message: nextEntry.isGolden ? 'Calling golden ticket holder 🎫' : 'Calling next customer',
            ticketLabel,
          })
        }
        return json({ error: 'No waiting customers' }, { status: 404 })
      }

      case 'start_service': {
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
        await db.update(queueEntries)
          .set({ status: 'served', servedAt: new Date() })
          .where(eq(queueEntries.id, queueId))

        // Log service
        if (entry) {
          await db.insert(serviceLog).values({
            officeId: officeId,
            queueEntryId: queueId,
            studentId: entry.studentId,
            queueNumber: entry.queueNumber,
            serviceType: entry.serviceType,
            isGolden: entry.isGolden,
            goldenTicketRef: entry.goldenTicketRef || undefined,
            status: 'served',
            servedAt: new Date(),
            staffId: staffId || null,
          })
        }

        return json({
          success: true,
          action: 'end_service',
          message: 'Service ended',
        })
      }

      case 'confirm_gold': {
        if (!entry?.isGolden) {
          return json({ error: 'Not a golden ticket' }, { status: 400 })
        }

        await db.update(queueEntries)
          .set({
            status: 'served',
            servedAt: new Date(),
            staffConfirmedAt: new Date(),
          })
          .where(eq(queueEntries.id, queueId))

        // Log service
        await db.insert(serviceLog).values({
          officeId: officeId,
          queueEntryId: queueId,
          studentId: entry.studentId,
          queueNumber: entry.queueNumber,
          serviceType: entry.serviceType,
          isGolden: true,
          goldenTicketRef: entry.goldenTicketRef || undefined,
          status: 'served',
          servedAt: new Date(),
          staffId: staffId || null,
        })

        return json({
          success: true,
          action: 'confirm_gold',
          message: 'Golden ticket confirmed and serviced',
        })
      }

      case 'cancel': {
        const willCancel = await db.query.queueEntries.findFirst({
          where: eq(queueEntries.id, queueId),
        })

        await db.update(queueEntries)
          .set({
            status: 'cancelled',
            cancelledByStaff: true,
            goldenPenaltyApplied: willCancel?.isGolden ? true : false,
          })
          .where(eq(queueEntries.id, queueId))

        // If golden ticket, create debt entry
        if (willCancel?.isGolden && !willCancel.goldenPenaltyApplied) {
          await db.insert(studentDebts).values({
            studentId: willCancel.studentId,
            amount: 2000,
            reason: 'Golden ticket cancellation',
            goldenTicketRef: willCancel.goldenTicketRef || undefined,
            status: 'pending',
          })
        }

        // Log cancellation
        await db.insert(serviceLog).values({
          officeId: officeId,
          queueEntryId: queueId,
          studentId: willCancel?.studentId || '',
          queueNumber: willCancel?.queueNumber || 0,
          serviceType: willCancel?.serviceType || 'registrar',
          isGolden: willCancel?.isGolden || false,
          goldenTicketRef: willCancel?.goldenTicketRef || undefined,
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelledByStaff: true,
          staffId: staffId || null,
        })

        return json({
          success: true,
          action: 'cancel',
          message: willCancel?.isGolden
            ? 'Golden ticket cancelled. Penalty of KES 2000 has been applied to student account'
            : 'Ticket cancelled',
          penaltyApplied: willCancel?.isGolden,
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
