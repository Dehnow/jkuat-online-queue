import { createFileRoute } from '@tanstack/react-router';
import { db } from '../../../db/index.js';
import { queueEntries } from '../../../db/schema.js';
import { eq, and, max, count } from 'drizzle-orm';

export const Route = createFileRoute('/api/queue')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const serviceType = url.searchParams.get('service') as 'registrar' | 'finance' | 'ict_helpdesk' | null;

        if (serviceType) {
          const serving = await db.select().from(queueEntries)
            .where(and(eq(queueEntries.serviceType, serviceType), eq(queueEntries.status, 'serving')));
          const waiting = await db.select().from(queueEntries)
            .where(and(eq(queueEntries.serviceType, serviceType), eq(queueEntries.status, 'waiting')));
          return Response.json({ serving: serving[0] || null, waitingCount: waiting.length, waiting });
        }

        const all = await db.select().from(queueEntries);
        return Response.json(all);
      },

      POST: async ({ request }) => {
        const body = await request.json() as { name: string; studentId: string; serviceType: 'registrar' | 'finance' | 'ict_helpdesk' };
        const { name, studentId, serviceType } = body;

        if (!name || !studentId || !serviceType) {
          return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const [maxResult] = await db.select({ max: max(queueEntries.queueNumber) })
          .from(queueEntries)
          .where(eq(queueEntries.serviceType, serviceType));

        const nextNumber = (maxResult?.max ?? 0) + 1;

        const [entry] = await db.insert(queueEntries).values({
          name,
          studentId,
          serviceType,
          queueNumber: nextNumber,
          status: 'waiting',
        }).returning();

        return Response.json(entry, { status: 201 });
      },
    },
  },
});
