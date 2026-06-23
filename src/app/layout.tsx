import '@/lib/mockStorage';
import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AppShell } from '@/components/layout/AppShell';
import { ThemeProvider } from '@/lib/hooks/useTheme';
import Providers from '@/components/layout/Providers';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  variable: '--font-jetbrains',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ENERMASS Solar Calculator',
  description:
    'Professional solar pricing calculator for system design, BOM estimation, and quote generation.',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrains.variable} h-full`}
    >
      <body className="min-h-full antialiased">
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:z-tooltip focus:bg-accent focus:text-background focus:px-4 focus:py-2 focus:rounded-md focus:m-2 focus:font-bold focus:outline-none"
        >
          Skip to main content
        </a>
        <Providers>
          <ThemeProvider>
            <AppShell>{children}</AppShell>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
