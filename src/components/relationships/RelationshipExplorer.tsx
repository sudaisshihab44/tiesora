import React, { useState, useMemo } from 'react';
import { FamilyPerson, Relationship, CalculatedRelationship } from '../../types';
import { calculateRelationship } from '../../utils/relationshipEngine';
import { 
  Compass, 
  ArrowRight, 
  ArrowLeftRight, 
  Users, 
  GitCommit, 
  CheckCircle2, 
  Info, 
  Layers, 
  UserCheck 
} from 'lucide-react';

interface RelationshipExplorerProps {
  people: FamilyPerson[];
  relationships: Relationship[];
  initialPersonAId?: string;
  initialPersonBId?: string;
  onSelectPerson: (person: FamilyPerson) => void;
  onJumpToTreeWithHighlight?: (personIds: string[]) => void;
}

export const RelationshipExplorer: React.FC<RelationshipExplorerProps> = ({
  people,
  relationships,
  initialPersonAId,
  initialPersonBId,
  onSelectPerson,
  onJumpToTreeWithHighlight,
}) => {
  const [personAId, setPersonAId] = useState<string>(initialPersonAId || people[11]?.id || people[0]?.id || '');
  const [personBId, setPersonBId] = useState<string>(initialPersonBId || people[13]?.id || people[1]?.id || '');

  const personA = people.find(p => p.id === personAId);
  const personB = people.find(p => p.id === personBId);

  // Calculate Relationship
  const calculation: CalculatedRelationship | null = useMemo(() => {
    if (!personA || !personB) return null;
    return calculateRelationship(personA, personB, people, relationships);
  }, [personA, personB, people, relationships]);

  // Swap A and B
  const handleSwap = () => {
    const temp = personAId;
    setPersonAId(personBId);
    setPersonBId(temp);
  };

  // Quick Presets
  const presets = [
    { label: 'Thomas & Julian (First Cousins)', a: 'p_thomas', b: 'p_julian' },
    { label: 'Thomas & Eleanor (Grandmother)', a: 'p_thomas', b: 'p_eleanor' },
    { label: 'Maya & Oliver (Second Cousins)', a: 'p_maya', b: 'p_oliver' },
    { label: 'Leo & Helena (Step-Parent)', a: 'p_leo', b: 'p_helena' },
    { label: 'Patricia & Chloe (Adoptive)', a: 'p_patricia', b: 'p_chloe' },
    { label: 'Thomas & Noah (Father & Son)', a: 'p_thomas', b: 'p_noah' },
  ];

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
          Select any two family members to compute their exact genealogical link, inspect shared common ancestors, and trace the step-by-step family path.
        </p>
      </div>

      {/* Quick Discovery Presets */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-stone-400 font-medium whitespace-nowrap">Explore presets:</span>
        {presets.map(preset => {
          const hasBoth = people.some(p => p.id === preset.a) && people.some(p => p.id === preset.b);
          if (!hasBoth) return null;
          return (
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
          );
        })}
      </div>

      {/* Selectors Card */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4">
          {/* Person A Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-stone-700">
              Person A (From)
            </label>
            <div className="relative">
              <select
                value={personAId}
                onChange={(e) => setPersonAId(e.target.value)}
                className="w-full appearance-none bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-3 text-xs font-medium text-stone-900 outline-none focus:border-emerald-700 focus:bg-white transition-all pr-8"
              >
                {people.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.display_name} ({p.full_name}) · Gen {p.generation_level}
                  </option>
                ))}
              </select>
            </div>
            {personA && (
              <div className="flex items-center gap-2.5 pt-1">
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-900 text-xs font-bold flex items-center justify-center shrink-0">
                  {personA.display_name.substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-stone-800 truncate">{personA.display_name}</p>
                  <p className="text-[11px] text-stone-400 truncate">Generation {personA.generation_level} · {personA.branch || 'Direct'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Swap Button */}
          <div className="flex justify-center md:pt-4">
            <button
              onClick={handleSwap}
              title="Swap Person A and Person B"
              className="p-3 rounded-full bg-stone-100 hover:bg-emerald-100 text-stone-600 hover:text-emerald-900 border border-stone-200 transition-all shadow-xs"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          {/* Person B Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-stone-700">
              Person B (To)
            </label>
            <div className="relative">
              <select
                value={personBId}
                onChange={(e) => setPersonBId(e.target.value)}
                className="w-full appearance-none bg-stone-50 border border-stone-300 rounded-xl px-3.5 py-3 text-xs font-medium text-stone-900 outline-none focus:border-emerald-700 focus:bg-white transition-all pr-8"
              >
                {people.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.display_name} ({p.full_name}) · Gen {p.generation_level}
                  </option>
                ))}
              </select>
            </div>
            {personB && (
              <div className="flex items-center gap-2.5 pt-1">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-900 text-xs font-bold flex items-center justify-center shrink-0">
                  {personB.display_name.substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-stone-800 truncate">{personB.display_name}</p>
                  <p className="text-[11px] text-stone-400 truncate">Generation {personB.generation_level} · {personB.branch || 'Direct'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Calculation Results Card */}
      {calculation && (
        <div className="bg-white rounded-xl border border-stone-200 overflow-hidden shadow-xs space-y-5 p-4 sm:p-6">
          {/* Hero Relationship Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-stone-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-stone-400">Calculated Relationship</span>
                <span className="text-xs text-stone-300">·</span>
                <span className="text-xs font-medium text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Graph Verified
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900 mt-1 tracking-tight">
                {calculation.primaryLabel}
              </h2>
              <p className="text-sm text-stone-600 mt-2 leading-relaxed">
                {calculation.pathDescription}
              </p>
            </div>

            {/* Jump to Tree button */}
            {onJumpToTreeWithHighlight && (
              <button
                onClick={() => onJumpToTreeWithHighlight(calculation.pathNodes.map(p => p.id))}
                className="self-start sm:self-center px-4 py-2.5 bg-emerald-800 text-white rounded-xl text-xs font-semibold hover:bg-emerald-900 transition-colors shrink-0 shadow-xs flex items-center gap-1.5"
              >
                <Layers className="w-4 h-4" />
                View Path on Tree
              </button>
            )}
          </div>

          {/* Shared Common Ancestors */}
          {calculation.sharedAncestors.length > 0 && (
            <div className="p-4 bg-emerald-50/60 border border-emerald-900/10 rounded-xl space-y-2">
              <h4 className="text-xs font-bold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Shared Common Ancestors ({calculation.sharedAncestors.length})
              </h4>
              <p className="text-xs text-emerald-900/80">
                Both individuals trace biological descent from:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {calculation.sharedAncestors.map(ancestor => (
                  <button
                    key={ancestor.id}
                    onClick={() => onSelectPerson(ancestor)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-emerald-200/80 rounded-lg text-xs font-semibold text-emerald-950 hover:border-emerald-700 transition-colors shadow-2xs"
                  >
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[10px]">
                      {ancestor.display_name.substring(0, 1)}
                    </div>
                    {ancestor.display_name}
                    <span className="text-[10px] text-stone-400 font-normal">
                      (Gen {ancestor.generation_level})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Interactive Relationship Chain */}
          <div className="space-y-4 pt-2">
            <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
              <GitCommit className="w-4 h-4 text-emerald-800" />
              Step-by-Step Connection Path
            </h4>
            <p className="text-xs text-stone-500">
              Click any individual in the chain to open their profile and inspect their full family branches.
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

                    {/* Node Card */}
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
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          isStart
                            ? 'bg-emerald-800 text-white'
                            : isEnd
                            ? 'bg-amber-600 text-white'
                            : 'bg-stone-100 text-stone-700 group-hover:bg-emerald-100 group-hover:text-emerald-900'
                        }`}>
                          {node.display_name.substring(0, 2).toUpperCase()}
                        </div>
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

          {/* Alternative Interpretations / Context */}
          {calculation.alternativeInterpretations && calculation.alternativeInterpretations.length > 0 && (
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
      )}
    </div>
  );
};
