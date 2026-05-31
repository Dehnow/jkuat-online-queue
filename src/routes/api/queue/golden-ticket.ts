import { json } from '@tanstack/start'
import { db } from '../../../db/index'
import { queueEntries } from '../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { v4 as uuidv4 } from 'uuid'

// Generate enhanced golden ticket reference with more details
function generateGoldenTicketRef(queueId: number, studentId: string, serviceType: string): string {
  const date = new Date()
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD
  const timeStr = date.toISOString().slice(11, 16).replace(/:/g, '') // HHMM
  const serviceCode = getServiceCode(serviceType)
  const shortStudentId = studentId.slice(-4).toUpperCase() // Last 4 chars of student ID
  const random = Math.random().toString(36).substring(2, 5).toUpperCase() // 3 random chars
  
  // Format: GT-REG-20260531-1530-1234-GT01-ABC
  // Breakdown: GT-SERVICE-DATE-TIME-QUEUEID-STUDENTIDLAST4-RANDOM
  return `GT-${serviceCode}-${dateStr}-${timeStr}-${String(queueId).padStart(4, '0')}-${shortStudentId}-${random}`
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

    // Check if this ticket is eligible for golden upgrade
    if (!entry.canUpgradeToGolden) {
      return json({ 
        error: 'This ticket cannot be upgraded to golden', 
        message: 'Golden ticket opportunity is only available for your most recent ticket. Create a new ticket to get another golden ticket opportunity.',
        details: {
          currentStatus: entry.status,
          isAlreadyGolden: entry.isGolden,
          eligibleForUpgrade: false
        }
      }, { status: 403 })
    }

    // Check if already golden
    if (entry.isGolden) {
      return json({ 
        error: 'This ticket is already marked as golden. Awaiting payment confirmation.' 
      }, { status: 400 })
    }

    if (action === 'mark-golden') {
      // Generate enhanced golden ticket reference
      const goldenRef = generateGoldenTicketRef(entry.id, entry.studentId, entry.serviceType)

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
          studentId: entry.studentId,
          serviceType: entry.serviceType,
          originalTicket: `${getServiceCode(entry.serviceType)}${entry.id}`,
          amount: 50, // KES 50 golden ticket fee
          description: `Golden Ticket Premium - Queue #${entry.queueNumber}`,
          expiresAt: new Date(Date.now() + 10 * 60000), // 10 minutes to complete payment
        },
      })
    }

    return json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Golden ticket error:', error)
    return json({ error: 'Failed to process golden ticket request' }, { status: 500 })
  }
}
