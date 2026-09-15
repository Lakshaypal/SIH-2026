'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Anchor, Download } from 'lucide-react';
import clsx from 'clsx';

export default function Navigation() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 h-[70px] bg-white/90 backdrop-blur-md border-b border-slate-200 z-50 flex items-center px-6 shadow-sm">
      <Link href="/" className="flex items-center gap-2 text-slate-800 hover:text-cyan-600 transition-colors mr-8">
        <Anchor size={22} className="text-cyan-600" />
        <span className="font-bold text-xl tracking-tight">Halocline</span>
      </Link>

      <nav className="flex items-center gap-6 flex-1">
        {[
          { href: '/dashboard', label: 'Ocean Explorer' },
          { href: '/fleet', label: 'Fleet Radar' },
          { href: '/technical', label: 'Method & Validation' },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={clsx(
              'text-sm font-semibold transition-colors px-3 py-1.5 rounded-lg',
              pathname === link.href
                ? 'bg-slate-100 text-cyan-600'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            )}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="flex items-center gap-4">
        <a
          href="/OceanEmbed_PG_SIH2026_Engineering_and_Data_Specification.pdf"
          target="_blank"
          className="flex items-center gap-2 text-xs font-semibold text-slate-600 border border-slate-300 px-3 py-1.5 rounded-md hover:bg-slate-50 transition-colors"
        >
          <Download size={14} />
          Technical PDF
        </a>
        <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[10px] font-mono font-bold tracking-wider text-slate-600">LIVE</span>
        </div>
      </div>
    </header>
  );
}
