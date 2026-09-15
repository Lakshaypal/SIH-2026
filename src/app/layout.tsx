import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import Navigation from '@/components/Navigation';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Halocline | Seeing Beneath the Surface',
  description: 'Real-Time AIS Maritime Vessel Tracking & Subsurface Intelligence',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${mono.variable} font-sans bg-slate-50 text-slate-900 antialiased`}>
        <Navigation />
        <main className="pt-[70px]">
          {children}
        </main>
      </body>
    </html>
  );
}
