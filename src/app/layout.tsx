import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Community Discord — Pre-Register',
  description: 'Link your Discord to join the community. Pre-register or connect an existing game account.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
