# AGENTS.md

## Project Overview

JKUAT Digital Queue Management System — a full-stack web application for managing student service queues at university offices. Students join queues via the web, receive queue numbers, and get notified when called. Admin staff manage queues and view reports.

## Directory Structure

```
db/
  index.ts          # Drizzle ORM client (netlify-db adapter)
  schema.ts         # Database schema: queue_entries table with status/service enums

netlify/
  database/
    migrations/     # Auto-generated Drizzle SQL migrations (applied by Netlify at deploy time)

public/
  queue-bg.jpeg     # JKUAT logo — background image for all pages
  favicon.jpeg      # JKUAT logo used as browser tab icon

src/
  styles.css        # Tailwind + CSS vars (--green-dark, --navy, --gold) + glass/animation utilities
  routes/
    __root.tsx       # Root layout: background image, favicon
    index.tsx        # Home: service selector, join-queue form, live queue summary
    admin.tsx        # Admin portal: login, queue management per service, service report
    track.$id.tsx    # Queue tracker: polls every 5s, browser notification + sound on calling
    api/
      queue.ts       # GET (queue by service) / POST (join queue)
      queue/$id.ts   # GET individual entry with position/ahead count
      admin/
        serve.ts     # POST: serve_next / complete / cancel (Basic Auth)
        report.ts    # GET: all served entries (Basic Auth)
```

## Key Conventions

### Colors (CSS custom properties)
- `--green-dark: #1a5c2a` — primary (JKUAT logo gear ring)
- `--navy: #1a3060` — secondary (logo mountains/text)
- `--gold: #c8a000` — accent (queue numbers, call alerts)
- `glass`, `glass-dark`, `glass-green` classes layer content over the background image

### Database
- Schema defined in `db/schema.ts`; client in `db/index.ts`
- Migrations in `netlify/database/migrations/` via `npx drizzle-kit generate`
- Never run `drizzle-kit migrate` or apply SQL manually — Netlify applies migrations at deploy time

### Admin Authentication
- Basic Auth checked inline in each admin API handler
- Credentials: `Admin0375` / `group2sysdev`

### Real-time Polling
- Queue tracker page polls `/api/queue/:id` every 5 seconds
- Home dashboard polls each service every 8 seconds
- Browser Notification API requested on queue tracker page for native alerts

### Services
Three supported service types (as DB enum): `registrar`, `finance`, `ict_helpdesk`
