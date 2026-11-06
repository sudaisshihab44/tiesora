import React, { useState } from 'react';
import {
  LayoutDashboard,
  GitFork,
  Compass,
  Camera,
  Menu,
  Calendar,
  Shield,
  Settings,
  X,
  Globe,
  Users,
} from 'lucide-react';
import { Role } from '../../types';

interface MobileNavProps {
  currentTab: string;
  currentRole: Role;
  onNavigate: (tab: string) => void;
  onViewPublicSite: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  currentTab,
  currentRole,
  onNavigate,
  onViewPublicSite,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const isAdmin = currentRole === 'admin';

  const mainItems = [
    { id: 'dashboard',     label: 'Home',      icon: LayoutDashboard },
    { id: 'tree',          label: 'Tree',       icon: GitFork },
    { id: 'relationships', label: 'Relations',  icon: Compass },
    { id: 'memories',      label: 'Memories',   icon: Camera },
  ];

  const handleSelectTab = (tab: string) => {
    onNavigate(tab);
    setIsMoreOpen(false);
  };

  const adminTabsInMore = ['events', 'user-management', 'collaboration', 'settings'];
  const viewerTabsInMore = ['events'];
  const moreTabIds = isAdmin ? adminTabsInMore : viewerTabsInMore;

  return (
    <>
      {/* Bottom Sticky Navigation */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200 px-1 pt-1 pb-safe flex items-center justify-around"
        style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
      >
        {mainItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelectTab(item.id)}
              className={`flex flex-col items-center justify-center py-2 px-3 min-h-[44px] rounded-xl text-[10px] font-semibold transition-colors ${
                isActive ? 'text-emerald-900 font-bold' : 'text-stone-500 hover:text-stone-900'
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-emerald-800' : 'text-stone-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* More Button */}
        <button
          onClick={() => setIsMoreOpen(true)}
          className={`flex flex-col items-center justify-center py-2 px-3 min-h-[44px] rounded-xl text-[10px] font-semibold transition-colors ${
            moreTabIds.includes(currentTab) ? 'text-emerald-900 font-bold' : 'text-stone-500 hover:text-stone-900'
          }`}
        >
          <Menu className="w-5 h-5 mb-0.5 text-stone-400" />
          <span>More</span>
        </button>
      </nav>

      {/* More Drawer */}
      {isMoreOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-xs flex flex-col justify-end">
          <div className="bg-white rounded-t-3xl border-t border-stone-200 p-6 space-y-4 animate-in slide-in-from-bottom duration-150">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <span className="font-bold text-stone-900 text-sm">More Family Tools</span>
              <button onClick={() => setIsMoreOpen(false)} className="p-1.5 text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1 text-xs">
              <button
                onClick={() => handleSelectTab('events')}
                className="w-full text-left p-3 rounded-xl hover:bg-stone-50 flex items-center gap-3 text-stone-700 font-medium"
              >
                <Calendar className="w-4 h-4 text-emerald-800" />
                <span>Events &amp; Milestones</span>
              </button>

              {isAdmin && (
                <>
                  <button
                    onClick={() => handleSelectTab('user-management')}
                    className="w-full text-left p-3 rounded-xl hover:bg-stone-50 flex items-center gap-3 text-stone-700 font-medium"
                  >
                    <Users className="w-4 h-4 text-emerald-800" />
                    <span>User Management</span>
                  </button>

                  <button
                    onClick={() => handleSelectTab('collaboration')}
                    className="w-full text-left p-3 rounded-xl hover:bg-stone-50 flex items-center gap-3 text-stone-700 font-medium"
                  >
                    <Shield className="w-4 h-4 text-emerald-800" />
                    <span>Collaboration &amp; Audit</span>
                  </button>

                  <button
                    onClick={() => handleSelectTab('settings')}
                    className="w-full text-left p-3 rounded-xl hover:bg-stone-50 flex items-center gap-3 text-stone-700 font-medium"
                  >
                    <Settings className="w-4 h-4 text-emerald-800" />
                    <span>Family Settings</span>
                  </button>
                </>
              )}

              <button
                onClick={() => { onViewPublicSite(); setIsMoreOpen(false); }}
                className="w-full text-left p-3 rounded-xl hover:bg-stone-50 flex items-center gap-3 text-stone-700 font-medium"
              >
                <Globe className="w-4 h-4 text-stone-400" />
                <span>View Public Landing Page</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
