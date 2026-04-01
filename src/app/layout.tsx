import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';
import Navbar from '@/components/navBar/Navbar';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Context',
  description: 'A reusable Context-inspired shell without auth.',
  icons: {
    icon: '/context-icon.svg'
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased dark:bg-gray-900 dark:text-gray-50`}>
        <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.08),transparent_25%),radial-gradient(circle_at_80%_0%,rgba(236,72,153,0.06),transparent_25%),radial-gradient(circle_at_50%_80%,rgba(45,212,191,0.05),transparent_25%)]" />
        <Navbar />
        <main className="pt-20">{children}</main>
      </body>
    </html>
  );
}
