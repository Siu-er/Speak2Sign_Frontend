import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { Toaster } from "@/app/components/ui/toaster";
import { Toaster as Sonner } from "@/app/components/ui/sonner";
import { TooltipProvider } from "@/app/components/ui/tooltip";
import { ReactQueryProvider } from '@/app/providers'
import { Backdrop } from '@/app/components/shell/Backdrop'
import { DesktopAside } from '@/app/components/shell/DesktopAside'
import '@/app/globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'S2S - Sign & Speech',
  description: 'Real-time two-way sign language and speech translation',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#EEF0FF',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="font-sans antialiased">
        <ReactQueryProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <Backdrop />
            <div className="lg:min-h-screen lg:flex lg:items-center lg:justify-center lg:gap-20 lg:px-10">
              <DesktopAside />
              {children}
            </div>
          </TooltipProvider>
        </ReactQueryProvider>
      </body>
    </html>
  )
}
