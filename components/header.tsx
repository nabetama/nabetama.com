'use client'

import Link from 'next/link'
import { SITE_DOMAIN } from '@/constants'

export type Nav = {
  name: string
  href: string
}

export default function Header() {
  return (
    <header>
      <div className="flex items-center justify-start h-28 pt-0">
        <h1 className="text-2xl font-bold block">
          <Link href="/">{SITE_DOMAIN}</Link>
        </h1>
      </div>
    </header>
  )
}
