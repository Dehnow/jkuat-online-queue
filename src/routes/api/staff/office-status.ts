import { json } from '@tanstack/start'
import { db } from '../../../db/index'
import { offices } from '../../../db/schema'
import { eq } from 'drizzle-orm'

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { officeId, status } = body

    if (!officeId || !status) {
      return json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['open', 'closed'].includes(status)) {
      return json({ error: 'Invalid status' }, { status: 400 })
    }

    await db.update(offices)
      .set({ status: status as any })
      .where(eq(offices.id, officeId))

    return json({
      success: true,
      message: `Office status changed to ${status}`,
    })
  } catch (err) {
    console.error('[Toggle Office Status] Error:', err)
    return json({ error: 'Failed to update office status' }, { status: 500 })
  }
}
