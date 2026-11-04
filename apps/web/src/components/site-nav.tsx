'use client';
import { usePathname } from 'next/navigation';
import { ViewSwitch } from './view-switch';

const LINKS = [
  { href: '/', label: 'New game' },
  { href: '/play', label: 'Table' },
  { href: '/replay', label: 'Replays' },
  { href: '/rules', label: 'Rules' },
  { href: '/designer', label: 'Designer' },
];

export function SiteNav({ right }: { right?: React.ReactNode }) {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-line-soft px-4 py-3.5 md:px-7"
    >
      <a
        href="/"
        className="mr-2.5 font-wordmark text-[21px] font-normal tracking-[-0.01em] text-text no-underline"
      >
        Doorway
      </a>
      {LINKS.map((l) => {
        const on = l.href === '/' ? path === '/' : path?.startsWith(l.href);
        return (
          <a
            key={l.href}
            href={l.href}
            aria-current={on ? 'page' : undefined}
            className="inline-flex min-h-[40px] items-center rounded-[10px] px-3 no-underline"
            style={{
              background: on ? 'var(--surface-2)' : 'transparent',
              color: on ? 'var(--text)' : 'var(--muted)',
              fontWeight: on ? 700 : 400,
            }}
          >
            {l.label}
          </a>
        );
      })}
      <div className="flex-1" />
      <ViewSwitch />
      {right}
    </nav>
  );
}
