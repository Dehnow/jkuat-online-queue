import { json } from '@tanstack/start'
import { db } from '../../../db/index'
import { feedbackMessages } from '../../../db/schema'
import { eq } from 'drizzle-orm'

const ADMIN_USERNAME = 'Admin0375'
const ADMIN_PASSWORD = 'group2sysdev'

function checkAdminAuth(auth: string | null): boolean {
  if (!auth) return false
  const decoded = Buffer.from(auth.replace('Basic ', ''), 'base64').toString('utf-8')
  const [username, password] = decoded.split(':')
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD
}

// Send feedback message
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { officeId, staffUsername, messageType, message } = body

    if (!officeId || !staffUsername || !messageType || !message) {
      return json({ error: 'Missing required fields' }, { status: 400 })
    }

    const newMessage = await db.insert(feedbackMessages)
      .values({
        officeId,
        staffUsername,
        messageType: messageType as any,
        message,
        status: 'pending',
      })
      .returning()

    return json({
      success: true,
      message: newMessage[0],
    })
  } catch (err) {
    console.error('[Send Message] Error:', err)
    return json({ error: 'Failed to send message' }, { status: 500 })
  }
}

// Get all feedback messages (admin only)
export async function GET(request: Request) {
  try {
    const auth = request.headers.get('Authorization')

    if (!checkAdminAuth(auth)) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    const allMessages = await db.query.feedbackMessages.findMany()

    return json({
      messages: allMessages,
    })
  } catch (err) {
    console.error('[Get Messages] Error:', err)
    return json({ error: 'Failed to fetch messages' }, { status: 500 })
  }
}

// Respond to feedback message (admin only)
export async function PATCH(request: Request) {
  try {
    const auth = request.headers.get('Authorization')

    if (!checkAdminAuth(auth)) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { messageId, response, status } = body

    if (!messageId) {
      return json({ error: 'Missing messageId' }, { status: 400 })
    }

    const updateData: any = {
      respondedAt: new Date(),
      respondedBy: ADMIN_USERNAME,
    }

    if (response) updateData.response = response
    if (status) updateData.status = status

    await db.update(feedbackMessages)
      .set(updateData)
      .where(eq(feedbackMessages.id, messageId))

    return json({ success: true, message: 'Response sent' })
  } catch (err) {
    console.error('[Respond Message] Error:', err)
    return json({ error: 'Failed to send response' }, { status: 500 })
  }
}
