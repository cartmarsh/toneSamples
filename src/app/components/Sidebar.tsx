'use client';

import Link from 'next/link'

const navigationLinks = [
  { href: '/', label: 'Home' },
  { href: '/components', label: 'Piano' },
  { href: '/components/draw-sound', label: 'Draw Sound' },
  { href: '/components/sequencer', label: 'Step Sequencer' },
  { href: '/components/hand-sound', label: 'Hand Sound' },
  { href: '/components/tone-paint', label: 'Tone Paint' },
  // Add more routes as needed
]

export const Sidebar = () => {
  return (
    <aside className="w-64 h-screen bg-gray-50 dark:bg-gray-900 fixed left-0 top-0 border-r border-gray-200 dark:border-gray-800 z-10">
      <nav className="p-4">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Components</h1>
        </div>
        <ul className="space-y-2">
          {navigationLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="block px-4 py-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  )
} 