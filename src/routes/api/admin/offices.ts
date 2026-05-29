import { json } from '@tanstack/start'
import { db } from '../../../db/index'
import { offices } from '../../../db/schema'
import { eq } from 'drizzle-orm'

const ADMIN_USERNAME = 'Admin0375'
const ADMIN_PASSWORD = 'group2sysdev'

function checkAdminAuth(auth: string | null): boolean {
  if (!auth) return false
  const decoded = Buffer.from(auth.replace('Basic ', ''), 'base64').toString('utf-8')
  const [username, password] = decoded.split(':')
  return username === ADMIN_USERNAME && password === ADMIN_PASSWORD
}

// Get all offices
export async function GET(request: Request) {
  try {
    const allOffices = await db.query.offices.findMany()
    return json({
      offices: allOffices.map(office => ({
        id: office.id,
        name: office.name,
        serviceType: office.serviceType,
        status: office.status,
        username: office.username,
      })),
    })
  } catch (err) {
    console.error('[Get Offices] Error:', err)
    return json({ error: 'Failed to fetch offices' }, { status: 500 })
  }
}

// Create or update office
export async function POST(request: Request) {
  try {
    const auth = request.headers.get('Authorization')

    if (!checkAdminAuth(auth)) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, serviceType, username, password } = body

    if (!name || !serviceType || !username || !password) {
      return json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if office already exists
    const existing = await db.query.offices.findFirst({
      where: eq(offices.username, username),
    })

    if (existing) {
      return json({ error: 'Office with this username already exists' }, { status: 409 })
    }

    const newOffice = await db.insert(offices)
      .values({
        name,
        serviceType: serviceType as any,
        username,
        password,
        status: 'open',
        createdBy: ADMIN_USERNAME,
      })
      .returning()

    return json({
      success: true,
      office: newOffice[0],
    })
  } catch (err) {
    console.error('[Create Office] Error:', err)
    return json({ error: 'Failed to create office' }, { status: 500 })
  }
}

// Delete office
export async function DELETE(request: Request) {
  try {
    const auth = request.headers.get('Authorization')

    if (!checkAdminAuth(auth)) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { officeId } = await request.json()

    if (!officeId) {
      return json({ error: 'Missing officeId' }, { status: 400 })
    }

    await db.delete(offices).where(eq(offices.id, officeId))

    return json({ success: true, message: 'Office deleted' })
  } catch (err) {
    console.error('[Delete Office] Error:', err)
    return json({ error: 'Failed to delete office' }, { status: 500 })
  }
}

// Update office status
export async function PATCH(request: Request) {
  try {
    const auth = request.headers.get('Authorization')

    if (!checkAdminAuth(auth)) {
      return json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { officeId, status } = body

    if (!officeId || !status) {
      return json({ error: 'Missing required fields' }, { status: 400 })
    }

    await db.update(offices)
      .set({ status: status as any })
      .where(eq(offices.id, officeId))

    return json({ success: true, message: 'Office updated' })
  } catch (err) {
    console.error('[Update Office] Error:', err)
    return json({ error: 'Failed to update office' }, { status: 500 })
  }
}
