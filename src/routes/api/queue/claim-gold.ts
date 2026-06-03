import { json } from '@tanstack/start'
import { db } from '../../../db/index'
import { queueEntries } from '../../../db/schema'
import { eq, and, not, sql } from 'drizzle-orm'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { queueId, serviceType } = body

    if (!queueId || !serviceType) {
      return json({ error: 'Missing queueId or serviceType' }, { status: 400 })
    }

    const goldenTicket = await db.query.queueEntries.findFirst({
      where: eq(queueEntries.id, queueId),
    })

    if (!goldenTicket) {
      return json({ error: 'Ticket not found' }, { status: 404 })
    }

    if (!goldenTicket.isGolden || goldenTicket.mpesaStatus !== 'success') {
      return json({ error: 'This is not a valid golden ticket' }, { status: 400 })
    }

    if (goldenTicket.status !== 'waiting') {
      return json({
        error: 'Golden claim is only available while your ticket is still waiting in the queue',
        message: 'Your ticket is already being served or has left the waiting line',
      }, { status: 400 })
    }

    const waitingTickets = await db.query.queueEntries.findMany({
      where: and(
        eq(queueEntries.serviceType, serviceType),
        eq(queueEntries.status, 'waiting'),
      ),
      orderBy: (table, { asc }) => [asc(table.queueNumber)],
    })

    const currentIndex = waitingTickets.findIndex((ticket) => ticket.id === queueId)
    if (currentIndex === -1) {
      return json({ error: 'Ticket not found in active waiting queue' }, { status: 404 })
    }

    const waitingWithoutGolden = waitingTickets.filter((ticket) => ticket.id !== queueId)
    const successfulGoldWaiting = waitingWithoutGolden.filter(
      (ticket) => ticket.isGolden && ticket.mpesaStatus === 'success'
    )

    let targetPosition = 0
    if (successfulGoldWaiting.length === 0) {
      targetPosition = 0
    } else if (successfulGoldWaiting.length <= 3) {
      const lastGold = successfulGoldWaiting[successfulGoldWaiting.length - 1]
      targetPosition = waitingWithoutGolden.findIndex((ticket) => ticket.queueNumber > lastGold.queueNumber)
      if (targetPosition === -1) targetPosition = waitingWithoutGolden.length
    } else {
      const thirdGold = successfulGoldWaiting[2]
      targetPosition = waitingWithoutGolden.findIndex((ticket) => ticket.queueNumber > thirdGold.queueNumber)
      if (targetPosition === -1) targetPosition = waitingWithoutGolden.length
    }

    if (currentIndex <= targetPosition) {
      return json({
        success: true,
        message: 'Your golden ticket is already in the correct waiting position.',
        currentQueueNumber: goldenTicket.queueNumber,
        currentPosition: currentIndex + 1,
      })
    }

    let insertionQueueNumber = goldenTicket.queueNumber
    if (targetPosition === 0) {
      insertionQueueNumber = waitingWithoutGolden[0]?.queueNumber ?? goldenTicket.queueNumber
    } else if (targetPosition >= waitingWithoutGolden.length) {
      insertionQueueNumber = (waitingWithoutGolden[waitingWithoutGolden.length - 1]?.queueNumber ?? goldenTicket.queueNumber) + 1
    } else {
      insertionQueueNumber = waitingWithoutGolden[targetPosition - 1].queueNumber + 1
    }

    await db.update(queueEntries)
      .set({ queueNumber: sql`${queueEntries.queueNumber} + 1` })
      .where(and(
        eq(queueEntries.serviceType, serviceType),
        eq(queueEntries.status, 'waiting'),
        not(eq(queueEntries.id, queueId)),
        sql`${queueEntries.queueNumber} >= ${insertionQueueNumber}`
      ))

    await db.update(queueEntries)
      .set({ queueNumber: insertionQueueNumber })
      .where(eq(queueEntries.id, queueId))

    return json({
      success: true,
      message: '✅ Golden ticket claimed and moved into the priority line.',
      oldQueueNumber: goldenTicket.queueNumber,
      newQueueNumber: insertionQueueNumber,
      newPosition: targetPosition + 1,
      totalWaiting: waitingTickets.length,
    })
  } catch (error) {
    console.error('Error claiming golden ticket:', error)
    return json({ error: 'Failed to claim golden ticket' }, { status: 500 })
  }
}
