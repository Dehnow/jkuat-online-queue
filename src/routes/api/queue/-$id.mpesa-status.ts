import { json } from '@tanstack/start'
import { db } from '../../../db/index'
import { queueEntries } from '../../../db/schema'
import { eq } from 'drizzle-orm'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const id = Number(params.id)
    
    if (isNaN(id)) {
      return json({ error: 'Invalid queue entry ID' }, { status: 400 })
    }

    const entry = await db.query.queueEntries.findFirst({
      where: eq(queueEntries.id, id),
      columns: {
        id: true,
        isGolden: true,
        mpesaStatus: true,
        mpesaTransactionId: true,
        mpesaPaidAt: true,
        goldenTicketRef: true,
        status: true,
      },
    })

    if (!entry) {
      return json({ error: 'Queue entry not found' }, { status: 404 })
    }

    return json(entry)
  } catch (error) {
    console.error('Error checking M-Pesa status:', error)
    return json({ error: 'Internal server error' }, { status: 500 })
  }
}
