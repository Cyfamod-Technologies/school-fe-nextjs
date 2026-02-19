'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import './agent-ui.css';

const AGENT_NAV_ITEMS = [
  { href: '/agent/dashboard', label: 'Dashboard', icon: 'flaticon-dashboard' },
  { href: '/agent/profile', label: 'Profile', icon: 'flaticon-user' },
  { href: '/agent/referrals', label: 'Referrals', icon: 'flaticon-classmates' },
  { href: '/agent/earnings', label: 'Earnings', icon: 'flaticon-money' },
  { href: '/agent/payouts', label: 'Payouts', icon: 'flaticon-script' },
] as const;

export default function AgentLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAuthPage = useMemo(
    () =>
      pathname === '/agent/login' ||
      pathname === '/agent/register' ||
      pathname === '/agent/forgot-password' ||
      pathname === '/agent/reset-password',
    [pathname],
  );

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('agentToken');
      localStorage.removeItem('agent_token');
      localStorage.removeItem('agent');
    }
    router.push('/agent/login');
  };

  if (isAuthPage) {
    return <div className="agent-ui">{children}</div>;
  }

  return (
    <div className="agent-ui agent-shell">
      <header className="agent-mobile-header">
        <button
          type="button"
          className="agent-mobile-menu-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          <i className="flaticon-menu" />
        </button>
        <span className="agent-mobile-title">Agent Portal</span>
      </header>

      <div
        className={`agent-sidebar-backdrop ${mobileOpen ? 'is-open' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <aside className={`agent-sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <div className="agent-sidebar-brand">
          <p className="agent-sidebar-kicker">Portal</p>
          <h3>Agent Panel</h3>
        </div>

        <nav className="agent-sidebar-nav">
          {AGENT_NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`agent-nav-link ${isActive ? 'is-active' : ''}`}
                onClick={() => setMobileOpen(false)}
              >
                <i className={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <button type="button" className="agent-logout-btn" onClick={handleLogout}>
          <i className="flaticon-turn-off" />
          <span>Logout</span>
        </button>
      </aside>

      <main className="agent-main-content">{children}</main>
    </div>
  );
}
