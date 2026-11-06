import React, { useState } from 'react';
import { Family, UserProfile, AppNotification } from '../../types';
import { storage } from '../../services/storage';
import { PWAInstallButton } from './PWAInstallButton';
import { 
  Bell, 
  ChevronDown, 
  Plus, 
  LogOut, 
  Globe, 
  Check, 
  CheckCheck, 
  User, 
  Settings, 
  ExternalLink,
  Sparkles
} from 'lucide-react';

interface HeaderProps {
  family: Family;
  families: Family[];
  currentUser: UserProfile;
  notifications: AppNotification[];
  currentTab: string;
  onNavigate: (tab: string) => void;
  onSwitchFamily: (familyId: string) => void;
  onCreateNewFamily: () => void;
  onSignOut: () => void;
  onViewPublicSite: () => void;
  onRefreshNotifications: () => void;
  onOpenAssistant?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  family,
  families,
  currentUser,
  notifications,
  currentTab,
  onNavigate,
  onSwitchFamily,
  onCreateNewFamily,
  onSignOut,
  onViewPublicSite,
  onRefreshNotifications,
  onOpenAssistant,
}) => {
  const [isFamilyMenuOpen, setIsFamilyMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const currentRole = storage.getUserRoleInFamily(currentUser.id, family.id);
  const isAdminUser = currentRole === 'admin';

  const handleMarkAllRead = () => {
    storage.markAllNotificationsAsRead();
    onRefreshNotifications();
  };

  const handleNotificationClick = (notif: AppNotification) => {
    storage.markNotificationAsRead(notif.id);
    onRefreshNotifications();
    setIsNotifOpen(false);
    if (notif.link_tab) {
      onNavigate(notif.link_tab);
    }
  };

  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-stone-200 px-3 sm:px-5 flex items-center justify-between gap-3 min-w-0">
      {/* Left: Brand / Family Switcher Context */}
      <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
        <div className="relative">
          <button
            onClick={() => setIsFamilyMenuOpen(!isFamilyMenuOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-stone-200 hover:border-emerald-700/50 bg-stone-50 hover:bg-stone-100 transition-all text-left"
          >
            <div className="w-5 h-5 rounded-md bg-emerald-800 text-white flex items-center justify-center text-[10px] font-bold">
              T
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-stone-900 block truncate max-w-[140px] sm:max-w-[200px]">
                {family.name}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          </button>

          {/* Family Switcher Dropdown */}
          {isFamilyMenuOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-64 bg-white border border-stone-200 rounded-2xl shadow-xl p-2 z-50 text-xs">
              <span className="text-[10px] uppercase font-bold text-stone-400 px-2 py-1 block">
                Your Family Workspaces
              </span>
              <div className="space-y-1 my-1">
                {families.map(f => (
                  <button
                    key={f.id}
                    onClick={() => {
                      onSwitchFamily(f.id);
                      setIsFamilyMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between transition-colors ${
                      f.id === family.id
                        ? 'bg-emerald-50 text-emerald-950 font-semibold'
                        : 'hover:bg-stone-50 text-stone-700'
                    }`}
                  >
                    <span className="truncate">{f.name}</span>
                    {f.id === family.id && <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0" />}
                  </button>
                ))}
              </div>

              <div className="pt-1.5 border-t border-stone-100">
                <button
                  onClick={() => {
                    setIsFamilyMenuOpen(false);
                    onCreateNewFamily();
                  }}
                  className="w-full text-left px-2.5 py-1.5 text-emerald-800 hover:bg-emerald-50 rounded-lg font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create New Family Tree...
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Notifications, Role Preview Badge, Profile */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* In-app PWA Install Button */}
        <PWAInstallButton />

        {/* AI Heritage Assistant Button */}
        {onOpenAssistant && (
          <button
            onClick={onOpenAssistant}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-300/80 bg-emerald-50/70 hover:bg-emerald-100/80 text-emerald-950 text-xs font-semibold transition-all whitespace-nowrap shrink-0 shadow-2xs"
            title="Ask anything about family relationships or history"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-800" />
            <span className="hidden sm:inline">Ask Assistant</span>
          </button>
        )}

        {/* Role indicator badge */}
        <div className="hidden lg:flex items-center gap-1 px-2.5 py-1 bg-stone-100 rounded-lg text-[11px] text-stone-600 border border-stone-200">
          <span className="text-stone-400">Role:</span>
          <span className={`font-semibold capitalize ${isAdminUser ? 'text-emerald-900' : 'text-stone-700'}`}>
            {isAdminUser ? 'Admin' : 'Viewer'}
          </span>
        </div>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="relative p-2 rounded-xl hover:bg-stone-100 text-stone-600 hover:text-stone-900 transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-800 text-white text-[9px] font-bold flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {isNotifOpen && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
              <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
                <span className="font-bold text-stone-900">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-emerald-800 hover:underline flex items-center gap-1 font-medium"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-stone-100">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-stone-400">
                    No new notifications.
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-3.5 hover:bg-stone-50 cursor-pointer transition-colors ${
                        !notif.is_read ? 'bg-emerald-50/40' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-stone-900 leading-tight">
                          {notif.title}
                        </p>
                        {!notif.is_read && (
                          <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-stone-600 text-[11px] mt-1 line-clamp-2">
                        {notif.message}
                      </p>
                      <span className="text-[10px] text-stone-400 tabular-nums block mt-1">
                        {notif.created_at.substring(0, 10)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 p-1 pl-2 rounded-xl hover:bg-stone-100 transition-colors"
          >
            <span className="text-xs font-semibold text-stone-800 hidden md:inline truncate max-w-[120px]">
              {currentUser.display_name}
            </span>
            <div className="w-8 h-8 rounded-full bg-emerald-800 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {currentUser.display_name[0].toUpperCase()}
            </div>
          </button>

          {isUserMenuOpen && (
            <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-stone-200 rounded-2xl shadow-xl p-2 z-50 text-xs">
              <div className="px-3 py-2 border-b border-stone-100 mb-1">
                <p className="font-bold text-stone-900 truncate">{currentUser.display_name}</p>
                <p className="text-[11px] text-stone-400 truncate">{currentUser.email}</p>
                <span className={`inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                  isAdminUser ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'
                }`}>
                  {isAdminUser ? 'Admin' : 'Viewer'}
                </span>
              </div>

              {isAdminUser && (
                <button
                  onClick={() => { onNavigate('user-management'); setIsUserMenuOpen(false); }}
                  className="w-full text-left px-3 py-2 hover:bg-stone-50 rounded-xl text-stone-700 flex items-center gap-2 transition-colors"
                >
                  <User className="w-3.5 h-3.5 text-stone-400" />
                  User Management
                </button>
              )}

              <button
                onClick={() => { onNavigate('settings'); setIsUserMenuOpen(false); }}
                className="w-full text-left px-3 py-2 hover:bg-stone-50 rounded-xl text-stone-700 flex items-center gap-2 transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-stone-400" />
                {isAdminUser ? 'Workspace Settings' : 'Settings'}
              </button>

              <button
                onClick={() => { onViewPublicSite(); setIsUserMenuOpen(false); }}
                className="w-full text-left px-3 py-2 hover:bg-stone-50 rounded-xl text-stone-700 flex items-center gap-2 transition-colors"
              >
                <Globe className="w-3.5 h-3.5 text-stone-400" />
                View Public Landing
              </button>

              <div className="pt-1 border-t border-stone-100 mt-1">
                <button
                  onClick={() => { setIsUserMenuOpen(false); onSignOut(); }}
                  className="w-full text-left px-3 py-2 hover:bg-rose-50 text-rose-700 rounded-xl flex items-center gap-2 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
