import { createFileRoute } from '@tanstack/react-router'
import { db } from '../../../db/index.js'
import { queueEntries } from '../../../db/schema.js'
import { count, eq, inArray } from 'drizzle-orm'

export const Route = createFileRoute('/api/queue/pending')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const phone = url.searchParams.get('phone')
        if (!phone) {
          return Response.json({ error: 'Missing phone parameter' }, { status: 400 })
        }

        const result = await db
          .select({ count: count() })
          .from(queueEntries)
          .where(eq(queueEntries.name, phone))
          .where(inArray(queueEntries.status, ['waiting', 'serving']))

        const pendingCount = result[0]?.count || 0
        return Response.json({ pendingCount })
      },
    },
  },
})