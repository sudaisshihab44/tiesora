import React, { useState, useEffect, useCallback, useRef } from 'react';
import { storage } from './services/storage';
import { getSessionUser, onAuthStateChange, signOut, getRoleFromDB } from './services/auth';
import { isSupabaseConfigured } from './services/supabase';
import * as db from './services/db';
import { deletePersonAction, deleteRelationshipAction } from './services/dataActions';
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
  UserProfile,
  AuthView,
  Role,
  normalizeRole,
} from './types';

// Layout
import { Header }    from './components/common/Header';
import { Sidebar }   from './components/common/Sidebar';
import { MobileNav } from './components/common/MobileNav';

// App pages
import { Dashboard }            from './components/dashboard/Dashboard';
import { ViewerDashboard }      from './components/dashboard/ViewerDashboard';
import { FamilyTreeCanvas }     from './components/tree/FamilyTreeCanvas';
import { AddRelativeDialog }    from './components/tree/AddRelativeDialog';
import { PersonProfileDrawer }  from './components/profile/PersonProfileDrawer';
import { RelationshipExplorer } from './components/relationships/RelationshipExplorer';
import { MemoriesPage }         from './components/memories/MemoriesPage';
import { EventsPage }           from './components/events/EventsPage';
import { CollaborationPage }    from './components/collaboration/CollaborationPage';
import { SettingsPage }         from './components/settings/SettingsPage';
import { UserManagementPage }   from './components/admin/UserManagementPage';
import { FamilyAssistantModal } from './components/ai/FamilyAssistantModal';

// Auth & onboarding pages
import { LandingPage }          from './components/landing/LandingPage';
import { SignInPage }           from './components/auth/SignInPage';
import { SignUpPage }           from './components/auth/SignUpPage';
import { VerifyEmailPage }      from './components/auth/VerifyEmailPage';
import { ResetPasswordPage }    from './components/auth/ResetPasswordPage';
import { OnboardingChoicePage } from './components/auth/OnboardingChoicePage';
import { OnboardingWizard }     from './components/auth/OnboardingWizard';
import { JoinFamilyPage }       from './components/auth/JoinFamilyPage';

// ── Admin-only tabs ────────────────────────────────────────────────────────────
const ADMIN_ONLY_TABS = ['user-management', 'collaboration', 'settings'] as const;

export default function App() {
  // ── Auth & routing ──────────────────────────────────────────────────────────
  const [authView,     setAuthView]     = useState<AuthView>('landing');
  const [authChecked,  setAuthChecked]  = useState(false);
  const [currentUser,  setCurrentUser]  = useState<UserProfile | null>(null);
  const [pendingEmail, setPendingEmail] = useState('');
  // Token from URL hash for invitation deep-links
  const [inviteToken,  setInviteToken]  = useState('');

  /**
   * verifiedRole — the ONLY role the rest of the app trusts.
   * Set only from DB-verified sources, never from URL/localStorage/form fields.
   */
  const [verifiedRole,     setVerifiedRole]     = useState<Role>('viewer');
  const [verifiedFamilyId, setVerifiedFamilyId] = useState<string>('');

  /**
   * Prevents onAuthStateChange INITIAL_SESSION from racing with checkSession().
   */
  const roleCheckInProgress = useRef(false);

  const [currentTab,       setCurrentTab]       = useState<string>('dashboard');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isAssistantOpen,  setIsAssistantOpen]  = useState(false);

  // Person / tree drawers
  const [selectedPerson,      setSelectedPerson]      = useState<FamilyPerson | null>(null);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [addRelativeState, setAddRelativeState] = useState<{
    isOpen: boolean; targetPerson?: FamilyPerson; editPerson?: FamilyPerson;
  }>({ isOpen: false });
  const [relExplorerPair, setRelExplorerPair] = useState<{ aId?: string; bId?: string }>({});

  // ── Data state ────────────────────────────────────────────────────────────
  const [families,       setFamilies]       = useState<Family[]>([]);
  const [currentFamily,  setCurrentFamily]  = useState<Family>(storage.getCurrentFamily());
  const [people,         setPeople]         = useState<FamilyPerson[]>([]);
  const [relationships,  setRelationships]  = useState<Relationship[]>([]);
  const [memories,       setMemories]       = useState<Memory[]>([]);
  const [events,         setEvents]         = useState<FamilyEvent[]>([]);
  const [memberships,    setMemberships]    = useState<FamilyMembership[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [notifications,  setNotifications]  = useState<AppNotification[]>([]);
  const [auditLogs,      setAuditLogs]      = useState<AuditLog[]>([]);

  // Data-loading state for the Supabase-backed mode. Demo mode loads
  // synchronously from localStorage.
  const [dataLoading, setDataLoading] = useState(false);
  const [dataLoaded,  setDataLoaded]  = useState(false);
  const [dataError,   setDataError]   = useState<string | null>(null);

  const refreshAll = useCallback(async () => {
    const user = storage.getCurrentUser();
    setCurrentUser(user);

    // ── Demo / offline mode ────────────────────────────────────────────────
    if (!isSupabaseConfigured) {
      const fams = storage.getFamilies();
      const currFam = storage.getCurrentFamily();
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
      setDataError(null);
      setDataLoaded(true);
      return;
    }

    // ── Supabase source of truth ──────────────────────────────────────────
    if (!user?.id) {
      setDataLoaded(true);
      return;
    }

    setDataLoading(true);
    setDataError(null);

    try {
      const fams = await db.listFamilies();
      const storedId = storage.getCurrentFamilyId();
      const active = fams.find((f) => f.id === storedId) ?? fams[0];

      if (!active) {
        setFamilies([]);
        setPeople([]);
        setRelationships([]);
        setMemories([]);
        setEvents([]);
        setMemberships([]);
        setChangeRequests([]);
        setNotifications([]);
        setAuditLogs([]);
        setDataLoaded(true);
        return;
      }

      if (storedId !== active.id) storage.setCurrentFamilyId(active.id);

      const [
        people,
        relationships,
        memories,
        events,
        memberships,
        changeRequests,
        notifications,
        auditLogs,
        myMemberships,
      ] = await Promise.all([
        db.listPeople(active.id),
        db.listRelationships(active.id),
        db.listMemories(active.id),
        db.listEvents(active.id),
        db.listMemberships(active.id),
        db.listChangeRequests(active.id),
        db.listNotifications(user.id),
        db.listAuditLogs(active.id),
        db.getMyMemberships(user.id),
      ]);

      setFamilies(fams);
      setCurrentFamily(active);
      setPeople(people);
      setRelationships(relationships);
      setMemories(memories);
      setEvents(events);
      setMemberships(memberships);
      setChangeRequests(changeRequests);
      setNotifications(notifications);
      setAuditLogs(auditLogs);

      const membership = myMemberships.find((m) => m.family_id === active.id);
      setVerifiedRole(membership?.role ?? 'viewer');
      setVerifiedFamilyId(active.id);
      setDataLoaded(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[App] Failed to load Supabase data:', error);
      setDataError(message);
    } finally {
      setDataLoading(false);
    }
  }, []);

  const applyVerifiedRole = useCallback((role: Role, familyId: string) => {
    setVerifiedRole(role);
    setVerifiedFamilyId(familyId);
    if (familyId) storage.setCurrentFamilyId(familyId);
  }, []);

  // ── Re-verify role from DB and enter app ─────────────────────────────────
  const enterApp = useCallback(async (user: UserProfile) => {
    storage.updateCurrentUser(user);
    setCurrentUser(user);

    if (!isSupabaseConfigured) {
      const dbRole = await getRoleFromDB(user.id);
      if (dbRole) {
        applyVerifiedRole(dbRole.role, dbRole.familyId);
      } else {
        const fam = storage.getCurrentFamily();
        applyVerifiedRole('viewer', fam.id);
      }
    }

    // Supabase mode: refreshAll selects the stored family (which onboarding
    // just set) and derives the role from its membership. This avoids the
    // "first membership wins" problem when a user belongs to several families.
    await refreshAll();
    setAuthView('app');
    setCurrentTab('dashboard');
  }, [applyVerifiedRole, refreshAll]);

  // ── Boot: check URL hash then existing session ────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const hash = window.location.hash;

    // Password-reset redirect
    const isResetHash =
      hash.includes('type=recovery') ||
      hash.startsWith('#reset-password') ||
      (hash.includes('access_token') && hash.includes('type=recovery'));

    // Invitation deep-link
    const inviteMatch = hash.match(/[#&]invite=([^&]+)/);

    if (isResetHash) {
      setAuthView('reset-password');
      setAuthChecked(true);
      return;
    }

    if (inviteMatch) {
      window.history.replaceState(null, '', window.location.pathname);
      setInviteToken(inviteMatch[1]);
      // If already signed in, go to join-family. Otherwise sign up first.
      // checkSession() below will handle the signed-in case.
    }

    async function checkSession() {
      roleCheckInProgress.current = true;
      const sessionUser = await getSessionUser();
      if (cancelled) { roleCheckInProgress.current = false; return; }

      if (sessionUser) {
        storage.updateCurrentUser(sessionUser);
        setCurrentUser(sessionUser);

        const dbRole = await getRoleFromDB(sessionUser.id);
        if (!cancelled) {
          if (dbRole) {
            applyVerifiedRole(dbRole.role, dbRole.familyId);
            // If there's a pending invite, let them join a second family
            if (inviteMatch) {
              setInviteToken(inviteMatch[1]);
              setAuthView('join-family');
            } else {
              void refreshAll();
              setAuthView('app');
            }
          } else {
            // Authenticated but no family yet — send to onboarding choice
            // Handle pending invite token if present
            if (inviteMatch) {
              setInviteToken(inviteMatch[1]);
              setAuthView('join-family');
            } else {
              setAuthView('onboarding-choice');
            }
          }
        }
      }
      if (!cancelled) setAuthChecked(true);
      roleCheckInProgress.current = false;
    }

    checkSession();

    const unsubAuth = onAuthStateChange(async (user, event) => {
      if (cancelled) return;

      if (event === 'PASSWORD_RECOVERY') {
        setAuthView('reset-password');
        return;
      }

      if (event === 'INITIAL_SESSION' && roleCheckInProgress.current) return;

      if (user) {
        storage.updateCurrentUser(user);
        setCurrentUser(user);
        const dbRole = await getRoleFromDB(user.id);
        if (!cancelled) {
          if (dbRole) {
            applyVerifiedRole(dbRole.role, dbRole.familyId);
            setAuthView(v => v === 'reset-password' ? v : 'app');
            void refreshAll();
          } else {
            // New user who just confirmed their email — send to onboarding
            setAuthView('onboarding-choice');
          }
        }
      } else {
        setAuthView('landing');
        setCurrentUser(null);
        setVerifiedRole('viewer');
        setVerifiedFamilyId('');
      }
    });

    return () => { cancelled = true; unsubAuth(); };
  }, [refreshAll, applyVerifiedRole, enterApp]);

  // Demo mode only: localStorage is the source of truth there.
  useEffect(() => {
    if (isSupabaseConfigured) return;
    const unsub = storage.subscribe(() => {
      void refreshAll();
    });
    return unsub;
  }, [refreshAll]);

  // Entering the app (or changing the signed-in user) loads Supabase data.
  useEffect(() => {
    if (authView === 'app' && currentUser) {
      void refreshAll();
    }
  }, [authView, currentUser?.id, refreshAll]);

  // ── Tab resolution — redirect viewers off admin-only tabs ─────────────────
  const resolvedTab = (() => {
    if (verifiedRole !== 'admin' && ADMIN_ONLY_TABS.includes(currentTab as any)) {
      return 'dashboard';
    }
    return currentTab;
  })();
  const isAdmin = verifiedRole === 'admin';

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSelectPerson = (person: FamilyPerson) => {
    setSelectedPerson(person);
    setIsProfileDrawerOpen(true);
  };

  const handleExploreRelationship = (person: FamilyPerson) => {
    const myPerson =
      people.find(p => p.full_name.includes(currentUser?.display_name.split(' ')[0] ?? '')) ||
      people[0];
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

  const handleSwitchFamily = async (familyId: string) => {
    storage.setCurrentFamilyId(familyId);

    if (!isSupabaseConfigured && currentUser) {
      const role = normalizeRole(
        storage.getUserRoleInFamily(currentUser.id, familyId),
      );
      applyVerifiedRole(role, familyId);
    } else if (currentUser) {
      const membership = await db.getMembershipForFamily(
        currentUser.id,
        familyId,
      );
      applyVerifiedRole(membership?.role ?? 'viewer', familyId);
    }

    await refreshAll();
  };

  const handleSignOut = async () => {
    await signOut();
    setAuthView('landing');
    setCurrentUser(null);
    setVerifiedRole('viewer');
    setVerifiedFamilyId('');
    setInviteToken('');
    setDataLoaded(false);
    setDataError(null);
  };

  // ── Loading spinner ───────────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STANDALONE AUTH VIEWS
  // ══════════════════════════════════════════════════════════════════════════

  if (authView === 'landing') {
    return (
      <LandingPage
        onStartBuilding={() => setAuthView('signup')}
        onExploreDemo={() => {
          storage.resetToSampleData();
          void refreshAll();
          const fam  = storage.getCurrentFamily();
          const user = storage.getCurrentUser();
          const role = normalizeRole(storage.getUserRoleInFamily(user.id, fam.id));
          applyVerifiedRole(role, fam.id);
          setAuthView('app');
        }}
        onSignIn={() => setAuthView('signin')}
        onSignUp={() => setAuthView('signup')}
        demoEnabled={!isSupabaseConfigured}
      />
    );
  }

  if (authView === 'signin') {
    return (
      <>
        <SignInPage
          onSuccess={(user, role, familyId) => {
            storage.updateCurrentUser(user);
            setCurrentUser(user);
            applyVerifiedRole(role, familyId);
            void refreshAll();
            setAuthView('app');
            setCurrentTab('dashboard');
          }}
          onNeedOnboarding={(user) => {
            // Authenticated user with no family — choose Create or Join
            storage.updateCurrentUser(user);
            setCurrentUser(user);
            setAuthView('onboarding-choice');
          }}
          onGoSignUp={() => setAuthView('signup')}
          onGoLanding={() => setAuthView('landing')}
        />
        {/* Onboarding wizard accessible from sign-in context too */}
        <OnboardingWizard
          isOpen={isOnboardingOpen}
          onClose={() => setIsOnboardingOpen(false)}
          onComplete={async () => {
            if (currentUser) await enterApp(currentUser);
          }}
        />
      </>
    );
  }

  if (authView === 'signup') {
    return (
      <SignUpPage
        onSuccess={(user, needsConfirmation) => {
          storage.updateCurrentUser(user);
          setCurrentUser(user);
          setPendingEmail(user.email);
          if (needsConfirmation) {
            // Email confirmation is ON in the Supabase Dashboard.
            // User must click the link before they can sign in.
            setAuthView('verify-email');
          } else {
            // Email confirmation is OFF (recommended for dev) — user is
            // already authenticated. Send them to choose Create/Join.
            setAuthView('onboarding-choice');
          }
        }}
        onGoSignIn={() => setAuthView('signin')}
        onGoLanding={() => setAuthView('landing')}
      />
    );
  }

  if (authView === 'verify-email') {
    return (
      <VerifyEmailPage
        email={pendingEmail}
        onGoSignIn={() => setAuthView('signin')}
        onGoLanding={() => setAuthView('landing')}
      />
    );
  }

  if (authView === 'onboarding-choice') {
    // Guard: must have a user to show choice page
    const choiceUser = currentUser ?? storage.getCurrentUser();
    return (
      <>
        <OnboardingChoicePage
          currentUser={choiceUser}
          onCreateFamily={() => setIsOnboardingOpen(true)}
          onJoinFamily={() => setAuthView('join-family')}
          onSignOut={handleSignOut}
        />
        {/* OnboardingWizard must be rendered here — it is not visible on
            any other auth branch when authView === 'onboarding-choice' */}
        <OnboardingWizard
          isOpen={isOnboardingOpen}
          onClose={() => setIsOnboardingOpen(false)}
          onComplete={async () => {
            setIsOnboardingOpen(false);
            await enterApp(choiceUser);
          }}
        />
      </>
    );
  }

  if (authView === 'join-family') {
    const joinUser = currentUser ?? storage.getCurrentUser();
    return (
      <JoinFamilyPage
        currentUser={joinUser}
        prefillToken={inviteToken}
        onSuccess={async () => {
          // Invitation accepted — re-verify role from DB and enter app
          await enterApp(joinUser);
        }}
        onBack={() => setAuthView('onboarding-choice')}
        onSignOut={handleSignOut}
      />
    );
  }

  if (authView === 'reset-password') {
    return (
      <ResetPasswordPage
        onSuccess={async () => {
          await refreshAll();
          setAuthView('app');
        }}
        onGoSignIn={() => setAuthView('signin')}
        onGoLanding={() => setAuthView('landing')}
      />
    );
  }

  // ── Guard: must be authenticated ──────────────────────────────────────────
  if (!currentUser) {
    setTimeout(() => setAuthView('signin'), 0);
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="w-8 h-8 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Supabase mode: do not render the shell with stale/sample data.
  if (authView === 'app' && isSupabaseConfigured && !dataLoaded) {
    if (dataError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 gap-4 p-6 text-center">
          <p className="text-sm font-semibold text-stone-800">
            Could not load your family data
          </p>
          <p className="text-xs text-stone-500 max-w-md break-words">
            {dataError}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => void refreshAll()}
              className="px-4 py-2 rounded-xl bg-emerald-800 text-white text-xs font-semibold"
            >
              Retry
            </button>
            <button
              onClick={handleSignOut}
              className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 text-xs font-semibold"
            >
              Sign out
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-stone-50 gap-3">
        <div className="w-8 h-8 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-stone-500">Loading your family…</p>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // AUTHENTICATED APP SHELL
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col font-sans text-stone-900 antialiased overflow-x-hidden">
      {dataError && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900 flex items-center justify-between gap-4">
          <span className="truncate">
            Could not refresh family data: {dataError}
          </span>
          <button
            onClick={() => void refreshAll()}
            className="font-semibold underline shrink-0"
          >
            Retry
          </button>
        </div>
      )}
      <Header
        family={currentFamily}
        families={families}
        currentUser={currentUser}
        currentRole={verifiedRole}
        notifications={notifications}
        currentTab={resolvedTab}
        onNavigate={setCurrentTab}
        onSwitchFamily={handleSwitchFamily}
        onCreateNewFamily={() => setIsOnboardingOpen(true)}
        onSignOut={handleSignOut}
        onViewPublicSite={() => setAuthView('landing')}
        onRefreshNotifications={refreshAll}
        onOpenAssistant={() => setIsAssistantOpen(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentTab={resolvedTab}
          currentRole={verifiedRole}
          onNavigate={setCurrentTab}
          onViewPublicSite={() => setAuthView('landing')}
          unreadCount={notifications.filter(n => !n.is_read).length}
        />

        <main className="flex-1 overflow-y-auto pb-16 md:pb-0 relative bg-stone-50">
          {/* Dashboard */}
          {resolvedTab === 'dashboard' && isAdmin && (
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
              onInviteRelative={() => setCurrentTab('user-management')}
            />
          )}
          {resolvedTab === 'dashboard' && !isAdmin && (
            <ViewerDashboard
              family={currentFamily}
              currentUser={currentUser}
              people={people}
              relationships={relationships}
              memories={memories}
              events={events}
              onNavigate={setCurrentTab}
              onSelectPerson={handleSelectPerson}
            />
          )}

          {/* Tree */}
          {resolvedTab === 'tree' && (
            <FamilyTreeCanvas
              people={people}
              relationships={relationships}
              selectedPerson={selectedPerson || undefined}
              onSelectPerson={handleSelectPerson}
              onAddRelative={isAdmin ? (p) => setAddRelativeState({ isOpen: true, targetPerson: p }) : undefined}
              onExploreRelationship={handleExploreRelationship}
              onEditPerson={isAdmin ? (p) => setAddRelativeState({ isOpen: true, editPerson: p }) : undefined}
              familyId={currentFamily.id}
              familyName={currentFamily.name}
              userIsAdmin={isAdmin}
              onRefresh={refreshAll}
            />
          )}

          {resolvedTab === 'relationships' && (
            <RelationshipExplorer
              people={people}
              relationships={relationships}
              initialPersonAId={relExplorerPair.aId}
              initialPersonBId={relExplorerPair.bId}
              onSelectPerson={handleSelectPerson}
              onJumpToTreeWithHighlight={handleJumpToTreeWithHighlight}
            />
          )}

          {resolvedTab === 'memories' && (
            <MemoriesPage
              family={currentFamily}
              currentUser={currentUser}
              canEdit={isAdmin}
              memories={memories}
              people={people}
              onSelectPerson={handleSelectPerson}
              onRefreshMemories={refreshAll}
            />
          )}

          {resolvedTab === 'events' && (
            <EventsPage
              family={currentFamily}
              currentUser={currentUser}
              canEdit={isAdmin}
              events={events}
              people={people}
              onSelectPerson={handleSelectPerson}
              onRefreshEvents={refreshAll}
            />
          )}

          {/* Admin-only tabs */}
          {resolvedTab === 'user-management' && isAdmin && (
            <UserManagementPage
              family={currentFamily}
              memberships={memberships}
              currentUser={currentUser}
              currentRole={verifiedRole}
              onRefresh={refreshAll}
            />
          )}
          {resolvedTab === 'collaboration' && isAdmin && (
            <CollaborationPage
              family={currentFamily}
              currentUser={currentUser}
              currentRole={verifiedRole}
              memberships={memberships}
              changeRequests={changeRequests}
              auditLogs={auditLogs}
              onRefresh={refreshAll}
            />
          )}
          {resolvedTab === 'settings' && isAdmin && (
            <SettingsPage
              family={currentFamily}
              people={people}
              relationships={relationships}
              memories={memories}
              events={events}
              canEdit={isAdmin}
              onRefresh={refreshAll}
            />
          )}

          {/* Access-denied fallback */}
          {!isAdmin && ADMIN_ONLY_TABS.includes(resolvedTab as any) && (
            <div className="flex flex-col items-center justify-center min-h-64 gap-3 p-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center">
                <span className="text-xl">🔒</span>
              </div>
              <p className="text-sm font-semibold text-stone-700">Admin access required</p>
              <p className="text-xs text-stone-500 max-w-xs">
                This section is restricted to family administrators.
              </p>
              <button
                onClick={() => setCurrentTab('dashboard')}
                className="text-xs text-emerald-800 font-semibold hover:underline mt-1"
              >
                Return to dashboard
              </button>
            </div>
          )}
        </main>
      </div>

      <MobileNav
        currentTab={resolvedTab}
        currentRole={verifiedRole}
        onNavigate={setCurrentTab}
        onViewPublicSite={() => setAuthView('landing')}
      />

      <PersonProfileDrawer
        person={selectedPerson}
        isOpen={isProfileDrawerOpen}
        onClose={() => setIsProfileDrawerOpen(false)}
        people={people}
        relationships={relationships}
        memories={memories}
        onSelectPerson={handleSelectPerson}
        onEditPerson={isAdmin ? (p) => setAddRelativeState({ isOpen: true, editPerson: p }) : undefined}
        onAddRelative={isAdmin ? (p) => setAddRelativeState({ isOpen: true, targetPerson: p }) : undefined}
        onExploreRelationship={handleExploreRelationship}
        onDeletePerson={isAdmin ? async (id) => {
          try {
            await deletePersonAction(id);
            await refreshAll();
            setSelectedPerson(null);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('[App] Failed to delete person:', error);
            setDataError(message);
          }
        } : undefined}
        onDeleteRelationship={isAdmin ? async (relId) => {
          try {
            await deleteRelationshipAction(relId);
            await refreshAll();
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.error('[App] Failed to delete relationship:', error);
            setDataError(message);
          }
        } : undefined}
      />

      {isAdmin && (
        <AddRelativeDialog
          isOpen={addRelativeState.isOpen}
          familyId={currentFamily.id}
          currentUser={currentUser}
          targetPerson={addRelativeState.targetPerson}
          editPerson={addRelativeState.editPerson}
          people={people}
          relationships={relationships}
          onClose={() => setAddRelativeState({ isOpen: false })}
          onSaved={(person) => { void refreshAll(); setSelectedPerson(person); }}
        />
      )}

      {/* OnboardingWizard rendered here for the app shell context (e.g. "Create new family" from header) */}
      <OnboardingWizard
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onComplete={async () => {
          // Demo mode still resolves the role from local storage. In Supabase
          // mode, refreshAll uses the family that onboarding just created.
          if (currentUser && !isSupabaseConfigured) {
            const dbRole = await getRoleFromDB(currentUser.id);
            if (dbRole) applyVerifiedRole(dbRole.role, dbRole.familyId);
          }
          await refreshAll();
          setIsOnboardingOpen(false);
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
