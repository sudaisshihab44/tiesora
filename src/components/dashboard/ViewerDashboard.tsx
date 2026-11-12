/**
 * ViewerDashboard — read-only home page for Viewer-role users.
 *
 * Security:  Zero write actions. Every onXxx callback that could mutate data
 *            is intentionally absent — not merely hidden.  The Supabase RLS
 *            policies are the definitive enforcement layer; this component
 *            simply presents an honest, uncluttered UI for the Viewer role.
 */
import React from 'react';
import {
  Family,
  FamilyPerson,
  Relationship,
  Memory,
  FamilyEvent,
  UserProfile,
} from '../../types';
import {
  GitFork,
  Compass,
  Camera,
  Calendar,
  Users,
  Layers,
  ArrowRight,
  Eye,
  Cake,
  MapPin,
  ChevronRight,
  Lock,
} from 'lucide-react';

interface ViewerDashboardProps {
  family: Family;
  currentUser: UserProfile;
  people: FamilyPerson[];
  relationships: Relationship[];
  memories: Memory[];
  events: FamilyEvent[];
  onNavigate: (tab: string) => void;
  onSelectPerson: (person: FamilyPerson) => void;
}

export const ViewerDashboard: React.FC<ViewerDashboardProps> = ({
  family,
  currentUser,
  people,
  relationships,
  memories,
  events,
  onNavigate,
  onSelectPerson,
}) => {
  const maxGen  = people.reduce((m, p) => Math.max(m, p.generation_level || 1), 1);
  const marriages = relationships.filter(r =>
    r.relationship_type === 'spouse' || r.relationship_type === 'partner'
  );
  const upcoming = people
    .filter(p => p.living_status === 'living' && p.birth_date)
    .slice(0, 4);
  const recentMemories = memories.slice(0, 4);

  // ── Quick-action cards (navigation only, no mutations) ─────────────────────
  const quickActions = [
    {
      id: 'tree',
      icon: GitFork,
      label: 'Family Tree',
      description: 'Explore the interactive tree — zoom, pan, expand branches.',
      color: 'emerald',
    },
    {
      id: 'relationships',
      icon: Compass,
      label: 'Relationship Finder',
      description: 'Discover kinship paths between any two members.',
      color: 'emerald',
    },
    {
      id: 'memories',
      icon: Camera,
      label: 'Family Memories',
      description: 'Browse heirloom photos and milestone stories.',
      color: 'emerald',
    },
    {
      id: 'events',
      icon: Calendar,
      label: 'Events & Milestones',
      description: 'View birthdays, anniversaries, reunions, and more.',
      color: 'emerald',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-5 space-y-5">

      {/* ── Read-only status bar ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-stone-100 border border-stone-200 rounded-xl text-xs text-stone-600">
        <Lock className="w-3.5 h-3.5 text-stone-400 shrink-0" />
        <span>
          You are signed in as a <strong className="text-stone-800">Viewer</strong>. This is a
          read-only view — browsing, searching, and exploring are fully available.
        </span>
        <Eye className="w-3.5 h-3.5 text-stone-400 shrink-0 ml-auto" />
      </div>

      {/* ── Welcome banner ────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#285C43] to-[#193D2D] text-white rounded-2xl p-5 sm:p-7 shadow-sm">
        <div className="relative z-10 space-y-2 max-w-2xl">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-emerald-200/90">
            Welcome back, {currentUser.display_name.split(' ')[0]}
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-tight">
            {family.name}
          </h1>
          <p className="text-xs text-emerald-100/80 leading-relaxed line-clamp-2">
            {family.description ||
              'Explore your family tree, discover relationships, and browse shared memories.'}
          </p>

          {/* Navigation CTAs — read-only */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={() => onNavigate('tree')}
              className="px-3 py-2 bg-white text-emerald-950 font-semibold rounded-lg text-xs hover:bg-emerald-50 transition-all shadow-xs flex items-center gap-1.5"
            >
              <GitFork className="w-3.5 h-3.5 text-emerald-800" />
              Open Tree
            </button>
            <button
              onClick={() => onNavigate('relationships')}
              className="px-3 py-2 bg-emerald-900/60 hover:bg-emerald-900 border border-emerald-400/30 text-white font-medium rounded-lg text-xs transition-all flex items-center gap-1.5"
            >
              <Compass className="w-3.5 h-3.5 text-emerald-200" />
              Find Relationship
            </button>
            <button
              onClick={() => onNavigate('memories')}
              className="px-3 py-2 bg-emerald-900/60 hover:bg-emerald-900 border border-emerald-400/30 text-white font-medium rounded-lg text-xs transition-all flex items-center gap-1.5"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-200" />
              Memories
            </button>
          </div>
        </div>
        <div className="absolute -right-8 -bottom-8 w-48 h-48 rounded-full bg-emerald-700/20 blur-2xl pointer-events-none" />
      </div>

      {/* ── KPI strip ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Members',     value: people.length,    sub: `${marriages.length} marriages`,    icon: Users,    tab: 'tree' },
          { label: 'Generations', value: maxGen,            sub: 'Gen I through ' + ['I','II','III','IV','V'][maxGen - 1], icon: Layers,   tab: 'tree' },
          { label: 'Memories',    value: memories.length,  sub: 'Photos & stories',                 icon: Camera,   tab: 'memories' },
          { label: 'Events',      value: events.length,    sub: 'Milestones & dates',               icon: Calendar, tab: 'events' },
        ].map(({ label, value, sub, icon: Icon, tab }) => (
          <button
            key={label}
            onClick={() => onNavigate(tab)}
            className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs hover:border-emerald-700/50 hover:shadow-sm text-left transition-all"
          >
            <div className="flex items-center justify-between text-stone-500 mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
              <Icon className="w-3.5 h-3.5 text-emerald-800" />
            </div>
            <p className="text-2xl font-extrabold text-stone-900 tabular-nums leading-none">{value}</p>
            <p className="text-[10px] text-stone-400 mt-1">{sub}</p>
          </button>
        ))}
      </div>

      {/* ── Main grid ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left col: quick actions + recent members */}
        <div className="lg:col-span-2 space-y-4">

          {/* Quick-action navigation cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quickActions.map(({ id, icon: Icon, label, description }) => (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className="group text-left p-4 bg-white border border-stone-200 hover:border-emerald-700/60 rounded-xl shadow-xs hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-emerald-50 text-emerald-800 rounded-lg group-hover:bg-emerald-100 transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-all" />
                </div>
                <p className="text-sm font-bold text-stone-900 mb-0.5">{label}</p>
                <p className="text-[11px] text-stone-500 leading-relaxed">{description}</p>
              </button>
            ))}
          </div>

          {/* Recent memories (read-only) */}
          {recentMemories.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-stone-900">Recent Memories</h3>
                  <p className="text-[11px] text-stone-500">Family photos &amp; milestone moments</p>
                </div>
                <button
                  onClick={() => onNavigate('memories')}
                  className="text-xs text-emerald-800 font-semibold hover:underline flex items-center gap-1"
                >
                  View all <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {recentMemories.map(mem => (
                  <button
                    key={mem.id}
                    onClick={() => onNavigate('memories')}
                    className="group rounded-xl border border-stone-200 overflow-hidden bg-stone-50 hover:shadow-sm transition-all text-left"
                  >
                    <img
                      src={mem.image_url}
                      alt={mem.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-20 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="p-2">
                      <p className="font-semibold text-stone-800 text-[11px] truncate leading-tight">
                        {mem.title}
                      </p>
                      {mem.location && (
                        <p className="text-[10px] text-stone-400 flex items-center gap-0.5 mt-0.5">
                          <MapPin className="w-2.5 h-2.5" />
                          {mem.location}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right col: family members + upcoming birthdays */}
        <div className="space-y-4">

          {/* Family members list */}
          <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900">Family Members</h3>
              <button
                onClick={() => onNavigate('tree')}
                className="text-[11px] text-emerald-800 font-semibold hover:underline"
              >
                Full tree
              </button>
            </div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
              {people.slice(0, 10).map(person => (
                <button
                  key={person.id}
                  onClick={() => onSelectPerson(person)}
                  className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-stone-50 transition-colors text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-900 font-bold text-[11px] flex items-center justify-center shrink-0">
                    {person.display_name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-stone-900 truncate">
                      {person.display_name}
                    </p>
                    <p className="text-[10px] text-stone-400">
                      Gen {person.generation_level}
                      {person.birth_date ? ` · b. ${person.birth_date.substring(0, 4)}` : ''}
                    </p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-stone-300 shrink-0 ml-auto" />
                </button>
              ))}
              {people.length > 10 && (
                <button
                  onClick={() => onNavigate('tree')}
                  className="w-full text-center text-[11px] text-emerald-800 font-semibold hover:underline py-1"
                >
                  +{people.length - 10} more members
                </button>
              )}
            </div>
          </div>

          {/* Upcoming birthdays */}
          {upcoming.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs space-y-2">
              <h3 className="text-sm font-bold text-stone-900">Upcoming Birthdays</h3>
              <div className="space-y-1.5">
                {upcoming.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onSelectPerson(p)}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-stone-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-rose-50 text-rose-600 rounded-md">
                        <Cake className="w-3 h-3" />
                      </div>
                      <p className="text-xs font-semibold text-stone-900">{p.display_name}</p>
                    </div>
                    <span className="text-[10px] font-medium text-stone-500 tabular-nums">
                      {p.birth_date ? p.birth_date.substring(5) : ''}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer note ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 text-[11px] text-stone-400 pb-2">
        <Lock className="w-3 h-3 shrink-0" />
        Read-only access · Data changes require Admin permissions ·
        All writes are blocked at the database level via Supabase RLS.
      </div>
    </div>
  );
};
