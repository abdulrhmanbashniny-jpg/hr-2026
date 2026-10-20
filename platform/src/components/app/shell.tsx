'use client';

import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const NavContext = createContext<{ open: boolean; setOpen: (v: boolean) => void }>({ open: false, setOpen: () => undefined });
export const useNav = () => useContext(NavContext);

export function AppShell({ sidebar, children }: { sidebar: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <NavContext.Provider value={{ open, setOpen }}>
      <div className="app-shell" data-nav-open={open}>
        {sidebar}
        {open ? <div className="ui-scrim" style={{ zIndex: 55 }} onClick={() => setOpen(false)} aria-hidden /> : null}
        <div className="app-main">{children}</div>
      </div>
    </NavContext.Provider>
  );
}
