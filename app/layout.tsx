import Link from 'next/link'
import './global.css'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'components/theme-provider'
import React from 'react'
import Footer from 'components/footer'
import Header from 'components/header'
import { SITE_DOMAIN } from '@/constants'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: SITE_DOMAIN,
  description: '購入したものや気になったものを紹介したり学んだことをメモするブログです。',
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ja">
      <body
        className={`antialiased min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 ${inter.className}`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="max-w-2xl mx-auto py-10 px-4">
            <Header />
            <main>{children}</main>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
