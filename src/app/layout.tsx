import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ErrorPanel } from '@/components/ErrorPanel'
import { QueryProvider } from '@/providers/QueryProvider'
import { DevBanner } from '@/components/DevBanner'
import '@/lib/error-handler' // Initialize global error handler

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
})

export const metadata: Metadata = {
  title: 'Parsley',
  description: 'A resizable two-panel application.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans antialiased ${inter.variable}`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <AuthProvider>
              <ErrorBoundary>
                <DevBanner />
                {children}
                <ErrorPanel />
              </ErrorBoundary>
              <Toaster />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
