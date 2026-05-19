// src/routes/api/queue.$id.ts
import { createFileRoute } from '@tanstack/react-router'
import { db } from '../../../db/index.js'
import { queueEntries } from '../../../db/schema.js'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/queue/$id')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const ticket = await db.select().from(queueEntries).where(eq(queueEntries.id, Number(params.id)))
        return Response.json(ticket[0] || null)
      },
    },
  },
})