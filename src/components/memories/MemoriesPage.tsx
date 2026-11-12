import React, { useState, useMemo } from 'react';
import { Memory, FamilyPerson } from '../../types';
import { MemoryUploadModal } from './MemoryUploadModal';
import { 
  Camera, 
  Calendar, 
  MapPin, 
  Users, 
  Plus, 
  Grid, 
  Clock, 
  Filter, 
  X, 
  Lock 
} from 'lucide-react';

interface MemoriesPageProps {
  memories: Memory[];
  people: FamilyPerson[];
  onSelectPerson: (person: FamilyPerson) => void;
  onRefreshMemories: () => void;
}

export const MemoriesPage: React.FC<MemoriesPageProps> = ({
  memories,
  people,
  onSelectPerson,
  onRefreshMemories,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'timeline'>('grid');
  const [selectedAlbum, setSelectedAlbum] = useState<string>('all');
  const [selectedPersonFilter, setSelectedPersonFilter] = useState<string>('all');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [activeMemory, setActiveMemory] = useState<Memory | null>(null);

  const peopleMap = new Map<string, FamilyPerson>(people.map(p => [p.id, p]));

  // Get distinct albums
  const albums = useMemo(() => {
    const set = new Set<string>();
    memories.forEach(m => {
      if (m.album) set.add(m.album);
    });
    return Array.from(set);
  }, [memories]);

  // Filter memories
  const filteredMemories = useMemo(() => {
    return memories.filter(m => {
      if (selectedAlbum !== 'all' && m.album !== selectedAlbum) return false;
      if (selectedPersonFilter !== 'all' && !m.tagged_person_ids.includes(selectedPersonFilter)) return false;
      return true;
    }).sort((a, b) => {
      // Sort chronologically descending
      const dateA = a.memory_date || '0000-00-00';
      const dateB = b.memory_date || '0000-00-00';
      return dateB.localeCompare(dateA);
    });
  }, [memories, selectedAlbum, selectedPersonFilter]);

  return (
    <div className="max-w-5xl mx-auto p-3 sm:p-5 space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 uppercase tracking-wider mb-1">
            <Camera className="w-4 h-4" />
            Family Digital Heritage Archive
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-stone-900 tracking-tight">
            Memories & Timeline
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Browse photographs, journal entries, and stories preserved across generations.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* View mode toggle */}
          <div className="flex items-center bg-stone-100 p-0.5 rounded-lg border border-stone-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'grid' ? 'bg-white text-emerald-950 shadow-xs' : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Grid View"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`p-1.5 rounded-md text-xs font-medium transition-colors ${
                viewMode === 'timeline' ? 'bg-white text-emerald-950 shadow-xs' : 'text-stone-600 hover:text-stone-900'
              }`}
              title="Chronological Timeline View"
            >
              <Clock className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setIsUploadOpen(true)}
            className="px-4 py-2 bg-emerald-800 text-white rounded-xl text-xs font-semibold hover:bg-emerald-900 transition-colors shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Memory
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-stone-200 shadow-2xs">
        <div className="flex items-center gap-1.5 text-xs text-stone-500 font-medium">
          <Filter className="w-3.5 h-3.5 text-stone-400" />
          Filter:
        </div>

        {/* Album Selector */}
        <select
          value={selectedAlbum}
          onChange={(e) => setSelectedAlbum(e.target.value)}
          className="text-xs px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-lg outline-none focus:border-emerald-700 text-stone-800"
        >
          <option value="all">All Albums ({memories.length})</option>
          {albums.map(alb => (
            <option key={alb} value={alb}>{alb}</option>
          ))}
        </select>

        {/* Person Selector */}
        <select
          value={selectedPersonFilter}
          onChange={(e) => setSelectedPersonFilter(e.target.value)}
          className="text-xs px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-lg outline-none focus:border-emerald-700 text-stone-800"
        >
          <option value="all">All Relatives</option>
          {people.map(p => (
            <option key={p.id} value={p.id}>{p.display_name} (Gen {p.generation_level})</option>
          ))}
        </select>

        {(selectedAlbum !== 'all' || selectedPersonFilter !== 'all') && (
          <button
            onClick={() => {
              setSelectedAlbum('all');
              setSelectedPersonFilter('all');
            }}
            className="text-xs text-emerald-800 hover:underline flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Reset filters
          </button>
        )}
      </div>

      {/* Content Rendering */}
      {filteredMemories.length === 0 ? (
        <div className="text-center py-16 bg-white border border-stone-200 rounded-2xl p-8">
          <Camera className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-stone-800">No memories found</h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            Try adjusting your filter or upload the first photograph to preserve this moment.
          </p>
          <button
            onClick={() => setIsUploadOpen(true)}
            className="mt-4 px-4 py-2 bg-emerald-800 text-white rounded-xl text-xs font-semibold hover:bg-emerald-900 transition-colors"
          >
            Upload Memory
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Gallery View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMemories.map(memory => {
            const tagged = memory.tagged_person_ids
              .map(id => peopleMap.get(id))
              .filter((p): p is FamilyPerson => Boolean(p));

            return (
              <div
                key={memory.id}
                onClick={() => setActiveMemory(memory)}
                className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer group flex flex-col"
              >
                <div className="relative aspect-4/3 w-full bg-stone-100 overflow-hidden">
                  <img
                    src={memory.image_url}
                    alt={memory.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                  />
                  {memory.is_private && (
                    <span className="absolute top-3 right-3 p-1.5 bg-black/60 backdrop-blur-xs text-white rounded-md text-[10px] flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      Private
                    </span>
                  )}
                  {memory.album && (
                    <span className="absolute bottom-3 left-3 px-2 py-1 bg-stone-900/70 backdrop-blur-xs text-white rounded-md text-[10px] font-medium">
                      {memory.album}
                    </span>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 group-hover:text-emerald-900 transition-colors line-clamp-1">
                      {memory.title}
                    </h3>
                    {memory.description && (
                      <p className="text-xs text-stone-600 mt-1.5 line-clamp-2 leading-relaxed">
                        {memory.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 mt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
                    <span className="flex items-center gap-1 tabular-nums">
                      <Calendar className="w-3.5 h-3.5 text-stone-400" />
                      {memory.memory_date ? memory.memory_date.substring(0, 4) : 'Historical'}
                    </span>

                    {tagged.length > 0 && (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-800 font-medium">
                        <Users className="w-3.5 h-3.5" />
                        {tagged.length} {tagged.length === 1 ? 'relative' : 'relatives'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Chronological Timeline View */
        <div className="relative border-l-2 border-emerald-900/20 ml-4 sm:ml-8 pl-6 sm:pl-8 space-y-10 py-4">
          {filteredMemories.map(memory => {
            const tagged = memory.tagged_person_ids
              .map(id => peopleMap.get(id))
              .filter((p): p is FamilyPerson => Boolean(p));

            return (
              <div key={memory.id} className="relative group">
                {/* Timeline node marker */}
                <div className="absolute -left-[31px] sm:-left-[39px] top-1.5 w-4 h-4 rounded-full bg-emerald-800 border-4 border-white shadow-xs" />

                <div
                  onClick={() => setActiveMemory(memory)}
                  className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs hover:shadow-md transition-all cursor-pointer grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5 items-start"
                >
                  <img
                    src={memory.image_url}
                    alt={memory.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-36 rounded-xl object-cover shrink-0"
                  />

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-stone-400 tabular-nums">
                      <span className="font-semibold text-emerald-800 text-sm">
                        {memory.memory_date || 'Undated Period'}
                      </span>
                      {memory.location && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1 text-stone-500">
                            <MapPin className="w-3 h-3 text-stone-400" />
                            {memory.location}
                          </span>
                        </>
                      )}
                      {memory.album && (
                        <>
                          <span>·</span>
                          <span className="text-stone-400">{memory.album}</span>
                        </>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-stone-900 group-hover:text-emerald-900 transition-colors">
                      {memory.title}
                    </h3>

                    {memory.description && (
                      <p className="text-xs text-stone-600 leading-relaxed">
                        {memory.description}
                      </p>
                    )}

                    {tagged.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-2">
                        <span className="text-[11px] text-stone-400 font-medium">Tagged:</span>
                        {tagged.map(p => (
                          <span
                            key={p.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectPerson(p);
                            }}
                            className="px-2 py-0.5 bg-stone-100 hover:bg-emerald-50 text-stone-700 hover:text-emerald-900 rounded text-[11px] transition-colors"
                          >
                            {p.display_name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Memory Detail Modal */}
      {activeMemory && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-2xl w-full overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-150">
            <div className="relative aspect-16/9 w-full bg-black">
              <img
                src={activeMemory.image_url}
                alt={activeMemory.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
              <button
                onClick={() => setActiveMemory(null)}
                className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-stone-900">{activeMemory.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-stone-500 mt-1 tabular-nums">
                    <span>{activeMemory.memory_date || 'Undated Record'}</span>
                    {activeMemory.location && (
                      <>
                        <span>·</span>
                        <span>{activeMemory.location}</span>
                      </>
                    )}
                    {activeMemory.album && (
                      <>
                        <span>·</span>
                        <span>{activeMemory.album}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-xs text-stone-400">
                  Added by {activeMemory.created_by_name}
                </span>
              </div>

              {activeMemory.description && (
                <p className="text-xs text-stone-700 leading-relaxed whitespace-pre-line bg-stone-50 p-4 rounded-xl border border-stone-200">
                  {activeMemory.description}
                </p>
              )}

              {activeMemory.tagged_person_ids.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-stone-700 mb-2">People in this memory:</h4>
                  <div className="flex flex-wrap gap-2">
                    {activeMemory.tagged_person_ids.map(id => {
                      const person = peopleMap.get(id);
                      if (!person) return null;
                      return (
                        <button
                          key={person.id}
                          onClick={() => {
                            setActiveMemory(null);
                            onSelectPerson(person);
                          }}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <div className="w-4 h-4 rounded-full bg-emerald-200 flex items-center justify-center text-[9px]">
                            {person.display_name[0]}
                          </div>
                          {person.display_name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      <MemoryUploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        people={people}
        onMemoryAdded={() => {
          onRefreshMemories();
        }}
      />
    </div>
  );
};
