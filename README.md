# JKUAT Digital Queue Management System

A web-based digital queue management system for Jomo Kenyatta University of Agriculture and Technology (JKUAT) offices. Students can join queues remotely, receive real-time status updates, and get notified when their turn arrives. Admin staff can manage queues and view service reports.

## Key Technologies

| Layer | Technology |
|-------|------------|
| Framework | TanStack Start (React 19, TanStack Router v1) |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 |
| Database | Netlify Database (Postgres) via Drizzle ORM |
| Language | TypeScript 5 (strict mode) |
| Deployment | Netlify |

## Features

- **Student Portal** — Select a service, enter name/ID, join the queue, and receive a queue number
- **Queue Tracker** — Real-time queue status with browser push notification when called to be served
- **Admin Portal** — Manage queues per service, call next in line, cancel entries, view service reports
- **Live Dashboard** — Homepage shows live queue status for all three offices

## Running Locally

```bash
npm install
netlify dev
```

Requires the Netlify CLI and a Netlify project linked (`netlify link`) for the database to work.

## Admin Access

- **Username:** Admin0375
- **Password:** group2sysdev
