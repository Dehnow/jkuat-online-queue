import { Outlet } from '@tanstack/react-router'
import '../styles.css'

export default function RootLayout() {
  return (
    <div className="min-h-screen bg-jkuat-fixed">
      <Outlet />
    </div>
  )
}