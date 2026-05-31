import { json } from '@tanstack/start'
import { db } from '../../../db/index'
import { queueEntries } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

// Generate unique golden ticket reference
function generateGoldenTicketRef(queueId: number, serviceType: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  const serviceCode = getServiceCode(serviceType)
  return `GT-${serviceCode}-${timestamp}-${random}`
}

function getServiceCode(service: string): string {
  switch (service) {
    case 'registrar': return 'REG'
    case 'finance': return 'FIN'
    case 'ict_helpdesk': return 'ICT'
    default: return 'JKU'
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { queueId, action } = body

    if (!queueId) {
      return json({ error: 'Missing queue ID' }, { status: 400 })
    }

    // Get the queue entry
    const entry = await db.query.queueEntries.findFirst({
      where: eq(queueEntries.id, queueId),
    })

    if (!entry) {
      return json({ error: 'Queue entry not found' }, { status: 404 })
    }

    // Check if already golden
    if (entry.isGolden) {
      return json({ 
        error: 'This ticket is already marked as golden. Awaiting payment confirmation.' 
      }, { status: 400 })
    }

    if (action === 'mark-golden') {
      // Generate golden ticket reference
      const goldenRef = generateGoldenTicketRef(entry.id, entry.serviceType)

      // Update entry to mark as golden (not yet paid)
      await db.update(queueEntries)
        .set({
          isGolden: true,
          goldenTicketRef: goldenRef,
          mpesaStatus: 'pending',
        })
        .where(eq(queueEntries.id, queueId))

      return json({
        success: true,
        message: 'Golden ticket activated. Proceed to payment.',
        goldenTicketData: {
          id: entry.id,
          goldenTicketRef: goldenRef,
          queueNumber: entry.queueNumber,
          originalTicket: `${getServiceCode(entry.serviceType)}${entry.id}`,
          amount: 50, // KES 50 golden ticket fee
          description: `Golden Ticket Premium - Queue #${entry.queueNumber}`,
        },
      })
    }

    return json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Golden ticket error:', error)
    return json({ error: 'Failed to process golden ticket request' }, { status: 500 })
  }
}
