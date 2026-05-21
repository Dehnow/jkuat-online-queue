import { json } from '@tanstack/start'
import { db } from '../../../db/index'
import { queueEntries } from '../../../db/schema'
import { eq, and } from 'drizzle-orm'

// Basic Auth helper
function getBasicAuth(request: Request) {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Basic ')) {
    return null
  }

  const credentials = Buffer.from(authHeader.slice(6), 'base64').toString()
  const [username, password] = credentials.split(':')
  return { username, password }
}

function verifyAuth(request: Request): boolean {
  const auth = getBasicAuth(request)
  if (!auth) return false

  const validUsername = 'Admin0375'
  const validPassword = 'group2sysdev'

  return auth.username === validUsername && auth.password === validPassword
}

export async function POST(request: Request) {
  try {
    if (!verifyAuth(request)) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, serviceType, entryId } = body

    if (!action || !serviceType) {
      return json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Stop serving current entry for this service
    if (action === 'serve_next') {
      // Get the next waiting entry
      const nextEntry = await db.query.queueEntries.findFirst({
        where: and(
          eq(queueEntries.serviceType, serviceType as 'registrar' | 'finance' | 'ict_helpdesk'),
          eq(queueEntries.status, 'waiting')
        ),
        orderBy: (entries) => entries.createdAt,
      })

      if (!nextEntry) {
        return json({ error: 'No waiting entries' }, { status: 404 })
      }

      // First, mark current serving as served
      await db
        .update(queueEntries)
        .set({ status: 'served', servedAt: new Date() })
        .where(
          and(
            eq(queueEntries.serviceType, serviceType),
            eq(queueEntries.status, 'serving')
          )
        )

      // Then mark next as serving
      await db
        .update(queueEntries)
        .set({ status: 'serving' })
        .where(eq(queueEntries.id, nextEntry.id))

      return json({
        success: true,
        nowServing: nextEntry.queueNumber,
        entryId: nextEntry.id,
      })
    }

    if (action === 'complete' && entryId) {
      await db
        .update(queueEntries)
        .set({ status: 'served', servedAt: new Date() })
        .where(eq(queueEntries.id, entryId))

      return json({ success: true })
    }

    if (action === 'cancel' && entryId) {
      await db
        .update(queueEntries)
        .set({ status: 'cancelled' })
        .where(eq(queueEntries.id, entryId))

      return json({ success: true })
    }

    return json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Admin serve error:', error)
    return json({ error: 'Failed to process action' }, { status: 500 })
  }
}
