import React from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Search,
  Plus,
  Layers,
  GitFork,
  List,
  UserCheck,
  X,
} from 'lucide-react';
import { TreeViewMode, FamilyPerson } from '../../types';

interface TreeControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitToScreen: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  people: FamilyPerson[];
  onSelectPerson: (person: FamilyPerson) => void;
  viewMode: TreeViewMode;
  onViewModeChange: (mode: TreeViewMode) => void;
  onAddNewMember: () => void;
  selectedPerson?: FamilyPerson;
}

export const TreeControls: React.FC<TreeControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToScreen,
  searchQuery,
  onSearchChange,
  people,
  onSelectPerson,
  viewMode,
  onViewModeChange,
  onAddNewMember,
  selectedPerson,
}) => {
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);

  const filteredPeople = searchQuery.trim()
    ? people.filter(p =>
        p.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.full_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  return (
    /* Two rows on mobile, single row on desktop */
    <div className="absolute top-2 left-2 right-2 z-20 flex flex-col sm:flex-row sm:items-start gap-2 pointer-events-none">
      {/* ── Row 1: View Modes + Search ── */}
      <div className="flex flex-wrap items-center gap-1.5 pointer-events-auto bg-white/95 backdrop-blur-md px-2 py-1.5 rounded-xl border border-stone-200/80 shadow-sm flex-1 min-w-0">
        {/* View mode buttons — scrollable on very small screens */}
        <div className="flex items-center gap-0.5 bg-stone-100/80 p-0.5 rounded-lg text-xs font-medium overflow-x-auto shrink-0">
          <button
            onClick={() => onViewModeChange('tree')}
            className={`px-2 py-1.5 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap ${
              viewMode === 'tree'
                ? 'bg-white text-emerald-900 shadow-xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
            title="Full tree canvas"
          >
            <GitFork className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tree</span>
          </button>
          <button
            onClick={() => onViewModeChange('ancestors')}
            className={`px-2 py-1.5 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap ${
              viewMode === 'ancestors'
                ? 'bg-white text-emerald-900 shadow-xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
            title={selectedPerson ? `Ancestors of ${selectedPerson.display_name}` : 'Select a person first'}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ancestors</span>
          </button>
          <button
            onClick={() => onViewModeChange('descendants')}
            className={`px-2 py-1.5 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap ${
              viewMode === 'descendants'
                ? 'bg-white text-emerald-900 shadow-xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
            title={selectedPerson ? `Descendants of ${selectedPerson.display_name}` : 'Select a person first'}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Descendants</span>
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`px-2 py-1.5 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap ${
              viewMode === 'list'
                ? 'bg-white text-emerald-900 shadow-xs font-semibold'
                : 'text-stone-600 hover:text-stone-900'
            }`}
            title="Directory list"
          >
            <List className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">List</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-0 flex-1">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs w-full focus-within:border-emerald-700 transition-all">
            <Search className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <input
              type="text"
              placeholder="Find member…"
              value={searchQuery}
              onChange={(e) => { onSearchChange(e.target.value); setIsSearchOpen(true); }}
              onFocus={() => setIsSearchOpen(true)}
              className="bg-transparent border-none outline-none w-full min-w-0 text-stone-800 placeholder-stone-400 text-xs"
            />
            {searchQuery && (
              <button onClick={() => { onSearchChange(''); setIsSearchOpen(false); }} className="text-stone-400 hover:text-stone-600 shrink-0">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          {isSearchOpen && filteredPeople.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-white border border-stone-200 rounded-xl shadow-lg p-1 max-h-52 overflow-y-auto z-50">
              {filteredPeople.map(person => (
                <button
                  key={person.id}
                  onClick={() => { onSelectPerson(person); setIsSearchOpen(false); onSearchChange(''); }}
                  className="w-full text-left px-3 py-2 hover:bg-emerald-50 rounded-lg flex items-center justify-between transition-colors group"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-stone-800 group-hover:text-emerald-950 truncate">{person.display_name}</p>
                    <p className="text-[10px] text-stone-400">Gen {person.generation_level} · {person.living_status}</p>
                  </div>
                  <span className="text-[10px] text-emerald-800 opacity-0 group-hover:opacity-100 font-medium">Locate</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2 (right side on desktop): Zoom + Add ── */}
      <div className="flex items-center gap-1.5 pointer-events-auto shrink-0">
        {/* Zoom Controls */}
        <div className="flex items-center bg-white/95 backdrop-blur-md p-1 rounded-xl border border-stone-200/80 shadow-sm text-stone-700">
          <button onClick={onZoomOut} title="Zoom Out" className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-mono font-medium px-1.5 tabular-nums text-stone-600 hidden sm:inline">
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={onZoomIn} title="Zoom In" className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-stone-200 mx-0.5" />
          <button onClick={onFitToScreen} title="Fit to Screen" className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onResetZoom} title="Reset Zoom" className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Add Member */}
        <button
          onClick={onAddNewMember}
          className="px-3 py-1.5 bg-emerald-800 text-white hover:bg-emerald-900 rounded-xl font-medium text-xs shadow-sm hover:shadow transition-all flex items-center gap-1 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add Member</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>
    </div>
  );
};
