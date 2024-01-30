'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Menu } from '@headlessui/react'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/solid'
import { SITE_DOMAIN } from '@/constants'

export type Nav = {
  name: string
  href: string
}

const navigations: Nav[] = [
  { name: 'ホーム', href: '/' },
  { name: 'このサイトについて', href: '/about' },
]

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen)

  return (
    <header>
      <div className="flex items-center justify-start h-28 pt-0">
        <h1 className="text-2xl font-bold block">
          <Link href="/">{SITE_DOMAIN}</Link>
        </h1>

        <div className="ml-auto text-sm font-medium space-x-6 h-28 mt-12">
          <Menu>
            <div className="relative m-auto">
              <Menu.Button>
                {isMobileMenuOpen ? (
                  <XMarkIcon
                    className="dark:text-gray-100 w-8 h-8 absolute top-0 right-0"
                    onClick={toggleMobileMenu}
                  />
                ) : (
                  <Bars3Icon
                    className="dark:text-gray-100 w-8 h-8 absolute top-0 right-0"
                    onClick={toggleMobileMenu}
                  />
                )}
              </Menu.Button>
              {Navigations(isMobileMenuOpen)}
            </div>
          </Menu>
        </div>
      </div>
    </header>
  )
}

function Navigations(isOpen: boolean) {
  return (
    <div className={`${isOpen ? 'block flex-col rounded-lg' : 'hidden'}`}>
      <nav className="mt-2 space-y-1 flex-col p-1">
        {navigations.map((nav) => (
          <Link href={nav.href} key={nav.name} className="block mt-5 py-4 text-right">
            {nav.name}
          </Link>
        ))}
      </nav>
    </div>
  )
}
