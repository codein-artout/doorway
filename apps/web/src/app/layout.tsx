import type { Metadata, Viewport } from 'next';
import { Atkinson_Hyperlegible, Bricolage_Grotesque, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { PaletteBoot } from '@/components/palette-boot';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '700', '800'],
  variable: '--font-bricolage',
  display: 'swap',
});
const atkinson = Atkinson_Hyperlegible({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-atkinson',
  display: 'swap',
});
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Doorway', template: '%s · Doorway' },
  description: 'Doorway — the digital playtest table, bots and designer tools.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#12131F' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${atkinson.variable} ${jetbrains.variable}`}
      data-palette="standard"
    >
      <body>
        <PaletteBoot />
        {children}
      </body>
    </html>
  );
}
