import React, { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronDown, LogOut, RefreshCw } from 'lucide-react';
import { getHomeRouteForRole, getNavItemsForRole } from '../core/scoping';
import type { AuthSessionUser } from '../core/types';

interface TopBarProps {
  user: AuthSessionUser;
  onSwitchAccount: () => void;
  onLogout: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  user,
  onSwitchAccount,
  onLogout,
}) => {
  const navItems = getNavItemsForRole(user.role);
  const homeRoute = getHomeRouteForRole(user.role);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 bg-neutral-950 text-white border-b border-neutral-800">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-2.5 md:py-0 md:h-16 flex flex-wrap md:flex-nowrap items-center justify-between gap-y-2 gap-x-4">
        {/* Left: Maatram One Wordmark + Tagline */}
        <div className="flex items-center gap-3 shrink-0">
          <NavLink
            to={homeRoute}
            className="flex items-center gap-1.5 whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFC20E]"
          >
            <span className="font-display text-lg font-extrabold tracking-[-0.02em] text-white">
              Maatram
            </span>
            <span className="bg-neutral-900 border border-neutral-700 text-white rounded-full px-2 py-0.5 text-xs font-semibold tracking-tight">
              One
            </span>
          </NavLink>
          <span className="hidden lg:inline text-xs text-neutral-400 border-l border-neutral-800 pl-3 whitespace-nowrap">
            From application to alumni
          </span>
        </div>

        {/* Center: Strictly Scoped Role Navigation (Active underline signal) */}
        <nav
          aria-label="Role navigation"
          className="order-3 md:order-2 w-full md:w-auto flex flex-wrap md:flex-nowrap items-center gap-5 border-t border-neutral-800 md:border-t-0 pt-2 md:pt-0"
        >
          {navItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({ isActive }) =>
                `py-1.5 md:py-5 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors border-b-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFC20E] ${
                  isActive
                    ? 'border-[#FFC20E] text-white'
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Right: User Menu (name, role, Switch account, Log out) */}
        <div className="order-2 md:order-3 relative shrink-0" ref={menuRef}>
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            data-testid="user-menu-button"
            onClick={() => setMenuOpen((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-700 hover:border-neutral-500 text-xs text-white transition-colors"
          >
            <span className="font-semibold truncate max-w-[130px] sm:max-w-[180px]">
              {user.name}
            </span>
            <span className="bg-neutral-800 text-neutral-200 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em]">
              {user.role}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400" aria-hidden="true" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 rounded-xl bg-white border border-neutral-200 shadow-lg py-1.5 text-neutral-950 z-40"
            >
              <div className="px-3.5 py-2 border-b border-neutral-100">
                <p className="text-xs font-bold text-neutral-950 truncate">
                  {user.name}
                </p>
                <p className="text-[11px] font-mono text-neutral-500 truncate">
                  {user.role.toUpperCase()} · {user.personId}
                </p>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onSwitchAccount();
                }}
                className="w-full px-3.5 py-2 text-left text-xs font-medium text-neutral-800 hover:bg-neutral-100 flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Switch account</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onLogout();
                }}
                className="w-full px-3.5 py-2 text-left text-xs font-medium text-red-700 hover:bg-red-50 flex items-center gap-2"
              >
                <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
