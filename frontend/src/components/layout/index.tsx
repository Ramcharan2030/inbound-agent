import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Settings,
  PhoneCall,
  Users,
  Calendar,
  Database,
  PhoneForwarded,
  Building2,
  Menu,
  X,
  Zap,
  LogOut,
} from 'lucide-react';
import { cn } from '../ui';
import { ToastContainer } from '../ui';
import { useAuth } from '../../context/AuthContext';

// ─── Navigation Config ────────────────────────────────────────
const NAV_ITEMS = [
  { to: '/',            icon: LayoutDashboard, label: 'Overview',       section: 'main' },
  { to: '/logs',        icon: PhoneCall,       label: 'Call Logs',      section: 'main' },
  { to: '/contacts',   icon: Users,           label: 'Contacts',       section: 'main' },
  { to: '/appointments', icon: Calendar,      label: 'Site Visits',    section: 'main' },
  { to: '/schedule',   icon: Building2,       label: 'Visit Schedule', section: 'main' },
  { to: '/kb',         icon: Database,        label: 'Knowledge Base', section: 'main' },
  { to: '/outbound',   icon: PhoneForwarded,  label: 'Outbound',       section: 'main' },
] as const;

// ─── Nav Item ─────────────────────────────────────────────────
interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}

const NavItem = ({ to, icon: Icon, label, onClick }: NavItemProps) => (
  <NavLink
    to={to}
    end={to === '/'}
    onClick={onClick}
    className={({ isActive }) =>
      cn(
        'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-150 group relative',
        isActive
          ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20 nav-active'
          : 'text-zinc-500 hover:text-zinc-200 hover:bg-[#13141a]'
      )
    }
  >
    {({ isActive }) => (
      <>
        <Icon
          size={18}
          className={cn(
            'transition-transform duration-150 shrink-0',
            isActive ? 'text-blue-400' : 'text-zinc-600 group-hover:text-zinc-300'
          )}
        />
        <span className="truncate">{label}</span>
        {isActive && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
        )}
      </>
    )}
  </NavLink>
);

// ─── Sidebar Logo ─────────────────────────────────────────────
const SidebarLogo = () => (
  <div className="px-5 py-5 border-b border-[#1c1e27]">
    <div className="flex items-center gap-3">
      {/* Stylized "A" mark inspired by logo */}
      <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/30 shrink-0">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M10 2L17 16H13.5L12 13H8L6.5 16H3L10 2Z"
            fill="white"
            opacity="0.9"
          />
          <path
            d="M8.8 10.5L10 7.5L11.2 10.5H8.8Z"
            fill="#08090c"
          />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-base font-black tracking-tight text-white leading-none">
          A<span className="text-blue-400">Solutions</span>
        </p>
        <p className="text-[10px] font-medium text-zinc-600 uppercase tracking-widest mt-0.5 truncate">
          Automate The Solutions
        </p>
      </div>
    </div>
  </div>
);

// ─── Sidebar ──────────────────────────────────────────────────
export const Sidebar = ({
  className,
  onMobileClose,
}: {
  className?: string;
  onMobileClose?: () => void;
}) => {
  const { user, signOut } = useAuth();

  return (
    <aside
      className={cn(
        'flex flex-col h-full w-64 bg-[#0a0b0f] border-r border-[#1c1e27]',
        className
      )}
    >
      <SidebarLogo />

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 text-[10px] font-bold text-zinc-700 uppercase tracking-widest mb-3">
          Navigation
        </p>
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            onClick={onMobileClose}
          />
        ))}
      </nav>

      {/* User profile section in sidebar for mobile/tablet */}
      {user && (
        <div className="px-4 py-3 mx-3 mb-2 rounded-xl bg-[#0e0f14] border border-[#1c1e27] lg:hidden flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-[10px] font-bold text-blue-400 shrink-0">
              {user.email ? user.email.slice(0, 2).toUpperCase() : 'U'}
            </div>
            <span className="text-xs text-zinc-400 truncate">{user.email}</span>
          </div>
          <button onClick={signOut} className="text-zinc-500 hover:text-red-400 p-1">
            <LogOut size={14} />
          </button>
        </div>
      )}

      {/* Bottom section */}
      <div className="px-3 pb-4 space-y-0.5 border-t border-[#1c1e27] pt-4">
        <p className="px-3 text-[10px] font-bold text-zinc-700 uppercase tracking-widest mb-3">
          System
        </p>
        <NavItem to="/config" icon={Settings} label="Configuration" onClick={onMobileClose} />

        {/* Status indicator */}
        <div className="mt-3 mx-1 px-3 py-2.5 rounded-xl bg-[#0e0f14] border border-[#1c1e27]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-xs font-medium text-zinc-400">Agent Online</span>
          </div>
          <p className="text-[10px] text-zinc-700 mt-0.5 flex items-center gap-1">
            <Zap size={9} className="text-amber-600" />
            Gemini Live Active
          </p>
        </div>
      </div>
    </aside>
  );
};

// ─── Header ───────────────────────────────────────────────────
const PAGE_TITLES: Record<string, string> = {
  '/':             'Dashboard Overview',
  '/logs':         'Call Logs',
  '/contacts':     'Contacts',
  '/appointments': 'Site Visits',
  '/schedule':     'Visit Schedule',
  '/kb':           'Knowledge Base',
  '/outbound':     'Outbound Dispatch',
  '/config':       'Configuration',
};

export const Header = ({ onMenuClick }: { onMenuClick: () => void }) => {
  const { pathname } = useLocation();
  const pageTitle = PAGE_TITLES[pathname] || 'ASolutions';
  const { user, signOut } = useAuth();
  const userEmail = user?.email || '';
  const initials = userEmail ? userEmail.slice(0, 2).toUpperCase() : 'U';

  return (
    <header className="h-14 border-b border-[#1c1e27] bg-[#08090c]/80 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-zinc-500 hover:text-white hover:bg-[#1a1c24] rounded-lg transition-colors"
        >
          <Menu size={20} />
        </button>
        <div>
          <p className="text-sm font-semibold text-white">{pageTitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* User profile dropdown/pill */}
        {user && (
          <div className="flex items-center gap-3 pr-3 border-r border-[#1c1e27] h-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-[10px] font-bold text-blue-400">
                {initials}
              </div>
              <span className="hidden sm:inline text-xs font-medium text-zinc-400 max-w-[150px] truncate">
                {userEmail}
              </span>
            </div>
            <button
              onClick={signOut}
              title="Sign Out"
              className="p-1 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}

        {/* Live status pill */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-medium text-emerald-400">Live</span>
        </div>

        {/* Brand pill */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#1a1c24] border border-[#252833]">
          <div className="w-5 h-5 rounded-md bg-blue-600 flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 20 20" fill="none">
              <path d="M10 2L17 16H13.5L12 13H8L6.5 16H3L10 2Z" fill="white" opacity="0.9" />
              <path d="M8.8 10.5L10 7.5L11.2 10.5H8.8Z" fill="#08090c" />
            </svg>
          </div>
          <span className="text-xs font-bold text-zinc-300">
            A<span className="text-blue-400">Solutions</span>
          </span>
        </div>
      </div>
    </header>
  );
};

// ─── Layout ───────────────────────────────────────────────────
export const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-[#08090c] text-zinc-100">
      {/* Mobile overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 lg:hidden backdrop-blur-sm animate-fade-in"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Mobile close button */}
      {isSidebarOpen && (
        <button
          className="fixed top-4 right-4 z-50 lg:hidden p-2 text-zinc-300 hover:text-white bg-[#1a1c24] rounded-xl border border-[#252833]"
          onClick={() => setIsSidebarOpen(false)}
        >
          <X size={20} />
        </button>
      )}

      {/* Sidebar */}
      <Sidebar
        className={cn(
          'fixed inset-y-0 left-0 z-50 lg:static lg:translate-x-0',
          'transform transition-transform duration-300 ease-in-out',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        onMobileClose={() => setIsSidebarOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      {/* Global toast notifications */}
      <ToastContainer />
    </div>
  );
};
