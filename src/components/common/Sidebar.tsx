import React from 'react';
import {
  LayoutDashboard,
  GitFork,
  Compass,
  Camera,
  Calendar,
  Shield,
  Settings,
  Globe,
  Server,
  Users,
} from 'lucide-react';
import { TiesoraLogo } from './TiesoraLogo';
import { Role } from '../../types';

interface SidebarProps {
  currentTab: string;
  currentRole: Role;
  onNavigate: (tab: string) => void;
  onViewPublicSite: () => void;
  unreadCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  currentRole,
  onNavigate,
  onViewPublicSite,
  unreadCount = 0,
}) => {
  const isAdmin = currentRole === 'admin';

  // Base nav items visible to all roles
  const baseItems = [
    { id: 'dashboard',      label: 'Main Dashboard',        icon: LayoutDashboard },
    { id: 'tree',           label: 'Interactive Tree',       icon: GitFork },
    { id: 'relationships',  label: 'Relationship Explorer',  icon: Compass },
    { id: 'memories',       label: 'Memories & Archive',     icon: Camera },
    { id: 'events',         label: 'Events & Milestones',    icon: Calendar },
  ];

  // Admin-only nav items
  const adminItems = [
    { id: 'user-management', label: 'User Management',       icon: Users },
    { id: 'collaboration',   label: 'Collaboration & Audit', icon: Shield },
    { id: 'settings',        label: 'Settings & Schema',     icon: Settings },
  ];

  const navItems = isAdmin ? [...baseItems, ...adminItems] : baseItems;

  return (
    <aside className="w-56 bg-white border-r border-stone-200 flex flex-col justify-between shrink-0 hidden md:flex">
      {/* Brand & Nav */}
      <div className="p-4 space-y-5">
        {/* Brand */}
        <div className="px-2">
          <TiesoraLogo size="sm" showTagline />
        </div>

        {/* Navigation items */}
        <nav className="space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                  isActive
                    ? 'bg-emerald-800 text-white shadow-xs'
                    : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-stone-400'}`} />
                  <span>{item.label}</span>
                </div>
                {/* Unread badge on collaboration */}
                {item.id === 'collaboration' && unreadCount > 0 && (
                  <span className={`w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center ${
                    isActive ? 'bg-white text-emerald-900' : 'bg-emerald-800 text-white'
                  }`}>
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom — role pill + public site link */}
      <div className="p-4 border-t border-stone-100 space-y-2">
        {/* Role indicator */}
        <div className={`px-3 py-2 rounded-xl text-[11px] font-semibold flex items-center gap-2 ${
          isAdmin ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-stone-50 text-stone-500 border border-stone-200'
        }`}>
          <Shield className="w-3.5 h-3.5 shrink-0" />
          {isAdmin ? 'Administrator' : 'Viewer'}
        </div>

        <button
          onClick={onViewPublicSite}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-stone-600 hover:text-emerald-900 hover:bg-emerald-50/50 rounded-xl transition-colors"
        >
          <Globe className="w-4 h-4 text-stone-400" />
          <span>View Landing Page</span>
        </button>

        <div className="p-3 bg-stone-50 border border-stone-200/80 rounded-xl space-y-1 text-[11px]">
          <div className="flex items-center gap-1.5 font-semibold text-emerald-900">
            <Server className="w-3.5 h-3.5 text-emerald-700" />
            <span>Workspace Storage Active</span>
          </div>
          <p className="text-stone-500 leading-tight">
            11-table schema · Supabase DDL ready
          </p>
        </div>
      </div>
    </aside>
  );
};
