import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Settings, 
  PhoneCall, 
  Users, 
  Calendar, 
  Database, 
  PhoneForwarded,
  Activity,
  Menu,
  X,
  Stethoscope
} from 'lucide-react';
import { cn, Badge } from '../ui';

interface NavItemProps {
  to: string;
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}

const NavItem = ({ to, icon: Icon, label, onClick }: NavItemProps) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) => cn(
      'flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all',
      isActive 
        ? 'bg-blue-600/10 text-blue-500' 
        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
    )}
  >
    <Icon size={20} />
    {label}
  </NavLink>
);

export const Sidebar = ({ className, onMobileClose }: { className?: string, onMobileClose?: () => void }) => {
  return (
    <aside className={cn('flex flex-col h-full bg-zinc-950 border-r border-zinc-800 w-64', className)}>
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
          <Activity className="text-white" size={20} />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-white">SPX<span className="text-blue-500">Agent</span></h1>
      </div>
      
      <nav className="flex-1 px-3 space-y-1">
        <NavItem to="/" icon={LayoutDashboard} label="Overview" onClick={onMobileClose} />
        <NavItem to="/logs" icon={PhoneCall} label="Call Logs" onClick={onMobileClose} />
        <NavItem to="/contacts" icon={Users} label="Contacts" onClick={onMobileClose} />
        <NavItem to="/appointments" icon={Calendar} label="Appointments" onClick={onMobileClose} />
        <NavItem to="/schedule" icon={Stethoscope} label="Doctor Schedule" onClick={onMobileClose} />
        <NavItem to="/kb" icon={Database} label="Knowledge Base" onClick={onMobileClose} />
        <NavItem to="/outbound" icon={PhoneForwarded} label="Outbound" onClick={onMobileClose} />
      </nav>

      <div className="p-4 border-t border-zinc-800">
        <NavItem to="/config" icon={Settings} label="Configuration" onClick={onMobileClose} />
      </div>
    </aside>
  );
};

export const Header = ({ onMenuClick }: { onMenuClick: () => void }) => {
  return (
    <header className="h-16 border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 text-zinc-400 hover:text-white"
        >
          <Menu size={24} />
        </button>
        <div className="flex items-center gap-2">
          <Badge variant="success" className="animate-pulse h-2 w-2 p-0 rounded-full"> </Badge>
          <span className="text-sm font-medium text-zinc-300">System Live</span>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="text-right hidden sm:block">
          <p className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Gemini Branch</p>
          <p className="text-sm font-medium text-white">v1.0.0-live</p>
        </div>
      </div>
    </header>
  );
};

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-50 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar 
        className={cn(
          'fixed inset-y-0 left-0 z-50 lg:static transform transition-transform duration-300 lg:translate-x-0',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        onMobileClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <Header onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-zinc-950 p-6 lg:p-10">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
