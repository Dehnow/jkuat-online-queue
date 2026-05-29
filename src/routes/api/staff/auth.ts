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

    // If officeId is provided, validate staff account
    if (officeId) {
      const staff = await db.query.staffAccounts.findFirst({
        where: eq(staffAccounts.username, username),
      })

      if (!staff || staff.password !== password || staff.officeId !== officeId) {
        return json({ error: 'Invalid credentials' }, { status: 401 })
      }

      const office = await db.query.offices.findFirst({
        where: eq(offices.id, officeId),
      })

      if (!office) {
        return json({ error: 'Office not found' }, { status: 404 })
      }

      return json({
        success: true,
        staff: {
          id: staff.id,
          username: staff.username,
          officeId: staff.officeId,
          hasAdminPrivilege: staff.hasAdminPrivilege,
        },
        office: {
          id: office.id,
          name: office.name,
          serviceType: office.serviceType,
          status: office.status,
        },
      })
    }

    // Fallback: try office login
    const office = await db.query.offices.findFirst({
      where: eq(offices.username, username),
    })

    if (!office || office.password !== password) {
      return json({ error: 'Invalid office credentials' }, { status: 401 })
    }

    return json({
      success: true,
      office: {
        id: office.id,
        name: office.name,
        serviceType: office.serviceType,
        status: office.status,
        username: office.username,
      },
    })
  } catch (err) {
    console.error('[Staff Auth] Error:', err)
    return json({ error: 'Authentication failed' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    // Get all operational offices
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
