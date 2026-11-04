'use client';
import { usePathname } from 'next/navigation';

/** Designer header, Analyst style (DESIGN-v2 §4): no Board/Analyst switch — /designer is Analyst only. */
export function DesignerNav({ right }: { right?: React.ReactNode }) {
  const path = usePathname();
  const links = [
    { href: '/designer', label: 'Analysis' },
    { href: '/designer/sandbox', label: 'Sandbox' },
    { href: '/designer/cards', label: 'Cards' },
  ];
  return (
    <nav
      aria-label="Designer tools"
      className="mx-4 flex flex-wrap items-center gap-x-[18px] gap-y-2 border-b-2 border-ink pt-3.5 pb-3 md:mx-7"
    >
      <a href="/" className="mr-1 font-wordmark text-[26px] leading-none font-normal text-ink no-underline">
        Doorway
      </a>
      <span className="font-mono text-[12.5px] text-muted">designer tools</span>
      <div className="inline-flex overflow-hidden rounded-lg border-[1.5px] border-ink">
        {links.map((l) => {
          const on = path === l.href;
          return (
            <a
              key={l.href}
              href={l.href}
              aria-current={on ? 'page' : undefined}
              className={`inline-flex min-h-[36px] items-center px-3.5 font-semibold no-underline ${
                on ? 'bg-ink text-sheet' : 'bg-transparent text-ink'
              }`}
            >
              {l.label}
            </a>
          );
        })}
      </div>
      <a href="/" className="inline-flex min-h-[36px] items-center px-1 text-[13px] text-muted">
        Back to the table
      </a>
      <div className="flex-1" />
      {right}
    </nav>
  );
}
