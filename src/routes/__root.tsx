import { HeadContent, Scripts, createRootRoute, Outlet, Link } from '@tanstack/react-router'
import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'JKUAT Queue Management System' },
    ],
    links: [
      { rel: 'icon', type: 'image/jpeg', href: '/favicon.jpeg' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-jkuat-fixed">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
