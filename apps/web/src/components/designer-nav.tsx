'use client';
import { usePathname } from 'next/navigation';

export function DesignerNav({ right }: { right?: React.ReactNode }) {
  const path = usePathname();
  const links = [
    { href: '/designer', label: 'Analysis' },
    { href: '/designer/sandbox', label: 'Sandbox' },
    { href: '/designer/cards', label: 'Cards' },
  ];
  return (
    <nav aria-label="Designer tools" className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-line-soft px-4 py-3.5 md:px-7">
      <a href="/" className="mr-2.5 font-display text-[19px] font-extrabold text-text no-underline">
        Doorway · Designer
      </a>
      {links.map((l) => {
        const on = path === l.href;
        return (
          <a key={l.href} href={l.href} aria-current={on ? 'page' : undefined} className="inline-flex min-h-[40px] items-center rounded-[10px] px-3 no-underline" style={{ background: on ? 'var(--surface-2)' : 'transparent', color: on ? 'var(--text)' : 'var(--muted)', fontWeight: on ? 700 : 400 }}>
            {l.label}
          </a>
        );
      })}
      <a href="/" className="inline-flex min-h-[40px] items-center px-3 text-muted no-underline">
        Back to the table
      </a>
      <div className="flex-1" />
      {right}
    </nav>
  );
}
