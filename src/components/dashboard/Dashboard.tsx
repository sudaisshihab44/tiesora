import React from 'react';
import { FamilyImage } from '../common/FamilyImage';
import {
  Family,
  FamilyPerson,
  Relationship,
  Memory,
  FamilyEvent,
  ChangeRequest,
  AuditLog,
} from '../../types';
import {
  Users,
  GitFork,
  Compass,
  Camera,
  UserPlus,
  Calendar,
  ArrowRight,
  Layers,
  Clock,
  Cake,
  CheckCircle2,
  Sliders,
} from 'lucide-react';

interface DashboardProps {
  family: Family;
  people: FamilyPerson[];
  relationships: Relationship[];
  memories: Memory[];
  events: FamilyEvent[];
  changeRequests: ChangeRequest[];
  auditLogs: AuditLog[];
  onNavigate: (tab: string) => void;
  onSelectPerson: (person: FamilyPerson) => void;
  onAddRelative?: (targetPerson?: FamilyPerson) => void;
  onUploadMemory?: () => void;
  onInviteRelative?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  family,
  people,
  relationships,
  memories,
  events,
  changeRequests,
  auditLogs,
  onNavigate,
  onSelectPerson,
  onAddRelative,
  onUploadMemory,
  onInviteRelative,
}) => {
  const maxGen = people.reduce((max, p) => Math.max(max, p.generation_level || 1), 1);
  const pendingRequests = changeRequests.filter(cr => cr.status === 'pending');
  const livingPeopleWithBirthdays = people
    .filter(p => p.living_status === 'living' && p.birth_date)
    .slice(0, 3);
  const marriages = relationships.filter(r => ['spouse', 'partner'].includes(r.relationship_type));

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-5 space-y-5">
      {/* Welcome Banner — compact */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#285C43] to-[#193D2D] text-white rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="relative z-10 max-w-2xl space-y-2">
          <span className="text-[10px] font-semibold tracking-wider uppercase text-emerald-200/90">
            Family Heritage Hub
          </span>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white leading-tight">
            {family.name}
          </h1>
          <p className="text-xs text-emerald-100/80 leading-relaxed line-clamp-2">
            {family.description || 'Build your family, discover your connections, and preserve your legacy across generations.'}
          </p>

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
            {onAddRelative && (
            <button
              onClick={() => onAddRelative()}
              className="px-3 py-2 bg-emerald-900/60 hover:bg-emerald-900 border border-emerald-400/30 text-white font-medium rounded-lg text-xs transition-all flex items-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5 text-emerald-200" />
              Add Member
            </button>
            )}
          </div>
        </div>
        <div className="absolute -right-8 -bottom-8 w-48 h-48 rounded-full bg-emerald-700/20 blur-2xl pointer-events-none" />
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Members', value: people.length, sub: `${marriages.length} marriages`, icon: Users, tab: 'tree' },
          { label: 'Generations', value: maxGen, sub: 'Gen I to IV', icon: Layers, tab: 'tree' },
          { label: 'Memories', value: memories.length, sub: 'Photos & stories', icon: Camera, tab: 'memories' },
          { label: 'Events', value: events.length, sub: 'Upcoming milestones', icon: Calendar, tab: 'events' },
        ].map(({ label, value, sub, icon: Icon, tab }) => (
          <div
            key={label}
            onClick={() => onNavigate(tab)}
            className="bg-white p-4 rounded-xl border border-stone-200 shadow-2xs hover:border-emerald-700/50 cursor-pointer transition-all"
          >
            <div className="flex items-center justify-between text-stone-500 mb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
              <Icon className="w-3.5 h-3.5 text-emerald-800" />
            </div>
            <p className="text-2xl font-extrabold text-stone-900 tabular-nums leading-none">{value}</p>
            <p className="text-[10px] text-stone-400 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Pending Change Requests Alert */}
      {pendingRequests.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-500 text-white rounded-lg shrink-0">
              <Sliders className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-950">
                {pendingRequests.length} Pending {pendingRequests.length === 1 ? 'Proposal' : 'Proposals'}
              </p>
              <p className="text-[11px] text-amber-800">Review edit suggestions from contributors.</p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('collaboration')}
            className="px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded-lg text-xs font-semibold transition-colors shrink-0"
          >
            Review
          </button>
        </div>
      )}

      {/* Two-column core layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Memories + Relationship Intelligence */}
        <div className="lg:col-span-2 space-y-4">
          {/* Recent Memories */}
          <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-stone-900">Recent Memories</h3>
                <p className="text-[11px] text-stone-500">Archival photographs and milestone moments</p>
              </div>
              <button
                onClick={() => onNavigate('memories')}
                className="text-xs text-emerald-800 font-semibold hover:underline flex items-center gap-1"
              >
                All ({memories.length})
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {memories.slice(0, 2).map(mem => (
                <div
                  key={mem.id}
                  onClick={() => onNavigate('memories')}
                  className="rounded-xl border border-stone-200 overflow-hidden bg-stone-50 hover:shadow-sm cursor-pointer transition-all group"
                >
                  <FamilyImage
                    src={mem.image_url}
                    alt={mem.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-28 object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="p-2.5">
                    <p className="font-bold text-stone-900 text-xs truncate group-hover:text-emerald-900">
                      {mem.title}
                    </p>
                    <p className="text-[10px] text-stone-500 tabular-nums mt-0.5">
                      {mem.memory_date || 'Historical'}{mem.location ? ` · ${mem.location}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Relationship Intelligence */}
          <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-stone-900">Relationship Intelligence</h3>
                <p className="text-[11px] text-stone-500">Instant kinship path calculation</p>
              </div>
              <button
                onClick={() => onNavigate('relationships')}
                className="text-xs text-emerald-800 font-semibold hover:underline flex items-center gap-1"
              >
                Explorer
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="p-3 bg-emerald-50/50 border border-emerald-900/10 rounded-lg space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-950">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                Featured: Thomas & Julian
              </div>
              <p className="text-xs text-emerald-900/80 leading-relaxed">
                <strong>First Cousins</strong> through shared grandparents Jonathan Vance & Eleanor Ward.
              </p>
              <div className="flex flex-wrap items-center gap-1 text-[10px] text-stone-500">
                {['Thomas', 'Diana Vance', 'Jonathan & Eleanor', 'Linda Vance', 'Julian Chen'].map((n, i, arr) => (
                  <React.Fragment key={n}>
                    <span className={i === 0 || i === arr.length - 1 ? 'font-semibold text-stone-700' : ''}>{n}</span>
                    {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-stone-300" />}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Milestones + Audit Feed */}
        <div className="space-y-4">
          {/* Upcoming Birthdays */}
          <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-900">Upcoming Milestones</h3>
              <button onClick={() => onNavigate('events')} className="text-[11px] text-emerald-800 font-semibold hover:underline">
                Calendar
              </button>
            </div>
            <div className="space-y-2">
              {livingPeopleWithBirthdays.map(p => (
                <div
                  key={p.id}
                  onClick={() => onSelectPerson(p)}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-stone-50 cursor-pointer transition-colors border border-stone-100"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-rose-50 text-rose-700 rounded-md">
                      <Cake className="w-3 h-3" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-stone-900">{p.display_name}</p>
                      <p className="text-[10px] text-stone-400">Gen {p.generation_level}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-stone-600 tabular-nums">
                    {p.birth_date ? p.birth_date.substring(5) : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Audit Feed */}
          <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-xs space-y-2">
            <h3 className="text-sm font-bold text-stone-900">Recent Updates</h3>
            <div className="space-y-2 text-xs divide-y divide-stone-100">
              {auditLogs.slice(0, 3).map(log => (
                <div key={log.id} className="pt-2 first:pt-0">
                  <p className="font-semibold text-stone-800 truncate text-xs">{log.action}</p>
                  <p className="text-[11px] text-stone-500 truncate">{log.target_name}</p>
                  <span className="text-[10px] text-stone-400 tabular-nums">
                    {log.created_at.substring(0, 10)} · {log.user_name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
