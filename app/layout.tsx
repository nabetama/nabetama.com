import type { Metadata } from 'next'
import './global.css'
import { Inter } from 'next/font/google'
import { ThemeProvider } from 'components/theme-provider'
import React from 'react'
import { SITE_DOMAIN } from '@/constants'
import ClientLayout from 'components/client-layout'

const inter = Inter({ subsets: ['latin'] })

export async function generateMetadata(): Promise<Metadata> {
  const title = SITE_DOMAIN
  const description = '購入したものや気になったものを紹介したり学んだことをメモするブログです。'
  const url = `https://${SITE_DOMAIN}`
  const imageURL = `https://${SITE_DOMAIN}/default_og_image.jpg`

  return {
    metadataBase: new URL(url),
    title: {
      default: title,
      template: `%s | ${title}`,
    },
    openGraph: {
      title,
      description,
      url,
      type: 'website',
      siteName: title,
      images: [{ url: imageURL }],
    },
    twitter: {
      card: 'summary',
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
    <html suppressHydrationWarning={true} lang="ja">
      <body
        className={`antialiased min-h-screen bg-white dark:bg-cloudflare-darktheme-bg text-slate-900 dark:text-cloudflare-darktheme-font ${inter.className}`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ClientLayout>{children}</ClientLayout>
        </ThemeProvider>
      </body>
    </html>
  )
}
