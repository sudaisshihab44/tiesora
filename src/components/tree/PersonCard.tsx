import React from 'react';
import { FamilyPerson } from '../../types';
import { Heart, UserPlus, Compass, Edit3 } from 'lucide-react';

interface PersonCardProps {
  person: FamilyPerson;
  isSelected?: boolean;
  isHighlighted?: boolean;
  isPathNode?: boolean;
  hasChildren?: boolean;
  isCollapsed?: boolean;
  onSelect: (person: FamilyPerson) => void;
  onAddRelative?: (person: FamilyPerson) => void;
  onExploreRelationship?: (person: FamilyPerson) => void;
  onToggleCollapse?: (personId: string) => void;
  onEdit?: (person: FamilyPerson) => void;
}

export const PersonCard: React.FC<PersonCardProps> = ({
  person,
  isSelected,
  isHighlighted,
  isPathNode,
  hasChildren,
  isCollapsed,
  onSelect,
  onAddRelative,
  onExploreRelationship,
  onToggleCollapse,
  onEdit,
}) => {
  const birthYear = person.birth_date ? person.birth_date.substring(0, 4) : '';
  const deathYear = person.death_date ? person.death_date.substring(0, 4) : '';
  const isDeceased = person.living_status === 'deceased';

  const yearsLabel = birthYear 
    ? `${birthYear}${deathYear ? ` – ${deathYear}` : isDeceased ? ' – Deceased' : ' · Living'}`
    : isDeceased ? 'Deceased' : 'Living';

  const initials = person.display_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Gender indicator accent
  const genderBorderColor = 
    person.gender === 'female' 
      ? 'border-amber-700/20' 
      : person.gender === 'male' 
      ? 'border-emerald-800/30' 
      : 'border-slate-300';

  return (
    <div
      onClick={() => onSelect(person)}
      className={`relative w-[240px] h-[110px] bg-white rounded-xl border transition-all duration-200 cursor-pointer select-none text-left p-3.5 flex flex-col justify-between group ${
        isSelected
          ? 'ring-2 ring-emerald-700 border-emerald-700 shadow-md'
          : isPathNode
          ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-50/20 shadow-md'
          : isHighlighted
          ? 'border-emerald-600 bg-emerald-50/30 shadow-sm'
          : `${genderBorderColor} hover:border-emerald-700/60 hover:shadow-md`
      }`}
    >
      {/* Top Header Row */}
      <div className="flex items-start gap-3">
        {/* Avatar or Initials */}
        <div className="relative shrink-0">
          {person.avatar_path ? (
            <img
              src={person.avatar_path}
              alt={person.display_name}
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-xs"
            />
          ) : (
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold ${
              person.gender === 'female'
                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                : person.gender === 'male'
                ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                : 'bg-stone-100 text-stone-700 border border-stone-200'
            }`}>
              {initials}
            </div>
          )}
          {isDeceased && (
            <span
              title="Deceased"
              className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-stone-500 text-white rounded-full flex items-center justify-center text-[8px] font-bold shadow-xs"
            >
              †
            </span>
          )}
        </div>

        {/* Name and Meta */}
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-stone-900 truncate tracking-tight">
            {person.display_name}
          </h4>
          <p className="text-xs text-stone-500 truncate tabular-nums mt-0.5">
            {yearsLabel}
          </p>
          {person.branch && (
            <span className="text-[11px] text-stone-400 truncate block mt-0.5">
              {person.branch}
            </span>
          )}
        </div>
      </div>

      {/* Bottom Action Strip */}
      <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-[11px] text-stone-500">
        <span className="text-[10px] text-stone-400 font-medium">
          Gen {person.generation_level}
        </span>

        {/* Contextual Action Buttons */}
        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          {onAddRelative && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddRelative(person);
              }}
              title="Add Relative"
              className="p-1 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-colors"
            >
              <UserPlus className="w-3.5 h-3.5" />
            </button>
          )}

          {onExploreRelationship && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExploreRelationship(person);
              }}
              title="Find Relationship Path"
              className="p-1 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-colors"
            >
              <Compass className="w-3.5 h-3.5" />
            </button>
          )}

          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(person);
              }}
              title="Edit Profile"
              className="p-1 hover:text-emerald-800 hover:bg-emerald-50 rounded transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Branch Expand/Collapse Indicator */}
      {hasChildren && onToggleCollapse && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse(person.id);
          }}
          title={isCollapsed ? 'Expand Children Branch' : 'Collapse Children Branch'}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white border border-stone-300 text-stone-600 shadow-xs flex items-center justify-center text-xs hover:border-emerald-700 hover:text-emerald-800 hover:scale-105 transition-all z-10"
        >
          {isCollapsed ? '+' : '−'}
        </button>
      )}
    </div>
  );
};
