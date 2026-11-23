import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import type { FamilyPerson } from '../../types';
import { MemberAvatar } from '../common/MemberAvatar';

interface PersonPickerProps {
  label: string;
  people: FamilyPerson[];
  selectedId: string;
  onChange: (id: string) => void;
  accent?: 'emerald' | 'amber';
}

const MAX_SUGGESTIONS = 30;

export const PersonPicker: React.FC<PersonPickerProps> = ({
  label,
  people,
  selectedId,
  onChange,
  accent = 'emerald',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sortedPeople = useMemo(
    () =>
      [...people].sort((a, b) =>
        a.display_name.localeCompare(b.display_name, undefined, {
          sensitivity: 'base',
        }),
      ),
    [people],
  );

  const selected = people.find((person) => person.id === selectedId);

  const filteredPeople = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return sortedPeople.slice(0, MAX_SUGGESTIONS);
    return sortedPeople
      .filter((person) => {
        return (
          person.display_name.toLowerCase().includes(term) ||
          person.full_name.toLowerCase().includes(term) ||
          (person.branch ?? '').toLowerCase().includes(term)
        );
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [query, sortedPeople]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  const selectPerson = (person: FamilyPerson) => {
    onChange(person.id);
    setQuery('');
    setOpen(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) =>
        filteredPeople.length === 0 ? 0 : Math.min(index + 1, filteredPeople.length - 1),
      );
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const person = filteredPeople[activeIndex];
      if (person) selectPerson(person);
    }
  };

  const accentRing =
    accent === 'amber' ? 'ring-2 ring-amber-500' : 'ring-2 ring-emerald-700';
  const accentText = accent === 'amber' ? 'text-amber-800' : 'text-emerald-800';

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-semibold text-stone-700 mb-2">
        {label}
      </label>

      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setOpen((value) => !value);
            setQuery('');
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`w-full bg-stone-50 border rounded-xl px-3 py-2.5 text-left transition-all flex items-center gap-2.5 ${
            open
              ? 'border-emerald-700 bg-white shadow-xs'
              : 'border-stone-300 hover:border-stone-400'
          }`}
        >
          {selected ? (
            <>
              <MemberAvatar
                person={selected}
                className={`w-9 h-9 text-xs ${accentRing}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-semibold text-stone-900 truncate">
                  {selected.display_name}
                </span>
                <span className="block text-[10px] text-stone-500 truncate mt-0.5">
                  {selected.full_name !== selected.display_name
                    ? `${selected.full_name} · `
                    : ''}
                  Gen {selected.generation_level}
                  {selected.branch ? ` · ${selected.branch}` : ''}
                </span>
              </span>
            </>
          ) : (
            <span className="min-w-0 flex-1 text-xs text-stone-500">
              Select a family member
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 shrink-0 text-stone-400 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>

        {selected && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onChange('');
              setOpen(true);
              setQuery('');
            }}
            title={`Clear ${label}`}
            aria-label={`Clear ${label}`}
            className="absolute right-9 top-1/2 -translate-y-1/2 p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-40 left-0 right-0 mt-2 bg-white border border-stone-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-stone-100">
            <div className="flex items-center gap-2 px-2.5 py-2 bg-stone-50 border border-stone-200 rounded-lg focus-within:border-emerald-700 focus-within:bg-white transition-all">
              <Search className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search by name, branch, or generation…"
                className="bg-transparent border-none outline-none w-full min-w-0 text-xs text-stone-800 placeholder-stone-400"
                aria-label={`Search ${label}`}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-stone-400 hover:text-stone-700 shrink-0"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <p className="text-[10px] text-stone-400 mt-1.5 px-1">
              {query.trim()
                ? `${filteredPeople.length} match${filteredPeople.length === 1 ? '' : 'es'}${
                    filteredPeople.length === MAX_SUGGESTIONS ? ` (showing first ${MAX_SUGGESTIONS})` : ''
                  }`
                : `Showing ${filteredPeople.length} of ${people.length} members. Type to search.`}
            </p>
          </div>

          <div className="max-h-64 overflow-y-auto p-1" role="listbox">
            {filteredPeople.length === 0 ? (
              <div className="px-3 py-6 text-center">
                <p className="text-xs font-medium text-stone-600">No members found</p>
                <p className="text-[10px] text-stone-400 mt-1">
                  Try a partial name or a different branch.
                </p>
              </div>
            ) : (
              filteredPeople.map((person, index) => {
                const isSelected = person.id === selectedId;
                const isActive = index === activeIndex;
                return (
                  <button
                    key={person.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectPerson(person)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center gap-2.5 transition-colors ${
                      isActive ? 'bg-emerald-50/80' : 'hover:bg-stone-50'
                    }`}
                  >
                    <MemberAvatar person={person} className="w-7 h-7 text-[10px]" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs font-semibold text-stone-800 truncate">
                          {person.display_name}
                        </span>
                        {isSelected && (
                          <Check className={`w-3 h-3 shrink-0 ${accentText}`} />
                        )}
                      </span>
                      <span className="block text-[10px] text-stone-400 truncate mt-0.5">
                        {person.full_name !== person.display_name
                          ? `${person.full_name} · `
                          : ''}
                        Gen {person.generation_level}
                        {person.branch ? ` · ${person.branch}` : ''}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
