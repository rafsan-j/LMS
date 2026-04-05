import type { Metadata, Viewport } from 'next'
import './globals.css'
import "katex/dist/katex.min.css"
import NavigationShell from './components/NavigationShell'

export const metadata: Metadata = {
  title: 'Focus OS',
  description: 'Distraction-free personal learning management',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Focus OS' },
}

export const viewport: Viewport = { themeColor: '#FDFDFD', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <NavigationShell>
          {children}
        </NavigationShell>
      </body>
    </html>
  )
}