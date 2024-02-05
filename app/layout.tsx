import type { Metadata } from 'next'
import './global.css'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'components/theme-provider'
import React from 'react'
import Footer from 'components/footer'
import Header from 'components/header'
import { SITE_DOMAIN } from '@/constants'

const inter = Inter({ subsets: ['latin'] })

export async function generateMetadata(): Promise<Metadata> {
  const title = SITE_DOMAIN
  const description = '購入したものや気になったものを紹介したり学んだことをメモするブログです。'
  const url = `https://${SITE_DOMAIN}`
  const imageURL = `https://${SITE_DOMAIN}/default_og_image.jpg`

  return {
    metadataBase: new URL(url),
    title,
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      siteName: title,
      images: [{ url: imageURL }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [{ url: imageURL }],
    },
    alternates: {
      canonical: url,
    },
  }
}

interface RootLayoutProps {
  children: React.ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ja">
      <body
        className={`antialiased min-h-screen bg-white dark:bg-cloudflare-darktheme-bg text-slate-900 dark:text-cloudflare-darktheme-font ${inter.className}`}
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
