import { json } from '@tanstack/start'
import { db } from '../../db/index'
import { queueEntries } from '../../db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * Staff Dashboard Call Next Endpoint
 * 
 * Retrieves the next customer in line (golden tickets prioritized):
 * - Priority: Golden tickets with successful M-Pesa payment
 * - Fallback: Regular waiting customers
 * 
 * Updates customer status to 'serving' and returns details for real-time notification
 * (Socket.IO broadcast or polling-based update)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { officeId, counter = 'Counter 1' } = body

    if (!officeId) {
      return json({ error: 'Missing officeId' }, { status: 400 })
    }

    // Check if any customers are waiting
    const waitingCount = await db.query.queueEntries.findFirst({
      where: and(
        eq(queueEntries.officeId, officeId),
        eq(queueEntries.status, 'waiting')
      ),
    })

    if (!waitingCount) {
      return json({ message: 'No customers in line.' }, { status: 400 })
    }

    // Priority: Golden tickets with successful M-Pesa payment first
    let nextCustomer = await db.query.queueEntries.findFirst({
      where: and(
        eq(queueEntries.officeId, officeId),
        eq(queueEntries.status, 'waiting'),
        eq(queueEntries.isGolden, true),
        eq(queueEntries.mpesaStatus, 'success')
      ),
      orderBy: (table, { asc }) => [asc(table.queueNumber)],
    })

    // Fallback: Regular waiting customer
    if (!nextCustomer) {
      nextCustomer = await db.query.queueEntries.findFirst({
        where: and(
          eq(queueEntries.officeId, officeId),
          eq(queueEntries.status, 'waiting'),
          eq(queueEntries.isGolden, false)
        ),
        orderBy: (table, { asc }) => [asc(table.queueNumber)],
      })
    }

    if (!nextCustomer) {
      return json({ error: 'No waiting customers found' }, { status: 404 })
    }

    // Update customer status to serving
    await db.update(queueEntries)
      .set({ status: 'serving' })
      .where(eq(queueEntries.id, nextCustomer.id))

    // Format ticket label
    const ticketLabel = nextCustomer.isGolden && nextCustomer.mpesaStatus === 'success'
      ? `${nextCustomer.queueNumber} ✨ (GOLDEN TICKET)`
      : nextCustomer.queueNumber.toString()

    const responseData = {
      success: true,
      calledUser: {
        ticketId: nextCustomer.id,
        queueNumber: nextCustomer.queueNumber,
        name: nextCustomer.name,
        studentId: nextCustomer.studentId,
        phone: nextCustomer.phone,
        isGolden: nextCustomer.isGolden,
      },
      counter,
      message: `Proceed to ${counter}`,
      ticketLabel,
      isGoldenTicket: nextCustomer.isGolden && nextCustomer.mpesaStatus === 'success',
    }

    console.log(`[Call Next] Ticket ${nextCustomer.queueNumber} called to ${counter}`)

    return json(responseData)
  } catch (err) {
    console.error('[Call Next] Error:', err)
    return json({ error: 'Failed to call next customer' }, { status: 500 })
  }
}
