'use client'

import React, { useState } from 'react'
import Header from './header'
import SideMenu from './side-menu'
import Footer from './footer'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <>
      <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      <div className="flex">
        <div className={`flex-1 max-w-2xl mx-auto py-10 px-4 ${isMenuOpen ? 'bg-gray' : ''}`}>
          <Header onMenuClick={() => setIsMenuOpen(true)} />
          <main>{children}</main>
          <Footer />
        </div>
      </div>
    </>
  )
}
