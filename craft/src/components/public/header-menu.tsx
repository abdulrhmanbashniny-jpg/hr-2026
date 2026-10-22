'use client';

import { Menu, Search, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { useI18n } from '@/lib/i18n/client';
import { landingStrings } from '@/lib/i18n/pages/landing';
import { LanguageSwitch } from './language-switch';
import { UniversalSearch } from './universal-search';

/** "Verify a craftsman": the universal member-number search, one tap away on every public page. */
export function HeaderSearch() {
  const { locale } = useI18n();
  const s = landingStrings(locale);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="press inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface-container-lowest px-space-sm text-label-md text-on-surface-variant shadow-xs hover:bg-canvas hover:text-on-surface" aria-label={s.header.search}>
        <Search className="size-5" />
        <span className="hidden 2xl:inline">{s.header.search}</span>
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={s.header.searchTitle}>
        <p className="mb-space-md text-body-md text-on-surface-variant">{s.header.searchBody}</p>
        <UniversalSearch autoFocus />
      </Dialog>
    </>
  );
}

/** The phone menu: section links, both portals and the language switch. */
export function HeaderMenu({ links, portals }: { links: { href: string; label: string }[]; portals: { href: string; label: string }[] }) {
  const { locale, t } = useI18n();
  const s = landingStrings(locale);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="grid size-11 place-items-center rounded-xl text-on-surface-variant hover:bg-surface-container-high xl:hidden" aria-label={s.header.menu} aria-expanded={open}>
        <Menu className="size-6" />
      </button>
      <AnimatePresence>
        {open && (
          <>
            <motion.div key="scrim" className="fixed inset-0 z-[60] bg-primary-container/40 backdrop-blur-[4px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside
              key="panel"
              className="fixed inset-y-0 end-0 z-[60] flex w-[min(20rem,88vw)] flex-col bg-surface-container-lowest p-space-md shadow-lg"
              initial={{ x: t.meta.dir === 'rtl' ? '-100%' : '100%' }}
              animate={{ x: 0 }}
              exit={{ x: t.meta.dir === 'rtl' ? '-100%' : '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
              <div className="mb-space-md flex items-center justify-between">
                <span className="text-headline-sm text-primary">{t.meta.product}</span>
                <button type="button" onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-xl hover:bg-surface-container-high" aria-label={s.header.close}>
                  <X className="size-5" />
                </button>
              </div>
              <nav className="flex flex-col gap-1">
                {links.map((l) => (
                  <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-xl px-space-md py-space-sm text-label-lg text-on-surface hover:bg-surface-container-low">
                    {l.label}
                  </a>
                ))}
              </nav>
              <div className="mt-space-md border-t border-line pt-space-md">
                <div className="mb-space-xs text-label-sm text-on-surface-variant">{s.header.portals}</div>
                {portals.map((p) => (
                  <Link key={p.href} href={p.href} onClick={() => setOpen(false)} className="block rounded-xl px-space-md py-space-sm text-label-lg text-primary-container hover:bg-surface-container-low">
                    {p.label}
                  </Link>
                ))}
              </div>
              <div className="mt-auto pt-space-md">
                <LanguageSwitch />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
