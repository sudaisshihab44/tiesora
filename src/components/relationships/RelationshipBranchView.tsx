import React from 'react';
import { ArrowDown, GitBranch } from 'lucide-react';
import type { CalculatedRelationship, FamilyPerson, RelationshipBranch } from '../../types';
import { MemberAvatar } from '../common/MemberAvatar';

interface RelationshipBranchViewProps {
  result: CalculatedRelationship;
  onSelectPerson: (person: FamilyPerson) => void;
}

function inverseChildLabel(label: string, child: FamilyPerson): string {
  const isFemale = child.gender === 'female';
  const isMale = child.gender === 'male';
  if (label.includes('Adoptive')) {
    return isFemale ? 'Adoptive Daughter' : isMale ? 'Adoptive Son' : 'Adoptive Child';
  }
  if (label.includes('Step')) {
    return isFemale ? 'Step-Daughter' : isMale ? 'Step-Son' : 'Step-Child';
  }
  if (label === 'Father' || label === 'Mother' || label === 'Parent') {
    return isFemale ? 'Daughter' : isMale ? 'Son' : 'Child';
  }
  if (label === 'Husband') return 'Wife';
  if (label === 'Wife') return 'Husband';
  return 'Descendant';
}

function BranchColumn({
  title,
  branch,
  endpointId,
  onSelectPerson,
}: {
  title: string;
  branch: RelationshipBranch;
  endpointId: string;
  onSelectPerson: (person: FamilyPerson) => void;
}) {
  const nodes = [...branch.nodes].reverse();
  const labels = [...branch.edgeDescriptions].reverse();

  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-2">
        {title}
      </p>
      <div className="space-y-1">
        {nodes.map((person, index) => {
          const isEndpoint = person.id === endpointId;
          return (
            <React.Fragment key={person.id}>
              {index > 0 && (
                <div className="flex items-center gap-1.5 pl-4 py-0.5 text-[10px] font-medium text-emerald-800">
                  <ArrowDown className="w-3 h-3" />
                  <span>{inverseChildLabel(labels[index - 1] ?? '', person)}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => onSelectPerson(person)}
                className={`w-full text-left rounded-lg border px-2 py-1.5 flex items-center gap-2 transition-colors ${
                  isEndpoint
                    ? 'bg-white border-emerald-700/60 shadow-xs'
                    : 'bg-white/70 border-stone-200 hover:border-emerald-700/50'
                }`}
              >
                <MemberAvatar person={person} className="w-6 h-6 text-[9px]" />
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold text-stone-800 truncate">
                    {person.display_name}
                  </span>
                  <span className="block text-[9px] text-stone-400">
                    Gen {person.generation_level}
                  </span>
                </span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

export const RelationshipBranchView: React.FC<RelationshipBranchViewProps> = ({
  result,
  onSelectPerson,
}) => {
  const { commonAncestor, sourceBranch, targetBranch, generationDistance } = result;
  if (!commonAncestor || !sourceBranch || !targetBranch) return null;
  if (
    !generationDistance ||
    generationDistance.sourceToCommonAncestor === 0 ||
    generationDistance.targetToCommonAncestor === 0
  ) {
    return null;
  }

  return (
    <div className="rounded-xl border border-emerald-900/10 bg-emerald-50/40 p-4 space-y-4">
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-950">
        <GitBranch className="w-3.5 h-3.5" />
        Connection Branches
      </div>

      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => onSelectPerson(commonAncestor)}
          className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-emerald-300 rounded-xl hover:border-emerald-700 transition-colors shadow-2xs"
        >
          <MemberAvatar person={commonAncestor} className="w-7 h-7 text-[10px]" />
          <span className="text-left">
            <span className="block text-[10px] uppercase tracking-wider text-emerald-800 font-bold">
              Closest Common Ancestor
            </span>
            <span className="block text-xs font-semibold text-stone-900">
              {commonAncestor.display_name}
            </span>
          </span>
        </button>
        <ArrowDown className="w-4 h-4 text-emerald-700" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <BranchColumn
          title={`${result.sourcePerson.display_name}'s branch`}
          branch={sourceBranch}
          endpointId={result.sourcePerson.id}
          onSelectPerson={onSelectPerson}
        />
        <BranchColumn
          title={`${result.targetPerson.display_name}'s branch`}
          branch={targetBranch}
          endpointId={result.targetPerson.id}
          onSelectPerson={onSelectPerson}
        />
      </div>
    </div>
  );
};
