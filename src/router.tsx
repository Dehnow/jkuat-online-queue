import { createRouter, RootRoute, Route, Navigate } from '@tanstack/react-router'
import RootLayout from './routes/__root'
import StudentDashboard from './routes/index'
import AdminPage from './routes/admin'
import LoginPage from './routes/login'
import TrackPage from './routes/track.$id'
import AdminServiceReportPage from './routes/admin-report.$service'

const rootRoute = new RootRoute({
  component: RootLayout,
})

// Login page (landing page)
const indexRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LoginPage,
})

const dashboardRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/dashboard',
  component: StudentDashboard,
})

const adminRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: AdminPage,
})

const loginRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

const trackRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/track/$id',
  component: TrackPage,
})

const adminServiceReportRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/admin-report/$service',
  component: AdminServiceReportPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  dashboardRoute,
  adminRoute,
  loginRoute,
  trackRoute,
  adminServiceReportRoute,
])

export const router = createRouter({ routeTree })