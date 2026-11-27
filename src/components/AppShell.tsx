import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Award,
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileText,
  Flag,
  GraduationCap,
  Inbox,
  LogOut,
  MapPin,
  Megaphone,
  Menu,
  Receipt,
  Settings,
  ShieldAlert,
  Upload,
  User,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { getSidebarItemsForRole, type SidebarNavItem } from '../core/scoping';
import { getApplicantApplicationState } from '../core/applicantAuth';
import type { AuthSessionUser } from '../core/types';

interface AppShellProps {
  user: AuthSessionUser;
  onLogout: () => void;
  children: React.ReactNode;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  application: FileText,
  form: ClipboardCheck,
  documents: Upload,
  history: Clock,
  overview: UserCheck,
  volunteering: MapPin,
  academics: GraduationCap,
  meetings: CalendarCheck,
  placement: Briefcase,
  help: Flag,
  roster: Users,
  announcements: Megaphone,
  resources: BookOpen,
  approvals: CheckCircle2,
  requests: Inbox,
  fee: Receipt,
  applicants: Users,
  cycles: BarChart3,
  verification: ClipboardCheck,
  awards: Award,
  sampled: ShieldAlert,
  alumni: Briefcase,
  events: Clock,
  settings: Settings,
};

export const AppShell: React.FC<AppShellProps> = ({
  user,
  onLogout,
  children,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Remember collapsed sidebar in localStorage
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('maatram_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  // Mobile off-canvas drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('maatram_sidebar_collapsed', String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const isApplicantEditing = useMemo(() => {
    if (user.role !== 'applicant') return false;
    if (location.pathname.startsWith('/applicant/edit')) return true;

    let isSubmitted = false;
    try {
      const appState = getApplicantApplicationState(user.personId, user.email);
      if (appState.hasSubmitted) {
        isSubmitted = true;
      }
    } catch {
      // ignore
    }
    if (!isSubmitted) {
      try {
        const raw = localStorage.getItem('maatram_submitted_applicants');
        const list = raw ? JSON.parse(raw) : [];
        if (
          Array.isArray(list) &&
          list.some(
            (item: any) =>
              item.personId === user.personId ||
              (user.email &&
                item.email &&
                item.email.toLowerCase() === user.email.toLowerCase())
          )
        ) {
          isSubmitted = true;
        }
      } catch {
        // ignore
      }
    }

    if (
      isSubmitted &&
      (location.pathname === '/applicant/form' ||
        location.pathname.startsWith('/applicant/form/'))
    ) {
      return true;
    }
    return false;
  }, [user.role, user.personId, user.email, location.pathname]);

  const navItems = useMemo(() => {
    return getSidebarItemsForRole(user.role);
  }, [user.role]);

  // Group items by group label
  const groupedItems = useMemo(() => {
    const groups: Array<{ group: string; items: SidebarNavItem[] }> = [];
    for (const item of navItems) {
      let g = groups.find((grp) => grp.group === item.group);
      if (!g) {
        g = { group: item.group, items: [] };
        groups.push(g);
      }
      g.items.push(item);
    }
    return groups;
  }, [navItems]);

  // Compute user initials
  const initials = useMemo(() => {
    if (!user.name) return 'U';
    const parts = user.name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [user.name]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  const renderNavList = () => {
    if (isApplicantEditing) {
      return (
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {!isCollapsed ? (
            <>
              <div className="px-3.5 py-3 rounded-xl bg-neutral-50 border border-neutral-200 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#FFC20E] shrink-0" />
                  <p className="text-xs font-bold text-neutral-950">Editing Application</p>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Modifying submitted application details and documents.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setMobileDrawerOpen(false);
                  navigate('/applicant/application');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-neutral-700 hover:text-neutral-950 hover:bg-neutral-100 transition-colors cursor-pointer border border-neutral-200 bg-white shadow-xs"
              >
                <ChevronLeft className="w-4 h-4 shrink-0 text-neutral-600" />
                <span>Back to Application</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center py-2">
              <button
                type="button"
                onClick={() => navigate('/applicant/application')}
                title="Back to Application"
                className="p-2.5 rounded-xl text-neutral-700 hover:text-neutral-950 hover:bg-neutral-100 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {groupedItems.map((grp) => (
          <div key={grp.group} className="space-y-1">
            {!isCollapsed && (
              <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-neutral-400 select-none">
                {grp.group}
              </p>
            )}
            <nav className="space-y-0.5">
              {grp.items.map((item) => {
                const Icon = ICON_MAP[item.id] || FileText;
                const isActive =
                  location.pathname === item.path ||
                  (item.id === navItems[0].id &&
                    location.pathname === `/${user.role}`);

                return (
                  <NavLink
                    key={item.id}
                    to={item.path}
                    title={isCollapsed ? item.label : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-neutral-100 text-neutral-950 font-semibold border-l-[3px] border-[#FFC20E]'
                        : 'text-neutral-600 hover:text-neutral-950 hover:bg-neutral-50'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white text-neutral-950 flex flex-col md:flex-row">
      {/* Mobile Floating Menu Button at Top Left */}
      <div className="md:hidden fixed top-3 left-3 z-40">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="w-10 h-10 rounded-xl bg-white border border-neutral-300 shadow-sm flex items-center justify-center text-neutral-900 focus:outline-none"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile Off-Canvas Drawer Backdrop */}
      {mobileDrawerOpen && (
        <div
          className="md:hidden fixed inset-0 bg-neutral-950/40 z-50 backdrop-blur-xs transition-opacity"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* Mobile Off-Canvas Drawer */}
      <div
        className={`md:hidden fixed inset-y-0 left-0 w-72 bg-white border-r border-neutral-200 z-50 flex flex-col justify-between transform transition-transform duration-200 ease-in-out ${
          mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="font-display text-xl font-extrabold tracking-[-0.02em] text-neutral-950">
              Maatram
            </span>
            <span className="bg-neutral-950 text-white rounded-full px-2 py-0.5 text-xs font-semibold tracking-tight">
              One
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(false)}
            className="p-1.5 text-neutral-500 hover:text-neutral-950"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {renderNavList()}

        {/* Profile Block at Bottom */}
        <div className="p-3 border-t border-neutral-200 bg-white">
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl hover:bg-neutral-50 transition-colors">
            <button
              type="button"
              onClick={() => {
                setMobileDrawerOpen(false);
                navigate('/profile');
              }}
              className="flex items-center gap-2.5 min-w-0 text-left"
            >
              <div className="w-9 h-9 rounded-full bg-neutral-950 text-white flex items-center justify-center text-xs font-bold font-mono shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-neutral-950 truncate">
                  {user.name}
                </p>
                <p className="text-[11px] text-neutral-500 capitalize">
                  {user.role}
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="p-2 text-neutral-400 hover:text-neutral-950 rounded-lg hover:bg-neutral-100"
              title="Log out"
              aria-label="Log out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Fixed Left Sidebar */}
      <aside
        className={`hidden md:flex flex-col justify-between fixed top-0 bottom-0 left-0 bg-white border-r border-neutral-200 z-30 transition-all duration-200 select-none ${
          isCollapsed ? 'w-20' : 'w-[260px]'
        }`}
      >
        {/* Top: Wordmark & Collapse Button */}
        <div className="h-16 px-4 border-b border-neutral-200 flex items-center justify-between">
          {!isCollapsed ? (
            <div className="flex items-center gap-1.5">
              <span className="font-display text-lg font-extrabold tracking-[-0.02em] text-neutral-950">
                Maatram
              </span>
              <span className="bg-neutral-950 text-white rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-tight">
                One
              </span>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-neutral-950 text-white flex items-center justify-center font-display font-extrabold text-sm mx-auto">
              M
            </div>
          )}

          <button
            type="button"
            onClick={toggleCollapse}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-950 hover:bg-neutral-100 transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Grouped Sidebar Items */}
        {renderNavList()}

        {/* Pinned Profile Block at Bottom */}
        <div className="p-3 border-t border-neutral-200 bg-white">
          <div
            className={`flex items-center rounded-xl hover:bg-neutral-50 transition-colors ${
              isCollapsed ? 'justify-center p-1.5' : 'justify-between p-2'
            }`}
          >
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="flex items-center gap-2.5 min-w-0 text-left group"
              title="My Profile"
            >
              <div className="w-9 h-9 rounded-full bg-neutral-950 text-white flex items-center justify-center text-xs font-bold font-mono shrink-0 group-hover:ring-2 group-hover:ring-neutral-400 transition-all">
                {initials}
              </div>
              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-bold text-neutral-950 truncate group-hover:underline">
                    {user.name}
                  </p>
                  <p className="text-[11px] text-neutral-500 capitalize">
                    {user.role}
                  </p>
                </div>
              )}
            </button>

            {!isCollapsed && (
              <button
                type="button"
                onClick={onLogout}
                className="p-1.5 text-neutral-400 hover:text-neutral-950 rounded-lg hover:bg-neutral-100 transition-colors"
                title="Log out"
                aria-label="Log out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main
        className={`flex-1 min-h-screen transition-all duration-200 ${
          isCollapsed ? 'md:ml-20' : 'md:ml-[260px]'
        }`}
      >
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          {children}
        </div>
      </main>
    </div>
  );
};
