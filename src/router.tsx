import { createRouter, RootRoute, Route } from '@tanstack/react-router'
import RootLayout from './routes/__root'
import StudentDashboard from './routes/index'
import AdminPage from './routes/admin'
import StaffDashboard from './routes/staff-dashboard'
import LoginPage from './routes/login'
import TrackPage from './routes/track.$id'

const rootRoute = new RootRoute({
  component: RootLayout,
})

// Student dashboard (home page)
const indexRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/',
  component: StudentDashboard,
})

const adminRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/admin',
  component: AdminPage,
})

const staffRoute = new Route({
  getParentRoute: () => rootRoute,
  path: '/staff-dashboard',
  component: StaffDashboard,
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

const routeTree = rootRoute.addChildren([
  indexRoute,
  staffRoute,
  adminRoute,
  loginRoute,
  trackRoute,
])

export const router = createRouter({ routeTree })