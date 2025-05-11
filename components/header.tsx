'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Bars3Icon } from '@heroicons/react/24/solid'
import { SITE_DOMAIN } from '@/constants'

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header>
      <div className="flex items-center justify-start h-28 pt-0">
        <button
          type="button"
          className="mr-4 p-2 rounded hover:bg-gray-200"
          onClick={onMenuClick}
          aria-label="メニューを開く"
        >
          <Bars3Icon className="w-8 h-8" />
        </button>
        <h1 className="text-2xl font-bold block">
          <Link href="/">{SITE_DOMAIN}</Link>
        </h1>
      </div>
    </header>
  )
}
