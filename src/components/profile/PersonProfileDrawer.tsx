import React from 'react';
import { FamilyPerson, Relationship, Memory } from '../../types';
import { 
  X, 
  Edit3, 
  UserPlus, 
  Compass, 
  MapPin, 
  Calendar, 
  Heart, 
  Image as ImageIcon, 
  Trash2, 
  Crosshair, 
  Clock, 
  ChevronRight,
  Unlink
} from 'lucide-react';

interface PersonProfileDrawerProps {
  person: FamilyPerson | null;
  isOpen: boolean;
  onClose: () => void;
  people: FamilyPerson[];
  relationships: Relationship[];
  memories: Memory[];
  onSelectPerson: (person: FamilyPerson) => void;
  onEditPerson: (person: FamilyPerson) => void;
  onAddRelative: (person: FamilyPerson) => void;
  onExploreRelationship: (person: FamilyPerson) => void;
  onDeletePerson: (personId: string) => void;
  onDeleteRelationship?: (relId: string) => void;
}

export const PersonProfileDrawer: React.FC<PersonProfileDrawerProps> = ({
  person,
  isOpen,
  onClose,
  people,
  relationships,
  memories,
  onSelectPerson,
  onEditPerson,
  onAddRelative,
  onExploreRelationship,
  onDeletePerson,
  onDeleteRelationship,
}) => {
  if (!isOpen || !person) return null;

  const peopleMap = new Map<string, FamilyPerson>(people.map(p => [p.id, p]));

  // Find Parents
  const parents: { person: FamilyPerson; type: Relationship['relationship_type']; relId: string }[] = [];
  relationships.forEach(r => {
    if (r.target_person_id === person.id && ['parent', 'adoptive_parent', 'step_parent'].includes(r.relationship_type)) {
      const p = peopleMap.get(r.source_person_id);
      if (p) parents.push({ person: p, type: r.relationship_type, relId: r.id });
    }
  });

  // Find Spouses
  const spouses: { person: FamilyPerson; rel: Relationship }[] = [];
  relationships.forEach(r => {
    if (['spouse', 'partner'].includes(r.relationship_type)) {
      if (r.source_person_id === person.id) {
        const sp = peopleMap.get(r.target_person_id);
        if (sp) spouses.push({ person: sp, rel: r });
      } else if (r.target_person_id === person.id) {
        const sp = peopleMap.get(r.source_person_id);
        if (sp) spouses.push({ person: sp, rel: r });
      }
    }
  });

  // Find Children
  const children: { person: FamilyPerson; type: Relationship['relationship_type']; relId: string }[] = [];
  relationships.forEach(r => {
    if (r.source_person_id === person.id && ['parent', 'adoptive_parent', 'step_parent'].includes(r.relationship_type)) {
      const c = peopleMap.get(r.target_person_id);
      if (c) children.push({ person: c, type: r.relationship_type, relId: r.id });
    }
  });

  // Find Siblings (people who share at least one parent)
  const parentIds = parents.map(p => p.person.id);
  const siblingIds = new Set<string>();
  relationships.forEach(r => {
    if (parentIds.includes(r.source_person_id) && r.target_person_id !== person.id) {
      siblingIds.add(r.target_person_id);
    }
  });
  const siblings = Array.from(siblingIds)
    .map(id => peopleMap.get(id))
    .filter((p): p is FamilyPerson => Boolean(p));

  // Tagged Memories
  const taggedMemories = memories.filter(m => m.tagged_person_ids.includes(person.id));

  const birthYear = person.birth_date ? person.birth_date.substring(0, 4) : '';
  const deathYear = person.death_date ? person.death_date.substring(0, 4) : '';
  const isDeceased = person.living_status === 'deceased';

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to remove ${person.display_name} from the family tree? This will remove all their direct relationship links.`)) {
      onDeletePerson(person.id);
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop for mobile — tap to close */}
      <div
        className="fixed inset-0 z-40 bg-stone-900/30 sm:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-sm md:max-w-md bg-white border-l border-stone-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/70">
        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-900/60">
          Member Profile · Gen {person.generation_level}
        </span>
        <button
          onClick={onClose}
          className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Drawer Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Profile Card Summary */}
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            {person.avatar_path ? (
              <img
                src={person.avatar_path}
                alt={person.display_name}
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-2xl object-cover border border-stone-200 shadow-xs"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 font-bold text-xl flex items-center justify-center">
                {person.display_name.substring(0, 2).toUpperCase()}
              </div>
            )}
            {isDeceased && (
              <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 bg-stone-600 text-white text-[9px] font-bold rounded-md">
                Deceased
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-stone-900 leading-tight">
              {person.display_name}
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {person.full_name}
            </p>
            <div className="flex items-center gap-2 text-xs text-stone-500 mt-2 tabular-nums">
              <span>{birthYear || 'Unknown'}</span>
              <span aria-hidden="true">·</span>
              <span>{deathYear ? deathYear : isDeceased ? 'Deceased' : 'Living'}</span>
              {person.branch && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-stone-400">{person.branch}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => onExploreRelationship(person)}
            className="py-2 px-2.5 bg-emerald-800 text-white rounded-xl text-xs font-medium hover:bg-emerald-900 transition-colors flex items-center justify-center gap-1.5 shadow-xs"
          >
            <Compass className="w-3.5 h-3.5" />
            Find Path
          </button>
          <button
            onClick={() => onAddRelative(person)}
            className="py-2 px-2.5 bg-stone-100 text-stone-800 rounded-xl text-xs font-medium hover:bg-stone-200 transition-colors flex items-center justify-center gap-1.5"
          >
            <UserPlus className="w-3.5 h-3.5" />
            + Relative
          </button>
          <button
            onClick={() => onEditPerson(person)}
            className="py-2 px-2.5 bg-stone-100 text-stone-800 rounded-xl text-xs font-medium hover:bg-stone-200 transition-colors flex items-center justify-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit Profile
          </button>
        </div>

        {/* Biography */}
        {person.biography && (
          <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl">
            <h4 className="text-xs font-semibold text-stone-800 mb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-stone-500" />
              Life Summary & Biography
            </h4>
            <p className="text-xs text-stone-600 leading-relaxed whitespace-pre-line">
              {person.biography}
            </p>
          </div>
        )}

        {/* Vital Details */}
        <div className="space-y-2 text-xs">
          <h4 className="font-semibold text-stone-800">Vital Records</h4>
          <div className="border border-stone-200 rounded-xl divide-y divide-stone-100">
            <div className="p-3 flex items-start justify-between">
              <span className="text-stone-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                Birth
              </span>
              <span className="font-medium text-stone-800 tabular-nums text-right">
                {person.birth_date || 'Date unrecorded'}
                {person.birth_place && <span className="block text-stone-400 font-normal">{person.birth_place}</span>}
              </span>
            </div>
            {isDeceased && (
              <div className="p-3 flex items-start justify-between">
                <span className="text-stone-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-stone-400" />
                  Death
                </span>
                <span className="font-medium text-stone-800 tabular-nums text-right">
                  {person.death_date || 'Date unrecorded'}
                  {person.death_place && <span className="block text-stone-400 font-normal">{person.death_place}</span>}
                </span>
              </div>
            )}
            <div className="p-3 flex items-center justify-between">
              <span className="text-stone-500">Gender</span>
              <span className="font-medium text-stone-800 capitalize">
                {person.gender || 'Unspecified'}
              </span>
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="text-stone-500">Tree Generation</span>
              <span className="font-medium text-stone-800">
                Generation {person.generation_level}
              </span>
            </div>
          </div>
        </div>

        {/* Immediate Family Links */}
        <div className="space-y-4 text-xs">
          <h4 className="font-semibold text-stone-800">Family Relationships</h4>

          {/* Parents */}
          <div>
            <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider block mb-1.5">
              Parents ({parents.length})
            </span>
            {parents.length === 0 ? (
              <p className="text-stone-400 italic">No parents recorded.</p>
            ) : (
              <div className="space-y-1.5">
                {parents.map(({ person: p, type, relId }) => (
                  <div
                    key={p.id}
                    className="w-full p-2.5 rounded-lg border border-stone-200 hover:border-emerald-700/60 hover:bg-emerald-50/30 flex items-center justify-between group transition-all"
                  >
                    <button
                      onClick={() => onSelectPerson(p)}
                      className="text-left flex-1 min-w-0"
                    >
                      <p className="font-semibold text-stone-800 group-hover:text-emerald-950 truncate">
                        {p.display_name}
                      </p>
                      <p className="text-[10px] text-stone-400 capitalize">
                        {type === 'parent' ? (p.gender === 'female' ? 'Mother' : 'Father') : type.replace('_', ' ')}
                      </p>
                    </button>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {onDeleteRelationship && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Unlink parent relationship between ${person.display_name} and ${p.display_name}? (Both person records will be kept).`)) {
                              onDeleteRelationship(relId);
                            }
                          }}
                          title="Unlink relationship"
                          className="p-1 text-stone-300 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-emerald-800 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Spouses */}
          <div>
            <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider block mb-1.5">
              Spouse / Partner ({spouses.length})
            </span>
            {spouses.length === 0 ? (
              <p className="text-stone-400 italic">No spouse or partner recorded.</p>
            ) : (
              <div className="space-y-1.5">
                {spouses.map(({ person: p, rel }) => (
                  <div
                    key={p.id}
                    className="w-full p-2.5 rounded-lg border border-amber-200/60 bg-amber-50/20 hover:border-amber-400 flex items-center justify-between group transition-all"
                  >
                    <button
                      onClick={() => onSelectPerson(p)}
                      className="text-left flex-1 min-w-0"
                    >
                      <p className="font-semibold text-stone-800 group-hover:text-amber-950 truncate">
                        {p.display_name}
                      </p>
                      <p className="text-[10px] text-amber-800/80">
                        {rel.valid_from ? `Married ${rel.valid_from.substring(0, 4)}` : 'Spouse'}
                      </p>
                    </button>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {onDeleteRelationship && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Unlink spouse relationship between ${person.display_name} and ${p.display_name}? (Both person records will be kept).`)) {
                              onDeleteRelationship(rel.id);
                            }
                          }}
                          title="Unlink relationship"
                          className="p-1 text-amber-300 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <ChevronRight className="w-4 h-4 text-amber-400 group-hover:text-amber-700 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Children */}
          <div>
            <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider block mb-1.5">
              Children ({children.length})
            </span>
            {children.length === 0 ? (
              <p className="text-stone-400 italic">No children recorded.</p>
            ) : (
              <div className="space-y-1.5">
                {children.map(({ person: p, type, relId }) => (
                  <div
                    key={p.id}
                    className="w-full p-2.5 rounded-lg border border-stone-200 hover:border-emerald-700/60 hover:bg-emerald-50/30 flex items-center justify-between group transition-all"
                  >
                    <button
                      onClick={() => onSelectPerson(p)}
                      className="text-left flex-1 min-w-0"
                    >
                      <p className="font-semibold text-stone-800 group-hover:text-emerald-950 truncate">
                        {p.display_name}
                      </p>
                      <p className="text-[10px] text-stone-400 capitalize">
                        {type === 'parent' ? (p.gender === 'female' ? 'Daughter' : 'Son') : type.replace('_', ' ')}
                      </p>
                    </button>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {onDeleteRelationship && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Unlink child relationship between ${person.display_name} and ${p.display_name}? (Both person records will be kept).`)) {
                              onDeleteRelationship(relId);
                            }
                          }}
                          title="Unlink relationship"
                          className="p-1 text-stone-300 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors"
                        >
                          <Unlink className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-emerald-800 transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Siblings */}
          <div>
            <span className="text-[11px] font-medium text-stone-400 uppercase tracking-wider block mb-1.5">
              Siblings ({siblings.length})
            </span>
            {siblings.length === 0 ? (
              <p className="text-stone-400 italic">No siblings recorded.</p>
            ) : (
              <div className="space-y-1.5">
                {siblings.map(p => (
                  <button
                    key={p.id}
                    onClick={() => onSelectPerson(p)}
                    className="w-full text-left p-2.5 rounded-lg border border-stone-200 hover:border-emerald-700/60 hover:bg-emerald-50/30 flex items-center justify-between group transition-all"
                  >
                    <div>
                      <p className="font-semibold text-stone-800 group-hover:text-emerald-950">
                        {p.display_name}
                      </p>
                      <p className="text-[10px] text-stone-400">
                        {p.gender === 'female' ? 'Sister' : p.gender === 'male' ? 'Brother' : 'Sibling'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-emerald-800 transition-colors" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tagged Memories Gallery */}
        <div className="space-y-2 text-xs">
          <h4 className="font-semibold text-stone-800 flex items-center justify-between">
            <span>Tagged Memories ({taggedMemories.length})</span>
          </h4>
          {taggedMemories.length === 0 ? (
            <p className="text-stone-400 italic">No photographs or stories attached yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {taggedMemories.map(mem => (
                <div
                  key={mem.id}
                  className="rounded-xl border border-stone-200 overflow-hidden bg-stone-50 group hover:shadow-sm transition-all"
                >
                  <img
                    src={mem.image_url}
                    alt={mem.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-24 object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="p-2">
                    <p className="font-medium text-stone-900 truncate">{mem.title}</p>
                    <p className="text-[10px] text-stone-400 tabular-nums">{mem.memory_date || 'Undated'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Destructive Delete Action */}
        <div className="pt-4 border-t border-stone-200">
          <button
            onClick={handleDelete}
            className="w-full py-2 px-3 text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove {person.display_name} from Tree
          </button>
        </div>
      </div>
    </div>
    </>
  );
};
