import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Crosshair,
  GitFork,
  Maximize2,
  Users,
} from 'lucide-react';
import type { FamilyPerson } from '../../types';
import { MemberAvatar } from '../common/MemberAvatar';

interface FocusBarProps {
  focusPerson: FamilyPerson;
  ancestorDepth: number;
  descendantDepth: number;
  maxAncestorDepth: number;
  maxDescendantDepth: number;
  nextAncestorCount: number;
  nextDescendantCount: number;
  parentCount: number;
  childCount: number;
  spouseCount: number;
  siblingCount: number;
  visibleCount: number;
  onExpandAncestors: () => void;
  onExpandDescendants: () => void;
  onCenterFocus: () => void;
  onFitFocus: () => void;
  onFullTree: () => void;
}

function ancestorGenerationLabel(depth: number): string {
  if (depth <= 2) return 'grandparents';
  if (depth === 3) return 'great-grandparents';
  return `${depth - 2}x great-grandparents`;
}

function descendantGenerationLabel(depth: number): string {
  if (depth <= 2) return 'grandchildren';
  if (depth === 3) return 'great-grandchildren';
  return `${depth - 2}x great-grandchildren`;
}

export const FocusBar: React.FC<FocusBarProps> = ({
  focusPerson,
  ancestorDepth,
  descendantDepth,
  maxAncestorDepth,
  maxDescendantDepth,
  nextAncestorCount,
  nextDescendantCount,
  parentCount,
  childCount,
  spouseCount,
  siblingCount,
  visibleCount,
  onExpandAncestors,
  onExpandDescendants,
  onCenterFocus,
  onFitFocus,
  onFullTree,
}) => {
  const canExpandAncestors = maxAncestorDepth > ancestorDepth;
  const canExpandDescendants = maxDescendantDepth > descendantDepth;
  const nextAncestorLabel = ancestorGenerationLabel(ancestorDepth + 1);
  const nextDescendantLabel = descendantGenerationLabel(descendantDepth + 1);

  return (
    <div className="border-b border-stone-200 bg-[#FAF9F6]/95 backdrop-blur-sm px-3 sm:px-4 py-2.5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <MemberAvatar person={focusPerson} className="w-9 h-9 text-xs shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                <Crosshair className="w-3 h-3" />
                Focused view
              </span>
              <span className="text-stone-300">·</span>
              <span className="text-[10px] font-medium text-stone-400 flex items-center gap-1">
                <Users className="w-3 h-3" />
                {visibleCount} shown
              </span>
            </div>
            <p className="text-xs font-bold text-stone-900 truncate">
              {focusPerson.display_name}
            </p>
            <p className="text-[10px] text-stone-500 truncate">
              Gen {focusPerson.generation_level}
              {focusPerson.branch ? ` · ${focusPerson.branch}` : ''}
              {' · '}
              Parents {parentCount}
              {' · '}
              Spouses {spouseCount}
              {' · '}
              Siblings {siblingCount}
              {' · '}
              Children {childCount}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {canExpandAncestors ? (
            <button
              type="button"
              onClick={onExpandAncestors}
              title={`Show ${nextAncestorLabel}`}
              className="px-2.5 py-1.5 bg-white border border-emerald-700/30 text-emerald-900 rounded-lg text-[11px] font-semibold hover:bg-emerald-50 transition-colors flex items-center gap-1"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              Show {nextAncestorLabel}
              {nextAncestorCount > 0 && (
                <span className="text-[10px] text-stone-400">
                  ({nextAncestorCount})
                </span>
              )}
            </button>
          ) : maxAncestorDepth === 0 ? (
            <span className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 text-stone-500 rounded-lg text-[11px] font-medium">
              No recorded ancestors
            </span>
          ) : (
            <span className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 text-stone-500 rounded-lg text-[11px] font-medium flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-700" />
              All recorded ancestors shown
            </span>
          )}

          {canExpandDescendants ? (
            <button
              type="button"
              onClick={onExpandDescendants}
              title={`Show ${nextDescendantLabel}`}
              className="px-2.5 py-1.5 bg-white border border-amber-600/30 text-amber-900 rounded-lg text-[11px] font-semibold hover:bg-amber-50 transition-colors flex items-center gap-1"
            >
              <ArrowDown className="w-3.5 h-3.5" />
              Show {nextDescendantLabel}
              {nextDescendantCount > 0 && (
                <span className="text-[10px] text-stone-400">
                  ({nextDescendantCount})
                </span>
              )}
            </button>
          ) : maxDescendantDepth === 0 ? (
            <span className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 text-stone-500 rounded-lg text-[11px] font-medium">
              No recorded descendants
            </span>
          ) : (
            <span className="px-2.5 py-1.5 bg-stone-50 border border-stone-200 text-stone-500 rounded-lg text-[11px] font-medium flex items-center gap-1">
              <Check className="w-3.5 h-3.5 text-emerald-700" />
              All recorded descendants shown
            </span>
          )}

          <button
            type="button"
            onClick={onCenterFocus}
            title="Center the focused person"
            className="p-2 bg-white border border-stone-300 text-stone-600 rounded-lg hover:bg-stone-50 hover:text-emerald-800 transition-colors"
          >
            <Crosshair className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onFitFocus}
            title="Fit the visible focus branch"
            className="px-2.5 py-1.5 bg-white border border-stone-300 text-stone-700 rounded-lg text-[11px] font-semibold hover:bg-stone-50 hover:text-emerald-800 transition-colors flex items-center gap-1"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            Fit
          </button>

          <button
            type="button"
            onClick={onFullTree}
            className="px-2.5 py-1.5 bg-emerald-800 text-white rounded-lg text-[11px] font-semibold hover:bg-emerald-900 transition-colors flex items-center gap-1"
          >
            <GitFork className="w-3.5 h-3.5" />
            Full tree
          </button>
        </div>
      </div>
    </div>
  );
};
