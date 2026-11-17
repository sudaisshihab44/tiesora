import React from 'react';
import { ChevronLeft, ChevronRight, Layers, Users } from 'lucide-react';
import type { FamilyPerson } from '../../types';
import type { GenerationOption } from '../../utils/generations';

interface GenerationBarProps {
  options: GenerationOption[];
  focusedGeneration: number | 'all';
  onChange: (generation: number | 'all') => void;
  rootPerson?: FamilyPerson;
  visibleCount: number;
  totalCount: number;
}

export const GenerationBar: React.FC<GenerationBarProps> = ({
  options,
  focusedGeneration,
  onChange,
  rootPerson,
  visibleCount,
  totalCount,
}) => {
  const index = options.findIndex((option) => option.level === focusedGeneration);
  const hasPrevious = focusedGeneration !== 'all' && index > 0;
  const hasNext = focusedGeneration !== 'all' && index < options.length - 1;

  return (
    <div className="shrink-0 border-b border-stone-200 bg-white/95 backdrop-blur-md px-3 py-2 z-30">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900 shrink-0">
            <Layers className="w-4 h-4" />
            <span>Generation</span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-stone-500 sm:hidden">
            <span className="inline-flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {visibleCount} of {totalCount}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto min-w-0">
          <select
            value={focusedGeneration === 'all' ? 'all' : String(focusedGeneration)}
            onChange={(event) =>
              onChange(event.target.value === 'all' ? 'all' : Number(event.target.value))
            }
            className="min-w-0 flex-1 sm:flex-none sm:min-w-[280px] max-w-full px-3 py-1.5 text-xs border border-stone-300 rounded-lg bg-white text-stone-800 outline-none focus:border-emerald-700"
            aria-label="Select generation"
          >
            <option value="all">All Generations ({totalCount})</option>
            {options.map((option) => (
              <option key={option.level} value={option.level}>
                {option.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (focusedGeneration === 'all') {
                  onChange(options[options.length - 1]?.level ?? 'all');
                } else if (hasPrevious) {
                  onChange(options[index - 1].level);
                }
              }}
              disabled={focusedGeneration !== 'all' && !hasPrevious}
              className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Previous generation"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (focusedGeneration === 'all') {
                  onChange(options[0]?.level ?? 'all');
                } else if (hasNext) {
                  onChange(options[index + 1].level);
                }
              }}
              disabled={focusedGeneration !== 'all' && !hasNext}
              className="p-1.5 rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Next generation"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {focusedGeneration !== 'all' && (
              <button
                type="button"
                onClick={() => onChange('all')}
                className="px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors"
              >
                All
              </button>
            )}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 text-[11px] text-stone-500 ml-auto min-w-0">
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <Users className="w-3.5 h-3.5" />
            {visibleCount} of {totalCount} shown
          </span>
          <span className="truncate max-w-[260px]">
            Root: <strong className="text-stone-700">{rootPerson?.display_name || 'All members'}</strong>
          </span>
        </div>
      </div>
      <p className="text-[10px] text-stone-400 mt-1 sm:hidden truncate">
        Root: {rootPerson?.display_name || 'All members'} · select a member to recenter
      </p>
    </div>
  );
};
