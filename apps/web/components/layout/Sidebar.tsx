'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FlaskConical,
  FileText,
  Settings,
  ExternalLink,
  Database,
} from 'lucide-react';
import clsx from 'clsx';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tests', label: 'Tests', icon: FlaskConical },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/settings/environments', label: 'Environments', icon: Database },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 h-screen bg-graphite-800 border-r border-graphite-400 flex flex-col flex-shrink-0">
      {/* Brand */}
      <div className="px-5 py-6 border-b border-graphite-400 flex items-center justify-center">
        {/* Pixelated Redaction Mark */}
        <Link href="/" className="w-28 h-8 flex items-center justify-center opacity-90 hover:opacity-100 transition-opacity">
          <svg viewBox="0 0 100 30" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="0" width="10" height="10" fill="#a3a3a3"/><rect x="10" y="0" width="10" height="10" fill="#e5e5e5"/><rect x="20" y="0" width="10" height="10" fill="#404040"/><rect x="30" y="0" width="10" height="10" fill="#d4d4d4"/><rect x="40" y="0" width="10" height="10" fill="#737373"/><rect x="50" y="0" width="10" height="10" fill="#a3a3a3"/><rect x="60" y="0" width="10" height="10" fill="#d4d4d4"/><rect x="70" y="0" width="10" height="10" fill="#525252"/><rect x="80" y="0" width="10" height="10" fill="#a3a3a3"/><rect x="90" y="0" width="10" height="10" fill="#e5e5e5"/>
            <rect x="0" y="10" width="10" height="10" fill="#d4d4d4"/><rect x="10" y="10" width="10" height="10" fill="#737373"/><rect x="20" y="10" width="10" height="10" fill="#e5e5e5"/><rect x="30" y="10" width="10" height="10" fill="#525252"/><rect x="40" y="10" width="10" height="10" fill="#262626"/><rect x="50" y="10" width="10" height="10" fill="#a3a3a3"/><rect x="60" y="10" width="10" height="10" fill="#e5e5e5"/><rect x="70" y="10" width="10" height="10" fill="#737373"/><rect x="80" y="10" width="10" height="10" fill="#404040"/><rect x="90" y="10" width="10" height="10" fill="#d4d4d4"/>
            <rect x="0" y="20" width="10" height="10" fill="#737373"/><rect x="10" y="20" width="10" height="10" fill="#d4d4d4"/><rect x="20" y="20" width="10" height="10" fill="#a3a3a3"/><rect x="30" y="20" width="10" height="10" fill="#e5e5e5"/><rect x="40" y="20" width="10" height="10" fill="#525252"/><rect x="50" y="20" width="10" height="10" fill="#262626"/><rect x="60" y="20" width="10" height="10" fill="#737373"/><rect x="70" y="20" width="10" height="10" fill="#d4d4d4"/><rect x="80" y="20" width="10" height="10" fill="#a3a3a3"/><rect x="90" y="20" width="10" height="10" fill="#404040"/>
          </svg>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-5 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-150',
                isActive
                  ? 'bg-graphite-700 text-chalk font-medium shadow-sm border border-graphite-400'
                  : 'text-graphite-100 hover:text-chalk hover:bg-graphite-700 border border-transparent',
              )}
            >
              <item.icon
                size={16}
                strokeWidth={isActive ? 2.5 : 2}
                className={clsx(
                  'flex-shrink-0 transition-colors',
                  isActive ? 'text-chalk' : 'text-graphite-100 group-hover:text-chalk',
                )}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-graphite-400">
        <a
          href="http://localhost:3001/api/health"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-2xs text-graphite-100 hover:text-chalk transition-colors"
        >
          <ExternalLink size={10} />
          API Status
        </a>
        <div className="text-2xs text-graphite-100 mt-1.5 opacity-50">
          v0.1.0-beta
        </div>
      </div>
    </aside>
  );
}
