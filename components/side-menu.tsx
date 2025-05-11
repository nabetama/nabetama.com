import Link from 'next/link'
import { HomeIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useEffect } from 'react'

const menu = [
  { name: 'ホーム', href: '/', icon: HomeIcon },
  { name: 'このサイトについて', href: '/about', icon: InformationCircleIcon },
]

export default function SideMenu({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  // サイドメニューオープン時に背景スクロール禁止
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <>
      {/* オーバーレイ */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 transition-opacity duration-300"
          onClick={onClose}
          tabIndex={-1}
          aria-label="メニューを閉じるオーバーレイ"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onClose()
          }}
        />
      )}
      {/* サイドメニュー本体 */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-gray-900 text-white flex flex-col py-8 px-4 z-50 shadow-lg
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        aria-hidden={!isOpen}
      >
        <button
          type="button"
          className="self-end mb-6 p-2 rounded hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
          onClick={onClose}
          aria-label="メニューを閉じる"
        >
          <XMarkIcon className="w-7 h-7" />
        </button>
        <nav className="flex flex-col gap-2">
          {menu.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-4 py-3 px-3 rounded-lg hover:bg-sky-700 transition-colors"
              onClick={onClose}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-lg font-medium">{item.name}</span>
            </Link>
          ))}
        </nav>
      </aside>
    </>
  )
}
