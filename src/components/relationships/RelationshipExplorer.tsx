import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  CheckCircle2,
  Compass,
  GitCommit,
  Info,
  Layers,
  SearchX,
  Users,
  XCircle,
} from 'lucide-react';
import type {
  CalculatedRelationship,
  FamilyPerson,
  Relationship,
  RelationshipConnectionStatus,
} from '../../types';
import { calculateRelationship } from '../../utils/relationshipEngine';
import { MemberAvatar } from '../common/MemberAvatar';
import { PersonPicker } from './PersonPicker';
import { RelationshipBranchView } from './RelationshipBranchView';

interface RelationshipExplorerProps {
  people: FamilyPerson[];
  relationships: Relationship[];
  initialPersonAId?: string;
  initialPersonBId?: string;
  onSelectPerson: (person: FamilyPerson) => void;
  onJumpToTreeWithHighlight?: (personIds: string[]) => void;
}

const STATUS_META: Record<
  RelationshipConnectionStatus,
  {
    label: string;
    className: string;
    icon: React.ElementType;
  }
> = {
  verified: {
    label: 'Verified Relationship',
    className: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    icon: CheckCircle2,
  },
  incomplete: {
    label: 'Incomplete Family Records',
    className: 'bg-amber-50 text-amber-800 border border-amber-200',
    icon: AlertTriangle,
  },
  not_found: {
    label: 'No Verified Relationship Found',
    className: 'bg-stone-100 text-stone-700 border border-stone-200',
    icon: SearchX,
  },
  invalid: {
    label: 'Invalid Selection',
    className: 'bg-rose-50 text-rose-800 border border-rose-200',
    icon: XCircle,
  },
};

function formatGenerationDistance(result: CalculatedRelationship): string {
  const distance = result.generationDistance;
  if (!distance) {
    return result.relationshipCategory === 'spouse' ||
      result.relationshipCategory === 'in_law' ||
      result.relationshipCategory === 'step'
      ? 'By marriage or step relationship'
      : 'Not available from recorded data';
  }
  if (distance.sourceToCommonAncestor === 0) {
    return `${distance.targetToCommonAncestor} generation${
      distance.targetToCommonAncestor === 1 ? '' : 's'
    } below`;
  }
  if (distance.targetToCommonAncestor === 0) {
    return `${distance.sourceToCommonAncestor} generation${
      distance.sourceToCommonAncestor === 1 ? '' : 's'
    } above`;
  }
  if (distance.generationOffset === 0) {
    return `Same generation · ${distance.sourceToCommonAncestor} generation${
      distance.sourceToCommonAncestor === 1 ? '' : 's'
    } from the common ancestor`;
  }
  return `${distance.generationOffset} generation${
    distance.generationOffset === 1 ? '' : 's'
  } apart · ${distance.sourceToCommonAncestor} up / ${distance.targetToCommonAncestor} down`;
}

export const RelationshipExplorer: React.FC<RelationshipExplorerProps> = ({
  people,
  relationships,
  initialPersonAId,
  initialPersonBId,
  onSelectPerson,
  onJumpToTreeWithHighlight,
}) => {
  const defaultRelationship = relationships.find((relationship) =>
    ['parent', 'spouse', 'adoptive_parent', 'step_parent'].includes(
      relationship.relationship_type,
    ),
  );
  const defaultPersonAId =
    initialPersonAId ||
    defaultRelationship?.source_person_id ||
    people[0]?.id ||
    '';
  const defaultPersonBId =
    initialPersonBId ||
    defaultRelationship?.target_person_id ||
    people[1]?.id ||
    '';

  const [personAId, setPersonAId] = useState<string>(defaultPersonAId);
  const [personBId, setPersonBId] = useState<string>(defaultPersonBId);

  const personA = people.find((person) => person.id === personAId);
  const personB = people.find((person) => person.id === personBId);

  const calculation: CalculatedRelationship | null = useMemo(() => {
    if (!personA || !personB) return null;
    return calculateRelationship(personA, personB, people, relationships);
  }, [personA, personB, people, relationships]);

  const handleSwap = () => {
    setPersonAId(personBId);
    setPersonBId(personAId);
  };

  // Data-driven quick presets from the family's actual relationships.
  const presets = useMemo(() => {
    const seen = new Set<string>();
    const result: Array<{ label: string; a: string; b: string }> = [];

    for (const relationship of relationships) {
      if (
        !['parent', 'spouse', 'adoptive_parent', 'step_parent', 'partner'].includes(
          relationship.relationship_type,
        )
      ) {
        continue;
      }

      const a = people.find(
        (person) => person.id === relationship.source_person_id,
      );
      const b = people.find(
        (person) => person.id === relationship.target_person_id,
      );
      if (!a || !b) continue;

      const key = [a.id, b.id].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);

      const preset = calculateRelationship(a, b, people, relationships);
      result.push({
        label: `${a.display_name} & ${b.display_name} (${preset.primaryLabel})`,
        a: a.id,
        b: b.id,
      });

      if (result.length >= 4) break;
    }

    return result;
  }, [people, relationships]);

  const status = calculation ? STATUS_META[calculation.connectionStatus] : STATUS_META.not_found;
  const StatusIcon = status.icon;
  const showPath =
    Boolean(calculation) &&
    calculation!.pathNodes.length > 1 &&
    calculation!.connectionStatus !== 'not_found' &&
    calculation!.connectionStatus !== 'invalid';
  const showBranch =
    showPath &&
    Boolean(calculation?.commonAncestor) &&
    Boolean(calculation?.sourceBranch) &&
    Boolean(calculation?.targetBranch) &&
    (calculation?.generationDistance?.sourceToCommonAncestor ?? 0) > 0 &&
    (calculation?.generationDistance?.targetToCommonAncestor ?? 0) > 0;

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-5 space-y-5">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">
          <Compass className="w-4 h-4" />
          Relationship Intelligence Engine
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
          Find a Family Relationship
        </h1>
        <p className="text-xs text-stone-600 mt-1 max-w-2xl">
          Select any two family members to calculate their exact recorded
          relationship, closest common ancestor, generation distance, and
          complete connection path.
        </p>
      </div>

      {/* Quick Discovery Presets */}
      {presets.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-stone-400 font-medium whitespace-nowrap">
            Explore presets:
          </span>
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                setPersonAId(preset.a);
                setPersonBId(preset.b);
              }}
              className="px-3 py-1.5 bg-stone-100 hover:bg-emerald-50 hover:text-emerald-900 text-stone-700 rounded-lg whitespace-nowrap transition-colors border border-stone-200"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {/* Selectors Card */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-6 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-start gap-4">
          <PersonPicker
            label="Person A (From)"
            people={people}
            selectedId={personAId}
            onChange={setPersonAId}
            accent="emerald"
          />

          <div className="flex justify-center md:pt-7">
            <button
              onClick={handleSwap}
              title="Swap Person A and Person B"
              aria-label="Swap Person A and Person B"
              className="p-3 rounded-full bg-stone-100 hover:bg-emerald-100 text-stone-600 hover:text-emerald-900 border border-stone-200 transition-all shadow-xs"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          <PersonPicker
            label="Person B (To)"
            people={people}
            selectedId={personBId}
            onChange={setPersonBId}
            accent="amber"
          />
        </div>
      </div>

      {calculation && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-xs">
          <div className="p-4 sm:p-6 space-y-5">
            {/* Hero Relationship Banner */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-stone-100">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-stone-400">
                    Calculated Relationship
                  </span>
                  <span className="text-xs text-stone-300">·</span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${status.className}`}
                  >
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900 mt-2 tracking-tight">
                  {calculation.primaryLabel}
                </h2>
                <p className="text-sm text-stone-600 mt-2 leading-relaxed max-w-2xl">
                  {calculation.pathDescription}
                </p>
                {calculation.relationshipDetail && (
                  <p className="text-xs text-stone-500 mt-2 leading-relaxed">
                    {calculation.relationshipDetail}
                  </p>
                )}
              </div>

              {showPath && onJumpToTreeWithHighlight && (
                <button
                  onClick={() =>
                    onJumpToTreeWithHighlight(
                      calculation.pathNodes.map((person) => person.id),
                    )
                  }
                  className="self-start sm:self-center px-4 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-semibold hover:bg-emerald-900 transition-colors shrink-0 shadow-xs flex items-center gap-1.5"
                >
                  <Layers className="w-4 h-4" />
                  View on Family Tree
                </button>
              )}
            </div>

            {/* Relationship facts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Direction
                </p>
                <div className="flex items-center gap-2 mt-2 min-w-0">
                  {personA && (
                    <MemberAvatar person={personA} className="w-7 h-7 text-[10px]" />
                  )}
                  <span className="text-xs font-semibold text-stone-800 truncate">
                    {calculation.sourcePerson.display_name}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  {personB && (
                    <MemberAvatar person={personB} className="w-7 h-7 text-[10px]" />
                  )}
                  <span className="text-xs font-semibold text-stone-800 truncate">
                    {calculation.targetPerson.display_name}
                  </span>
                </div>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Common Ancestor
                </p>
                {calculation.commonAncestor ? (
                  <button
                    onClick={() => onSelectPerson(calculation.commonAncestor!)}
                    className="flex items-center gap-2 mt-2 min-w-0 text-left hover:text-emerald-900 transition-colors"
                  >
                    <MemberAvatar
                      person={calculation.commonAncestor}
                      className="w-7 h-7 text-[10px]"
                    />
                    <span className="text-xs font-semibold text-stone-800 truncate">
                      {calculation.commonAncestor.display_name}
                    </span>
                    <span className="text-[10px] text-stone-400 shrink-0">
                      Gen {calculation.commonAncestor.generation_level}
                    </span>
                  </button>
                ) : (
                  <p className="text-xs text-stone-500 mt-2">
                    {calculation.relationshipCategory === 'spouse' ||
                    calculation.relationshipCategory === 'in_law' ||
                    calculation.relationshipCategory === 'step'
                      ? 'Not applicable — this is a marriage or step link.'
                      : 'Not established from the available records.'}
                  </p>
                )}
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                  Generation Distance
                </p>
                <p className="text-xs font-semibold text-stone-800 mt-2 leading-relaxed">
                  {formatGenerationDistance(calculation)}
                </p>
              </div>
            </div>

            {/* Missing records / incomplete explanation */}
            {calculation.missingRecords && calculation.missingRecords.length > 0 && (
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Missing or Incomplete Records
                </h4>
                <ul className="space-y-1">
                  {calculation.missingRecords.map((record) => (
                    <li
                      key={record}
                      className="text-xs text-amber-900/80 leading-relaxed flex gap-1.5"
                    >
                      <span className="text-amber-700">•</span>
                      <span>{record}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-amber-800/80 leading-relaxed">
                  Tiesora does not guess relationships. Adding the missing parent
                  or connecting records may establish this relationship.
                </p>
              </div>
            )}

            {/* Closest common ancestors */}
            {calculation.sharedAncestors.length > 0 && (
              <div className="p-4 bg-emerald-50/60 border border-emerald-900/10 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Closest Common Ancestor
                  {calculation.sharedAncestors.length === 1 ? '' : 's'} (
                  {calculation.sharedAncestors.length})
                </h4>
                <p className="text-xs text-emerald-900/80">
                  Both individuals trace recorded descent from:
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {calculation.sharedAncestors.map((ancestor) => (
                    <button
                      key={ancestor.id}
                      onClick={() => onSelectPerson(ancestor)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-emerald-200/80 rounded-lg text-xs font-semibold text-emerald-950 hover:border-emerald-700 transition-colors shadow-2xs"
                    >
                      <MemberAvatar person={ancestor} className="w-5 h-5 text-[9px]" />
                      {ancestor.display_name}
                      <span className="text-[10px] text-stone-400 font-normal">
                        (Gen {ancestor.generation_level})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showBranch && calculation && (
              <RelationshipBranchView
                result={calculation}
                onSelectPerson={onSelectPerson}
              />
            )}

            {/* Interactive Relationship Chain */}
            {showPath && (
              <div className="space-y-4 pt-1">
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                  <GitCommit className="w-4 h-4 text-emerald-800" />
                  Step-by-Step Connection Path
                </h4>
                <p className="text-xs text-stone-500">
                  Click any individual in the chain to open their profile and
                  inspect their full family branches.
                </p>

                <div className="flex items-start gap-2 overflow-x-auto py-3 px-1 -mx-1 pb-2">
                  {calculation.pathNodes.map((node, index) => {
                    const isStart = index === 0;
                    const isEnd = index === calculation.pathNodes.length - 1;
                    const edgeLabel = calculation.pathEdgeDescriptions[index - 1];

                    return (
                      <React.Fragment key={node.id}>
                        {index > 0 && (
                          <div className="flex flex-col items-center justify-center shrink-0 px-1 text-center">
                            <ArrowRight className="w-4 h-4 text-stone-400" />
                            {edgeLabel && (
                              <span className="text-[10px] font-semibold text-emerald-800 whitespace-nowrap mt-1">
                                {edgeLabel}
                              </span>
                            )}
                          </div>
                        )}

                        <button
                          onClick={() => onSelectPerson(node)}
                          className={`shrink-0 w-36 sm:w-40 p-2.5 rounded-xl border text-left transition-all group ${
                            isStart
                              ? 'border-emerald-700 bg-emerald-50/40 shadow-xs'
                              : isEnd
                                ? 'border-amber-600 bg-amber-50/40 shadow-xs'
                                : 'border-stone-200 hover:border-emerald-700 bg-white hover:shadow-xs'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <MemberAvatar
                              person={node}
                              className={`w-9 h-9 text-xs ${
                                isStart
                                  ? 'ring-2 ring-emerald-700'
                                  : isEnd
                                    ? 'ring-2 ring-amber-600'
                                    : ''
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-stone-900 truncate group-hover:text-emerald-950">
                                {node.display_name}
                              </p>
                              <p className="text-[10px] text-stone-500 tabular-nums">
                                Gen {node.generation_level}
                              </p>
                            </div>
                          </div>
                          <span className="inline-block mt-2 text-[10px] text-stone-400 group-hover:text-emerald-800 font-medium">
                            View profile ➔
                          </span>
                        </button>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            {!showPath &&
              (calculation.connectionStatus === 'not_found' ||
                calculation.connectionStatus === 'invalid') && (
                <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-600 leading-relaxed">
                  <p className="font-semibold text-stone-800 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    No connection path can be shown
                  </p>
                  <p className="mt-1">
                    Tiesora only displays paths made from recorded parent,
                    child, spouse, and step relationships. It will not invent a
                    connection.
                  </p>
                </div>
              )}

            {calculation.alternativeInterpretations &&
              calculation.alternativeInterpretations.length > 0 && (
                <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-600 space-y-1">
                  <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" />
                    Additional Connection Factors
                  </span>
                  <p className="text-stone-500">
                    {calculation.alternativeInterpretations.join(' · ')}
                  </p>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
};
