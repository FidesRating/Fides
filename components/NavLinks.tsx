'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const ITEMS = [
  { href: '/', label: 'HOME' },
  { href: '/under-review', label: 'UNDER REVIEW' },
  { href: '/actions', label: 'ACTIONS' },
  { href: '/research', label: 'RESEARCH' },
  { href: '/ratings', label: 'RATINGS' },
  { href: '/methodology', label: 'METHODOLOGY' },
];

export default function NavLinks({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {ITEMS.map((it, i) => {
        const on = it.href === '/' ? path === '/' : path.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} className={on ? 'on' : undefined} aria-current={on ? 'page' : undefined}>
            <span className="n">{String(i + 1).padStart(2, '0')}_</span>
            {it.label}
          </Link>
        );
      })}
      {children}
    </nav>
  );
}
