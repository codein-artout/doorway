import type { Metadata, Viewport } from 'next';
import { Caprasimo, Gochi_Hand, IBM_Plex_Mono, IBM_Plex_Sans, Nunito } from 'next/font/google';
import './globals.css';
import { PaletteBoot } from '@/components/palette-boot';
import { VIEW_BOOT_SCRIPT } from '@/lib/view';

const caprasimo = Caprasimo({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-caprasimo',
  display: 'swap',
});
const gochi = Gochi_Hand({ subsets: ['latin'], weight: '400', variable: '--font-gochi', display: 'swap' });
const nunito = Nunito({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800', '900'],
  variable: '--font-nunito',
  display: 'swap',
});
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Doorway', template: '%s · Doorway' },
  description: 'Doorway — the digital playtest table, bots and designer tools.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#2C3836' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${caprasimo.variable} ${gochi.variable} ${nunito.variable} ${plexSans.variable} ${plexMono.variable}`}
      data-palette="standard"
      data-view="board"
      suppressHydrationWarning
    >
      <head>
        {/* set the Board / Analyst view before first paint (DESIGN-v2 §1) */}
        <script dangerouslySetInnerHTML={{ __html: VIEW_BOOT_SCRIPT }} />
      </head>
      <body>
        <PaletteBoot />
        {children}
      </body>
    </html>
  );
}
