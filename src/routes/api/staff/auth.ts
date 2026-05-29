import { json } from '@tanstack/start'
import { db } from '../../../db/index'
import { offices, staffAccounts } from '../../../db/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: Request) {
  try {
    const { username, password, officeId } = await request.json()

    if (!username || !password) {
      return json({ error: 'Username and password are required' }, { status: 400 })
    }

    if (!officeId) {
      return json({ error: 'officeId is required' }, { status: 400 })
    }

    const office = await db.query.offices.findFirst({
      where: eq(offices.id, officeId),
    })

    if (!office) {
      return json({ error: 'Office not found' }, { status: 404 })
    }

    const defaultCredentialsMatch = username === 'office_staff' && password === '123'
    const officeCredentialMatch = office.username === username && office.password === password
    const staff = await db.query.staffAccounts.findFirst({
      where: eq(staffAccounts.username, username),
    })

    const staffValid = staff && staff.password === password && staff.officeId === officeId

    if (!defaultCredentialsMatch && !officeCredentialMatch && !staffValid) {
      return json({ error: 'Invalid credentials' }, { status: 401 })
    }

    return json({
      success: true,
      staff: {
        id: staff?.id ?? 0,
        username,
        officeId,
        hasAdminPrivilege: staff?.hasAdminPrivilege ?? false,
        isDefaultLogin: defaultCredentialsMatch,
      },
      office: {
        id: office.id,
        name: office.name,
        serviceType: office.serviceType,
        status: office.status,
      },
    })
  } catch (err) {
    console.error('[Staff Auth] Error:', err)
    return json({ error: 'Authentication failed' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const allOffices = await db.query.offices.findMany()

    return json({
      offices: allOffices.map(office => ({
        id: office.id,
        name: office.name,
        serviceType: office.serviceType,
        status: office.status,
      })),
    })
  } catch (err) {
    console.error('[Get Offices] Error:', err)
    return json({ error: 'Failed to fetch offices' }, { status: 500 })
  }
}
