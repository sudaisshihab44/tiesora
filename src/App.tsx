import React, { useState, useEffect, useCallback } from 'react';
import { storage } from './services/storage';
import { getSessionUser, onAuthStateChange, signOut } from './services/auth';
import { isSupabaseConfigured } from './services/supabase';
import { 
  Family, 
  FamilyPerson, 
  Relationship, 
  Memory, 
  FamilyEvent, 
  FamilyMembership, 
  ChangeRequest, 
  AppNotification, 
  AuditLog, 
  UserProfile 
} from './types';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { MobileNav } from './components/common/MobileNav';
import { Dashboard } from './components/dashboard/Dashboard';
import { FamilyTreeCanvas } from './components/tree/FamilyTreeCanvas';
import { AddRelativeDialog } from './components/tree/AddRelativeDialog';
import { PersonProfileDrawer } from './components/profile/PersonProfileDrawer';
import { RelationshipExplorer } from './components/relationships/RelationshipExplorer';
import { MemoriesPage } from './components/memories/MemoriesPage';
import { EventsPage } from './components/events/EventsPage';
import { CollaborationPage } from './components/collaboration/CollaborationPage';
import { SettingsPage } from './components/settings/SettingsPage';
import { LandingPage } from './components/landing/LandingPage';
import { AuthModal } from './components/auth/AuthModal';
import { OnboardingWizard } from './components/auth/OnboardingWizard';
import { FamilyAssistantModal } from './components/ai/FamilyAssistantModal';

export default function App() {
  // ── Auth & View States ──────────────────────────────────────────────────────
  // In demo mode (no Supabase), start on the landing page so the user can
  // choose to sign in or explore the demo. When Supabase is configured, check
  // for an existing session before showing the landing page.
  const [isPublicView, setIsPublicView] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('tree');

  // Modals & Drawers
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<FamilyPerson | null>(null);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);

  const [addRelativeState, setAddRelativeState] = useState<{
    isOpen: boolean;
    targetPerson?: FamilyPerson;
    editPerson?: FamilyPerson;
  }>({ isOpen: false });

  const [relExplorerPair, setRelExplorerPair] = useState<{ aId?: string; bId?: string }>({});

  // ── Data State (from storage adapter) ───────────────────────────────────────
  const [families, setFamilies] = useState<Family[]>([]);
  const [currentFamily, setCurrentFamily] = useState<Family>(storage.getCurrentFamily());
  const [people, setPeople] = useState<FamilyPerson[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [memberships, setMemberships] = useState<FamilyMembership[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // ── Refresh all state from storage ──────────────────────────────────────────
  const refreshAll = useCallback(() => {
    const user = storage.getCurrentUser();
    const fams = storage.getFamilies();
    const currFam = storage.getCurrentFamily();
    setCurrentUser(user);
    setFamilies(fams);
    setCurrentFamily(currFam);
    setPeople(storage.getPeople(currFam.id));
    setRelationships(storage.getRelationships(currFam.id));
    setMemories(storage.getMemories(currFam.id));
    setEvents(storage.getEvents(currFam.id));
    setMemberships(storage.getMemberships(currFam.id));
    setChangeRequests(storage.getChangeRequests(currFam.id));
    setNotifications(storage.getNotifications(user.id));
    setAuditLogs(storage.getAuditLogs(currFam.id));
  }, []);

  // ── Boot: check for existing session ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      const sessionUser = await getSessionUser();
      if (cancelled) return;

      if (sessionUser) {
        // Existing session found — enter the app
        storage.updateCurrentUser(sessionUser);
        setIsPublicView(false);
        refreshAll();
      }
      // else: stay on landing page (isPublicView stays true)
      setAuthChecked(true);
    }

    checkSession();

    // Subscribe to auth state changes (Supabase mode)
    const unsubAuth = onAuthStateChange((user) => {
      if (cancelled) return;
      if (user) {
        setIsPublicView(false);
        refreshAll();
      } else {
        // Signed out
        setIsPublicView(true);
        setCurrentUser(null);
      }
    });

    return () => { cancelled = true; unsubAuth(); };
  }, [refreshAll]);

  // ── Subscribe to storage changes ───────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = storage.subscribe(() => refreshAll());
    return unsubscribe;
  }, [refreshAll]);

  // ── Parse invite token from URL hash ────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    const inviteMatch = hash.match(/invite=([^&]+)/);
    if (inviteMatch) {
      // An invite link was opened — show auth modal so user can sign in/up
      // The token will be validated server-side when Supabase is configured.
      setIsAuthModalOpen(true);
      // Clear the hash so it doesn't re-trigger
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSelectPerson = (person: FamilyPerson) => {
    setSelectedPerson(person);
    setIsProfileDrawerOpen(true);
  };

  const handleExploreRelationship = (person: FamilyPerson) => {
    const myPerson = people.find(p => p.full_name.includes(currentUser?.display_name.split(' ')[0] ?? '')) || people[0];
    setRelExplorerPair({
      aId: myPerson?.id !== person.id ? myPerson?.id : people.find(p => p.id !== person.id)?.id,
      bId: person.id,
    });
    setIsProfileDrawerOpen(false);
    setCurrentTab('relationships');
  };

  const handleJumpToTreeWithHighlight = (pathNodeIds: string[]) => {
    setCurrentTab('tree');
    const firstNode = people.find(p => p.id === pathNodeIds[0]);
    if (firstNode) setSelectedPerson(firstNode);
  };

  const handleSwitchFamily = (familyId: string) => {
    storage.setCurrentFamilyId(familyId);
    refreshAll();
  };

  const handleSignOut = async () => {
    await signOut();
    setIsPublicView(true);
    setCurrentUser(null);
    // In demo mode, storage keeps the user — reset to landing is enough
  };

  // ── Loading state while checking session ─────────────────────────────────────
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Public / Landing view ────────────────────────────────────────────────────
  if (isPublicView || !currentUser) {
    return (
      <>
        <LandingPage
          onStartBuilding={() => {
            setIsOnboardingOpen(true);
            setIsPublicView(false);
          }}
          onExploreDemo={() => {
            // Demo mode: load sample data and enter app directly
            storage.resetToSampleData();
            refreshAll();
            setIsPublicView(false);
          }}
          onSignIn={() => setIsAuthModalOpen(true)}
        />
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={(user) => {
            storage.updateCurrentUser(user);
            setCurrentUser(user);
            setIsPublicView(false);
            refreshAll();
          }}
          onStartOnboarding={() => {
            setIsAuthModalOpen(false);
            setIsOnboardingOpen(true);
          }}
        />
        <OnboardingWizard
          isOpen={isOnboardingOpen}
          onClose={() => setIsOnboardingOpen(false)}
          onComplete={() => {
            refreshAll();
            setIsPublicView(false);
            setCurrentTab('tree');
          }}
        />
      </>
    );
  }

  // ── Authenticated App Shell ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col font-sans text-stone-900 antialiased overflow-x-hidden">
      <Header
        family={currentFamily}
        families={families}
        currentUser={currentUser}
        notifications={notifications}
        currentTab={currentTab}
        onNavigate={setCurrentTab}
        onSwitchFamily={handleSwitchFamily}
        onCreateNewFamily={() => setIsOnboardingOpen(true)}
        onSignOut={handleSignOut}
        onViewPublicSite={() => setIsPublicView(true)}
        onRefreshNotifications={refreshAll}
        onOpenAssistant={() => setIsAssistantOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentTab={currentTab}
          onNavigate={setCurrentTab}
          onViewPublicSite={() => setIsPublicView(true)}
          unreadCount={notifications.filter(n => !n.is_read).length}
        />

        <main className="flex-1 overflow-y-auto pb-16 md:pb-0 relative bg-stone-50">
          {currentTab === 'dashboard' && (
            <Dashboard
              family={currentFamily}
              people={people}
              relationships={relationships}
              memories={memories}
              events={events}
              changeRequests={changeRequests}
              auditLogs={auditLogs}
              onNavigate={setCurrentTab}
              onSelectPerson={handleSelectPerson}
              onAddRelative={(p) => setAddRelativeState({ isOpen: true, targetPerson: p })}
              onUploadMemory={() => setCurrentTab('memories')}
              onInviteRelative={() => setCurrentTab('collaboration')}
            />
          )}

          {currentTab === 'tree' && (
            <FamilyTreeCanvas
              people={people}
              relationships={relationships}
              selectedPerson={selectedPerson || undefined}
              onSelectPerson={handleSelectPerson}
              onAddRelative={(p) => setAddRelativeState({ isOpen: true, targetPerson: p })}
              onExploreRelationship={handleExploreRelationship}
              onEditPerson={(p) => setAddRelativeState({ isOpen: true, editPerson: p })}
            />
          )}

          {currentTab === 'relationships' && (
            <RelationshipExplorer
              people={people}
              relationships={relationships}
              initialPersonAId={relExplorerPair.aId}
              initialPersonBId={relExplorerPair.bId}
              onSelectPerson={handleSelectPerson}
              onJumpToTreeWithHighlight={handleJumpToTreeWithHighlight}
            />
          )}

          {currentTab === 'memories' && (
            <MemoriesPage
              memories={memories}
              people={people}
              onSelectPerson={handleSelectPerson}
              onRefreshMemories={refreshAll}
            />
          )}

          {currentTab === 'events' && (
            <EventsPage
              events={events}
              people={people}
              onSelectPerson={handleSelectPerson}
              onRefreshEvents={refreshAll}
            />
          )}

          {currentTab === 'collaboration' && (
            <CollaborationPage
              family={currentFamily}
              memberships={memberships}
              changeRequests={changeRequests}
              auditLogs={auditLogs}
              onRefresh={refreshAll}
            />
          )}

          {currentTab === 'settings' && (
            <SettingsPage
              family={currentFamily}
              onRefresh={refreshAll}
            />
          )}
        </main>
      </div>

      <MobileNav
        currentTab={currentTab}
        onNavigate={setCurrentTab}
        onViewPublicSite={() => setIsPublicView(true)}
      />

      <PersonProfileDrawer
        person={selectedPerson}
        isOpen={isProfileDrawerOpen}
        onClose={() => setIsProfileDrawerOpen(false)}
        people={people}
        relationships={relationships}
        memories={memories}
        onSelectPerson={handleSelectPerson}
        onEditPerson={(p) => setAddRelativeState({ isOpen: true, editPerson: p })}
        onAddRelative={(p) => setAddRelativeState({ isOpen: true, targetPerson: p })}
        onExploreRelationship={handleExploreRelationship}
        onDeletePerson={(id) => {
          storage.deletePerson(id);
          refreshAll();
          setSelectedPerson(null);
        }}
        onDeleteRelationship={(relId) => {
          storage.deleteRelationship(relId);
          refreshAll();
        }}
      />

      <AddRelativeDialog
        isOpen={addRelativeState.isOpen}
        targetPerson={addRelativeState.targetPerson}
        editPerson={addRelativeState.editPerson}
        people={people}
        onClose={() => setAddRelativeState({ isOpen: false })}
        onSaved={(person) => {
          refreshAll();
          setSelectedPerson(person);
        }}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={(user) => {
          storage.updateCurrentUser(user);
          setCurrentUser(user);
          refreshAll();
        }}
        onStartOnboarding={() => setIsOnboardingOpen(true)}
      />

      <OnboardingWizard
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onComplete={() => {
          refreshAll();
          setCurrentTab('tree');
        }}
      />

      <FamilyAssistantModal
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        people={people}
        relationships={relationships}
        memories={memories}
        events={events}
        family={currentFamily}
        onSelectPerson={handleSelectPerson}
        onExploreRelationship={handleExploreRelationship}
        onNavigate={setCurrentTab}
      />
    </div>
  );
}
